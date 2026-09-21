-- Public booking reads expose only a deliberately small projection. Appointment
-- creation and receipt lookup remain service-role-only Nuxt server operations.
alter table public.booking_requests
  add column receipt_token uuid not null default extensions.gen_random_uuid();
alter table public.booking_requests
  add constraint booking_requests_receipt_token_key unique (receipt_token);

create function public.get_booking_catalog()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'shop', jsonb_build_object(
      'name', s.name, 'phone', s.phone, 'address', s.address,
      'timezone', s.timezone, 'currency', s.currency,
      'booking_enabled', s.booking_enabled,
      'minimum_notice_minutes', s.minimum_notice_minutes,
      'booking_horizon_days', s.booking_horizon_days
    ),
    'services', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', v.id, 'name', v.name, 'description', v.description,
        'duration_minutes', v.duration_minutes, 'price_minor', v.price_minor
      ) order by v.sort_order, v.name)
      from public.services v where v.is_active
    ), '[]'::jsonb),
    'barbers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id, 'name', b.name, 'bio', b.bio,
        'service_ids', coalesce((select jsonb_agg(bs.service_id order by bs.service_id)
          from public.barber_services bs join public.services sv on sv.id=bs.service_id and sv.is_active
          where bs.barber_id=b.id), '[]'::jsonb)
      ) order by b.sort_order, b.name)
      from public.barbers b where b.is_active
    ), '[]'::jsonb)
  )
  from public.shop_settings s where s.id;
$$;

create function public.get_available_slots(p_service uuid, p_date date, p_barber uuid default null)
returns table(slot_start timestamptz, local_time text, barber_id uuid, barber_name text)
language plpgsql stable security definer set search_path = '' as $$
declare cfg public.shop_settings; duration integer;
begin
  select * into cfg from public.shop_settings where id;
  if not found or cfg.timezone is null or cfg.currency is null then
    raise exception 'Shop is not configured' using errcode='22023';
  end if;
  if not cfg.booking_enabled then raise exception 'Online booking is disabled' using errcode='42501'; end if;
  if p_date is null then raise exception 'Booking date required' using errcode='22023'; end if;
  select s.duration_minutes into duration from public.services s where s.id=p_service and s.is_active;
  if not found then raise exception 'Service unavailable' using errcode='22023'; end if;

  return query
  select candidate.instant, to_char(candidate.instant at time zone cfg.timezone, 'HH24:MI'), b.id, b.name
  from public.barbers b
  join public.barber_services bs on bs.barber_id=b.id and bs.service_id=p_service
  join public.working_hours h on h.barber_id=b.id and h.weekday=extract(isodow from p_date)::integer
  cross join lateral generate_series(
    (p_date+h.start_time) at time zone cfg.timezone,
    ((p_date+h.end_time) at time zone cfg.timezone) - duration*interval '1 minute',
    cfg.slot_interval_minutes*interval '1 minute'
  ) candidate(instant)
  where b.is_active and (p_barber is null or b.id=p_barber)
    and candidate.instant >= now()+cfg.minimum_notice_minutes*interval '1 minute'
    and candidate.instant <= now()+cfg.booking_horizon_days*interval '1 day'
    and (candidate.instant at time zone cfg.timezone)::date=p_date
    and mod(extract(hour from candidate.instant at time zone cfg.timezone)::integer*60
      + extract(minute from candidate.instant at time zone cfg.timezone)::integer, cfg.slot_interval_minutes)=0
    and not exists(select 1 from public.blocked_times bt where bt.barber_id=b.id
      and tstzrange(bt.starts_at,bt.ends_at,'[)') && tstzrange(candidate.instant,candidate.instant+duration*interval '1 minute','[)'))
    and not exists(select 1 from public.appointments a where a.barber_id=b.id and a.status<>'cancelled'
      and tstzrange(a.starts_at,a.ends_at,'[)') && tstzrange(candidate.instant,candidate.instant+duration*interval '1 minute','[)'))
  order by candidate.instant, b.sort_order, b.name;
end;
$$;

create function public.create_guest_booking(
  p_key uuid, p_barber uuid, p_service uuid, p_start timestamptz,
  p_name text, p_phone text, p_email text default null
) returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare a public.appointments; token uuid;
begin
  a := public.create_guest_appointment(p_key,p_barber,p_service,p_start,p_name,p_phone,p_email);
  select receipt_token into token from public.booking_requests where idempotency_key=p_key;
  return jsonb_build_object(
    'receipt_token', token, 'appointment_id', a.id, 'customer_name', a.customer_name,
    'service_name', a.service_name, 'barber_id', a.barber_id,
    'starts_at', a.starts_at, 'ends_at', a.ends_at,
    'duration_minutes', a.duration_minutes, 'price_minor', a.price_minor,
    'currency', a.currency, 'status', a.status
  );
end;
$$;

create function public.get_guest_booking_receipt(p_token uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'receipt_token', r.receipt_token, 'appointment_id', a.id,
    'customer_name', a.customer_name, 'service_name', a.service_name,
    'barber_id', a.barber_id, 'barber_name', b.name,
    'starts_at', a.starts_at, 'ends_at', a.ends_at,
    'duration_minutes', a.duration_minutes, 'price_minor', a.price_minor,
    'currency', a.currency, 'status', a.status
  )
  from public.booking_requests r
  join public.appointments a on a.id=r.appointment_id
  join public.barbers b on b.id=a.barber_id
  where r.receipt_token=p_token and r.expires_at>now();
$$;

create function public.set_online_booking(p_enabled boolean, p_revision integer)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare cfg public.shop_settings;
begin
  perform private.require_admin();
  perform private.lock_schedule();
  select * into cfg from public.shop_settings where id for update;
  if p_enabled and (cfg.timezone is null or cfg.currency is null) then
    raise exception 'Shop is not configured' using errcode='22023';
  end if;
  if p_enabled and not exists(
    select 1 from public.barbers b join public.barber_services bs on bs.barber_id=b.id
    join public.services s on s.id=bs.service_id join public.working_hours h on h.barber_id=b.id
    where b.is_active and s.is_active
  ) then raise exception 'Bookable service schedule required' using errcode='22023'; end if;
  update public.shop_settings set booking_enabled=p_enabled where id and revision=p_revision;
  if not found then raise exception 'Stale revision' using errcode='40001'; end if;
  return jsonb_build_object('success',true);
end;
$$;

revoke all on function public.get_booking_catalog() from public, authenticated, service_role;
revoke all on function public.get_available_slots(uuid,date,uuid) from public, authenticated, service_role;
revoke all on function public.create_guest_booking(uuid,uuid,uuid,timestamptz,text,text,text) from public, anon, authenticated;
revoke all on function public.get_guest_booking_receipt(uuid) from public, anon, authenticated;
revoke all on function public.set_online_booking(boolean,integer) from public, anon;
grant execute on function public.get_booking_catalog() to anon, authenticated, service_role;
grant execute on function public.get_available_slots(uuid,date,uuid) to anon, authenticated, service_role;
grant execute on function public.create_guest_booking(uuid,uuid,uuid,timestamptz,text,text,text) to service_role;
grant execute on function public.get_guest_booking_receipt(uuid) to service_role;
grant execute on function public.set_online_booking(boolean,integer) to authenticated;
notify pgrst, 'reload schema';

-- Staff appointment management stays behind authenticated, active-staff checks.
-- Date boundaries are interpreted in the shop timezone inside PostgreSQL.
create function public.get_staff_appointments(
  p_from date,
  p_to date,
  p_barber uuid default null,
  p_status public.appointment_status default null,
  p_query text default null
) returns setof public.appointments
language plpgsql stable security definer set search_path = '' as $$
declare cfg public.shop_settings; search_text text := nullif(btrim(p_query), '');
begin
  if not private.is_staff() then raise exception 'Staff access required' using errcode='42501'; end if;
  select * into cfg from public.shop_settings where id;
  if p_from is null or p_to is null or p_to <= p_from or p_to - p_from > 93 then
    raise exception 'Invalid appointment range' using errcode='22023';
  end if;
  if char_length(search_text) > 100 then raise exception 'Search is too long' using errcode='22023'; end if;

  return query
  select a.* from public.appointments a
  where a.starts_at >= p_from::timestamp at time zone cfg.timezone
    and a.starts_at < p_to::timestamp at time zone cfg.timezone
    and (p_barber is null or a.barber_id=p_barber)
    and (p_status is null or a.status=p_status)
    and (search_text is null or a.customer_name ilike '%'||search_text||'%'
      or a.customer_phone ilike '%'||search_text||'%'
      or coalesce(a.customer_email,'') ilike '%'||search_text||'%')
  order by a.starts_at, a.created_at
  limit 1000;
end;
$$;

-- Staff availability works even when public online booking is disabled. The
-- optional excluded appointment makes its current slot available while editing.
create function public.get_staff_available_slots(
  p_service uuid,
  p_date date,
  p_barber uuid default null,
  p_exclude_appointment uuid default null
) returns table(slot_start timestamptz, local_time text, barber_id uuid, barber_name text)
language plpgsql stable security definer set search_path = '' as $$
declare cfg public.shop_settings; duration integer;
begin
  if not private.is_staff() then raise exception 'Staff access required' using errcode='42501'; end if;
  select * into cfg from public.shop_settings where id;
  if not found or cfg.timezone is null or cfg.currency is null then
    raise exception 'Shop is not configured' using errcode='22023';
  end if;
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
    and not exists(select 1 from public.blocked_times bt where bt.barber_id=b.id
      and tstzrange(bt.starts_at,bt.ends_at,'[)') && tstzrange(candidate.instant,candidate.instant+duration*interval '1 minute','[)'))
    and not exists(select 1 from public.appointments a where a.barber_id=b.id and a.status<>'cancelled'
      and a.id is distinct from p_exclude_appointment
      and tstzrange(a.starts_at,a.ends_at,'[)') && tstzrange(candidate.instant,candidate.instant+duration*interval '1 minute','[)'))
  order by candidate.instant, b.sort_order, b.name;
end;
$$;

create function public.update_staff_appointment(
  p_id uuid, p_version integer, p_barber uuid, p_service uuid, p_start timestamptz,
  p_name text, p_phone text, p_email text default null
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare cfg public.shop_settings; result jsonb;
begin
  perform private.require_staff();
  perform private.lock_schedule();
  select * into cfg from public.shop_settings where id;
  if not exists(select 1 from public.services s where s.id=p_service and s.is_active) then
    raise exception 'Service unavailable' using errcode='22023';
  end if;
  if p_start is null or not isfinite(p_start)
    or p_start < now()+cfg.minimum_notice_minutes*interval '1 minute'
    or p_start > now()+cfg.booking_horizon_days*interval '1 day' then
    raise exception 'Outside booking window' using errcode='22023';
  end if;
  if extract(second from p_start at time zone cfg.timezone)<>0
    or mod(extract(hour from p_start at time zone cfg.timezone)::integer*60
      +extract(minute from p_start at time zone cfg.timezone)::integer,cfg.slot_interval_minutes)<>0 then
    raise exception 'Start time is not on the booking grid' using errcode='22023';
  end if;

  with changed as (
    update public.appointments as a set barber_id=p_barber, service_id=p_service,
      customer_name=btrim(p_name), customer_phone=btrim(p_phone), customer_email=nullif(btrim(p_email),''),
      starts_at=p_start,
      ends_at=p_start+(case when a.service_id=p_service then a.duration_minutes else s.duration_minutes end)*interval '1 minute',
      service_name=case when a.service_id=p_service then a.service_name else s.name end,
      duration_minutes=case when a.service_id=p_service then a.duration_minutes else s.duration_minutes end,
      price_minor=case when a.service_id=p_service then a.price_minor else s.price_minor end
    from public.services s
    where a.id=p_id and a.version=p_version and a.status='confirmed' and a.starts_at>now()
      and s.id=p_service and s.is_active
    returning to_jsonb(a) as appointment
  )
  select appointment into result from changed;
  if result is null then
    raise exception 'Appointment changed or cannot be edited' using errcode='40001';
  end if;
  return result;
end;
$$;

-- Return JSON from the changed tuple so trigger-updated fields (including the
-- optimistic version) are preserved consistently for the API.
drop function public.set_appointment_status(uuid,integer,public.appointment_status);
create function public.set_appointment_status(
  p_id uuid, p_version integer, p_status public.appointment_status
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare result jsonb;
begin
  perform private.require_staff();
  perform private.lock_schedule();
  if p_status is null or p_status = 'confirmed' then
    raise exception 'Invalid status transition' using errcode = '22023';
  end if;
  with changed as (
    update public.appointments as a
      set status = p_status
      where a.id = p_id and a.version = p_version and a.status = 'confirmed'
      returning to_jsonb(a) as appointment
  )
  select appointment into result from changed;
  if result is null then
    raise exception 'Appointment changed or does not exist' using errcode = '40001';
  end if;
  return result;
end;
$$;

revoke all on function public.get_staff_appointments(date,date,uuid,public.appointment_status,text) from public,anon;
revoke all on function public.get_staff_available_slots(uuid,date,uuid,uuid) from public,anon;
revoke all on function public.update_staff_appointment(uuid,integer,uuid,uuid,timestamptz,text,text,text) from public,anon;
revoke all on function public.set_appointment_status(uuid,integer,public.appointment_status) from public,anon;
grant execute on function public.get_staff_appointments(date,date,uuid,public.appointment_status,text) to authenticated;
grant execute on function public.get_staff_available_slots(uuid,date,uuid,uuid) to authenticated;
grant execute on function public.update_staff_appointment(uuid,integer,uuid,uuid,timestamptz,text,text,text) to authenticated;
grant execute on function public.set_appointment_status(uuid,integer,public.appointment_status) to authenticated;
notify pgrst, 'reload schema';

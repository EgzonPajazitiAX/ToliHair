-- One visit may contain several services while remaining one continuous,
-- conflict-safe appointment on the barber's calendar.
create table public.appointment_services (
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete restrict,
  position smallint not null check(position between 1 and 10),
  service_name text not null,
  duration_minutes integer not null check(duration_minutes between 5 and 480),
  price_minor integer not null check(price_minor >= 0),
  primary key(appointment_id, service_id),
  unique(appointment_id, position)
);
alter table public.appointment_services enable row level security;
revoke all on public.appointment_services from public, anon, authenticated;

insert into public.appointment_services(appointment_id,service_id,position,service_name,duration_minutes,price_minor)
select id,service_id,1,service_name,duration_minutes,price_minor from public.appointments;

-- Existing staff editing supports one service. If such an edit changes the
-- service quote of a multi-service visit, intentionally collapse its breakdown
-- to that newly reviewed single service so snapshots never disagree.
create function private.sync_appointment_services_after_edit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.appointment_services where appointment_id=new.id;
  insert into public.appointment_services(appointment_id,service_id,position,service_name,duration_minutes,price_minor)
  values(new.id,new.service_id,1,new.service_name,new.duration_minutes,new.price_minor);
  return null;
end;
$$;
revoke all on function private.sync_appointment_services_after_edit() from public,anon,authenticated;
create trigger sync_appointment_services_after_edit
after update of service_id,service_name,duration_minutes,price_minor on public.appointments
for each row when ((new.service_id,new.service_name,new.duration_minutes,new.price_minor) is distinct from (old.service_id,old.service_name,old.duration_minutes,old.price_minor))
execute function private.sync_appointment_services_after_edit();

create function public.get_available_slots_multi(p_services uuid[], p_date date, p_barber uuid default null)
returns table(slot_start timestamptz, local_time text, barber_id uuid, barber_name text)
language plpgsql stable security definer set search_path = '' as $$
declare cfg public.shop_settings; duration integer; selected_count integer;
begin
  select * into cfg from public.shop_settings where id;
  if not found or cfg.timezone is null or cfg.currency is null then
    raise exception 'Shop is not configured' using errcode='22023';
  end if;
  if not cfg.booking_enabled then raise exception 'Online booking is disabled' using errcode='42501'; end if;
  if p_date is null then raise exception 'Booking date required' using errcode='22023'; end if;
  if coalesce(cardinality(p_services),0) not between 1 and 10
    or (select count(distinct id) from unnest(p_services) id) <> cardinality(p_services) then
    raise exception 'Invalid service selection' using errcode='22023';
  end if;
  select count(*),sum(s.duration_minutes)::integer into selected_count,duration
  from unnest(p_services) chosen(id) join public.services s on s.id=chosen.id and s.is_active;
  if selected_count<>cardinality(p_services) then raise exception 'Service unavailable' using errcode='22023'; end if;
  if duration>480 then raise exception 'Selected services are too long' using errcode='22023'; end if;

  return query
  select candidate.instant,to_char(candidate.instant at time zone cfg.timezone,'HH24:MI'),b.id,b.name
  from public.barbers b
  join public.working_hours h on h.barber_id=b.id and h.weekday=extract(isodow from p_date)::integer
  cross join lateral generate_series(
    (p_date+h.start_time) at time zone cfg.timezone,
    ((p_date+h.end_time) at time zone cfg.timezone)-duration*interval '1 minute',
    cfg.slot_interval_minutes*interval '1 minute'
  ) candidate(instant)
  where b.is_active and (p_barber is null or b.id=p_barber)
    and not exists(
      select 1 from unnest(p_services) chosen(id)
      where not exists(select 1 from public.barber_services bs where bs.barber_id=b.id and bs.service_id=chosen.id)
    )
    and candidate.instant>=now()+cfg.minimum_notice_minutes*interval '1 minute'
    and candidate.instant<=now()+cfg.booking_horizon_days*interval '1 day'
    and (candidate.instant at time zone cfg.timezone)::date=p_date
    and mod(extract(hour from candidate.instant at time zone cfg.timezone)::integer*60
      + extract(minute from candidate.instant at time zone cfg.timezone)::integer,cfg.slot_interval_minutes)=0
    and not exists(select 1 from public.blocked_times bt where bt.barber_id=b.id
      and tstzrange(bt.starts_at,bt.ends_at,'[)') && tstzrange(candidate.instant,candidate.instant+duration*interval '1 minute','[)'))
    and not exists(select 1 from public.appointments a where a.barber_id=b.id and a.status<>'cancelled'
      and tstzrange(a.starts_at,a.ends_at,'[)') && tstzrange(candidate.instant,candidate.instant+duration*interval '1 minute','[)'))
  order by candidate.instant,b.sort_order,b.name;
end;
$$;

create function public.create_guest_booking_multi(
  p_key uuid,p_barber uuid,p_services uuid[],p_start timestamptz,
  p_name text,p_phone text,p_email text default null
) returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  cfg public.shop_settings; a public.appointments; req public.booking_requests;
  fingerprint text; local_start timestamp; selected_count integer;
  total_duration integer; total_price bigint; names text; primary_service uuid; token uuid;
begin
  perform private.lock_schedule();
  if p_key is null then raise exception 'Idempotency key required' using errcode='22023'; end if;
  if coalesce(cardinality(p_services),0) not between 1 and 10
    or (select count(distinct id) from unnest(p_services) id)<>cardinality(p_services) then
    raise exception 'Invalid service selection' using errcode='22023';
  end if;
  fingerprint:=encode(extensions.digest(jsonb_build_array(p_barber,p_services,extract(epoch from p_start),btrim(p_name),btrim(p_phone),nullif(btrim(p_email),''),'online')::text,'sha256'),'hex');
  select * into req from public.booking_requests where idempotency_key=p_key;
  if found then
    if req.request_hash<>fingerprint then raise exception 'Idempotency key reused with different data' using errcode='23505'; end if;
    select * into a from public.appointments where id=req.appointment_id;
    return jsonb_build_object('receipt_token',req.receipt_token,'appointment_id',a.id,'customer_name',a.customer_name,
      'service_name',a.service_name,'barber_id',a.barber_id,'starts_at',a.starts_at,'ends_at',a.ends_at,
      'duration_minutes',a.duration_minutes,'price_minor',a.price_minor,'currency',a.currency,'status',a.status);
  end if;

  select * into cfg from public.shop_settings where id;
  if not found or cfg.timezone is null or cfg.currency is null then raise exception 'Shop is not configured' using errcode='22023'; end if;
  if not cfg.booking_enabled then raise exception 'Online booking is disabled' using errcode='42501'; end if;
  select count(*),sum(s.duration_minutes)::integer,sum(s.price_minor),string_agg(s.name,' + ' order by chosen.position),
    (array_agg(s.id order by chosen.position))[1]
  into selected_count,total_duration,total_price,names,primary_service
  from unnest(p_services) with ordinality chosen(id,position)
  join public.services s on s.id=chosen.id and s.is_active;
  if selected_count<>cardinality(p_services) then raise exception 'Service unavailable' using errcode='22023'; end if;
  if total_duration>480 or total_price>2147483647 then raise exception 'Selected services are too long or expensive' using errcode='22023'; end if;
  if not exists(select 1 from public.barbers where id=p_barber and is_active) then raise exception 'Barber unavailable' using errcode='22023'; end if;
  if exists(select 1 from unnest(p_services) chosen(id) where not exists(
    select 1 from public.barber_services bs where bs.barber_id=p_barber and bs.service_id=chosen.id
  )) then raise exception 'Service unavailable for this barber' using errcode='22023'; end if;
  if p_start is null or not isfinite(p_start) or p_start<now()+cfg.minimum_notice_minutes*interval '1 minute'
    or p_start>now()+cfg.booking_horizon_days*interval '1 day' then raise exception 'Outside booking window' using errcode='22023'; end if;
  local_start:=p_start at time zone cfg.timezone;
  if extract(second from local_start)<>0 or mod((extract(hour from local_start)::integer*60+extract(minute from local_start)::integer),cfg.slot_interval_minutes)<>0 then
    raise exception 'Start time is not on the booking grid' using errcode='22023';
  end if;

  insert into public.appointments(barber_id,service_id,customer_name,customer_phone,customer_email,starts_at,ends_at,
    service_name,duration_minutes,price_minor,currency,source,created_by)
  values(p_barber,primary_service,btrim(p_name),btrim(p_phone),nullif(btrim(p_email),''),p_start,
    p_start+total_duration*interval '1 minute',names,total_duration,total_price::integer,cfg.currency,'online',null)
  returning * into a;
  insert into public.appointment_services(appointment_id,service_id,position,service_name,duration_minutes,price_minor)
  select a.id,s.id,chosen.position,s.name,s.duration_minutes,s.price_minor
  from unnest(p_services) with ordinality chosen(id,position) join public.services s on s.id=chosen.id;
  insert into public.booking_requests(idempotency_key,request_hash,appointment_id) values(p_key,fingerprint,a.id)
  returning receipt_token into token;
  return jsonb_build_object('receipt_token',token,'appointment_id',a.id,'customer_name',a.customer_name,
    'service_name',a.service_name,'barber_id',a.barber_id,'starts_at',a.starts_at,'ends_at',a.ends_at,
    'duration_minutes',a.duration_minutes,'price_minor',a.price_minor,'currency',a.currency,'status',a.status);
end;
$$;

revoke all on function public.get_available_slots_multi(uuid[],date,uuid) from public,authenticated,service_role;
revoke all on function public.create_guest_booking_multi(uuid,uuid,uuid[],timestamptz,text,text,text) from public,anon,authenticated;
grant execute on function public.get_available_slots_multi(uuid[],date,uuid) to anon,authenticated,service_role;
grant execute on function public.create_guest_booking_multi(uuid,uuid,uuid[],timestamptz,text,text,text) to service_role;
notify pgrst,'reload schema';

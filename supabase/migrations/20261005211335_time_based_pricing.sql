-- Daily premium window in the shop timezone. Disabled until the administrator opts in.
-- Existing appointments remain immutable price snapshots.
alter table public.shop_settings
  add column peak_pricing_enabled boolean not null default false,
  add column peak_start_time time not null default '17:00',
  add column peak_end_time time not null default '20:00',
  add column peak_multiplier numeric(3,2) not null default 1.50,
  add constraint peak_pricing_window check (
    peak_start_time < peak_end_time and extract(second from peak_start_time)=0
    and extract(second from peak_end_time)=0
    and peak_multiplier between 1.01 and 5.00
  );

create function private.price_at(p_base integer,p_start timestamptz)
returns integer language plpgsql stable security invoker set search_path='' as $$
declare cfg public.shop_settings; local_time time; price numeric;
begin
  select * into cfg from public.shop_settings where id;
  local_time := (p_start at time zone cfg.timezone)::time;
  price := p_base;
  if cfg.peak_pricing_enabled and local_time>=cfg.peak_start_time and local_time<cfg.peak_end_time then
    price := round(p_base::numeric*cfg.peak_multiplier);
  end if;
  if price>2147483647 or price<0 then raise exception 'Selected services are too long or expensive' using errcode='22023'; end if;
  return price::integer;
end;
$$;
revoke all on function private.price_at(integer,timestamptz) from public,anon,authenticated;

create or replace function private.create_appointment(
  p_key uuid, p_barber uuid, p_service uuid, p_start timestamptz,
  p_name text, p_phone text, p_email text, p_source text, p_actor uuid
) returns public.appointments language plpgsql volatile security definer set search_path = '' as $$
declare
  cfg public.shop_settings; svc public.services; a public.appointments;
  req public.booking_requests; fingerprint text; local_start timestamp;
begin
  perform private.lock_schedule();
  if p_key is null then raise exception 'Idempotency key required' using errcode = '22023'; end if;
  fingerprint := encode(extensions.digest(jsonb_build_array(p_barber,p_service,extract(epoch from p_start),btrim(p_name),btrim(p_phone),nullif(btrim(p_email),''),p_source,p_actor)::text, 'sha256'),'hex');
  select * into req from public.booking_requests where idempotency_key = p_key;
  if found then
    if req.request_hash <> fingerprint then raise exception 'Idempotency key reused with different data' using errcode = '23505'; end if;
    select * into a from public.appointments where id = req.appointment_id;
    return a;
  end if;
  select * into cfg from public.shop_settings where id;
  if not found or cfg.timezone is null or cfg.currency is null then raise exception 'Shop is not configured' using errcode = '22023'; end if;
  if p_source = 'online' and not cfg.booking_enabled then raise exception 'Online booking is disabled' using errcode = '42501'; end if;
  select * into svc from public.services where id = p_service and is_active;
  if not found then raise exception 'Service unavailable' using errcode = '22023'; end if;
  if p_start is null or not isfinite(p_start) or p_start < now() + cfg.minimum_notice_minutes * interval '1 minute'
    or p_start > now() + cfg.booking_horizon_days * interval '1 day' then
    raise exception 'Outside booking window' using errcode = '22023';
  end if;
  local_start := p_start at time zone cfg.timezone;
  if extract(second from local_start) <> 0 or mod((extract(hour from local_start)::integer * 60 + extract(minute from local_start)::integer),cfg.slot_interval_minutes) <> 0 then
    raise exception 'Start time is not on the booking grid' using errcode = '22023';
  end if;
  -- Trigger checks schedule; exclusion constraint enforces appointment overlap.
  insert into public.appointments (barber_id,service_id,customer_name,customer_phone,customer_email,starts_at,ends_at,
    service_name,duration_minutes,price_minor,currency,source,created_by)
  values (p_barber,p_service,btrim(p_name),btrim(p_phone),nullif(btrim(p_email),''),p_start,
    p_start + svc.duration_minutes * interval '1 minute',svc.name,svc.duration_minutes,private.price_at(svc.price_minor,p_start),cfg.currency,p_source,p_actor)
  returning * into a;
  insert into public.booking_requests(idempotency_key,request_hash,appointment_id) values (p_key,fingerprint,a.id);
  return a;
end;
$$;

create or replace function public.create_guest_booking_multi(
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
  select count(*),sum(s.duration_minutes)::integer,sum(private.price_at(s.price_minor,p_start)),string_agg(s.name,' + ' order by chosen.position),
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
  select a.id,s.id,chosen.position,s.name,s.duration_minutes,private.price_at(s.price_minor,p_start)
  from unnest(p_services) with ordinality chosen(id,position) join public.services s on s.id=chosen.id;
  insert into public.booking_requests(idempotency_key,request_hash,appointment_id) values(p_key,fingerprint,a.id)
  returning receipt_token into token;
  return jsonb_build_object('receipt_token',token,'appointment_id',a.id,'customer_name',a.customer_name,
    'service_name',a.service_name,'barber_id',a.barber_id,'starts_at',a.starts_at,'ends_at',a.ends_at,
    'duration_minutes',a.duration_minutes,'price_minor',a.price_minor,'currency',a.currency,'status',a.status);
end;
$$;

create or replace function public.get_booking_catalog()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'shop', jsonb_build_object(
      'name', s.name, 'phone', s.phone, 'address', s.address,
      'timezone', s.timezone, 'currency', s.currency,
      'booking_enabled', s.booking_enabled,
      'minimum_notice_minutes', s.minimum_notice_minutes,
      'booking_horizon_days', s.booking_horizon_days,
      'peak_pricing_enabled',s.peak_pricing_enabled,'peak_start_time',s.peak_start_time,
      'peak_end_time',s.peak_end_time,'peak_multiplier',s.peak_multiplier
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

create or replace function public.manage_shop(p_resource text,p_data jsonb) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare actor uuid; rid uuid; expected integer; result jsonb; b public.barbers;
  ids uuid[]; cfg public.shop_settings; starts timestamptz; ends timestamptz;
begin
  actor := private.require_admin();
  perform private.lock_schedule();
  if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Object required' using errcode='22023'; end if;
  rid := (p_data->>'id')::uuid;
  expected := (p_data->>'revision')::integer;
  if rid is not null and expected is null then raise exception 'Revision required' using errcode='22023'; end if;

  case p_resource
  when 'services' then
    if not exists(select 1 from public.shop_settings where id and currency is not null) then
      raise exception 'Configure the shop currency first' using errcode='22023';
    end if;
    if rid is null then
      insert into public.services(name,description,duration_minutes,price_minor,is_active)
      values(btrim(p_data->>'name'),p_data->>'description',(p_data->>'duration_minutes')::integer,(p_data->>'price_minor')::integer,(p_data->>'is_active')::boolean)
      returning to_jsonb(services.*) into result;
    else
      update public.services set name=btrim(p_data->>'name'),description=p_data->>'description',duration_minutes=(p_data->>'duration_minutes')::integer,
        price_minor=(p_data->>'price_minor')::integer,is_active=(p_data->>'is_active')::boolean where id=rid and revision=expected
        returning to_jsonb(services.*) into result;
    end if;
  when 'barbers' then
    if jsonb_typeof(p_data->'service_ids') is distinct from 'array' then raise exception 'Service list required' using errcode='22023'; end if;
    select coalesce(array_agg(distinct value::uuid),'{}'::uuid[]) into ids from jsonb_array_elements_text(p_data->'service_ids');
    if exists(select 1 from unnest(ids) s where not exists(select 1 from public.services where id=s)) then raise exception 'Unknown service' using errcode='23503'; end if;
    if rid is null then
      insert into public.barbers(name,bio,is_active) values(btrim(p_data->>'name'),p_data->>'bio',(p_data->>'is_active')::boolean) returning * into b;
      rid := b.id;
    else
      update public.barbers set name=btrim(p_data->>'name'),bio=p_data->>'bio',is_active=(p_data->>'is_active')::boolean
        where id=rid and revision=expected returning * into b;
      if not found then raise exception 'Record changed. Reload before saving.' using errcode='40001'; end if;
    end if;
    delete from public.barber_services where barber_id=rid and not(service_id=any(ids));
    insert into public.barber_services(barber_id,service_id) select rid,s from unnest(ids) s on conflict do nothing;
    result := to_jsonb(b);
  when 'working-hours' then
    if rid is null or jsonb_typeof(p_data->'intervals') is distinct from 'array' then raise exception 'Barber and intervals required' using errcode='22023'; end if;
    if jsonb_array_length(p_data->'intervals')>28 then raise exception 'Too many intervals' using errcode='22023'; end if;
    update public.barbers set updated_at=now() where id=rid and revision=expected returning * into b;
    if not found then raise exception 'Record changed. Reload before saving.' using errcode='40001'; end if;
    delete from public.working_hours where barber_id=rid;
    insert into public.working_hours(barber_id,weekday,start_time,end_time)
      select rid,(v->>'weekday')::smallint,(v->>'start_time')::time,(v->>'end_time')::time from jsonb_array_elements(p_data->'intervals') v;
    result := to_jsonb(b);
  when 'blocked-times' then
    if p_data->>'action'='delete' then
      if rid is null then raise exception 'Block required' using errcode='22023'; end if;
      delete from public.blocked_times where id=rid and revision=expected returning jsonb_build_object('id',id) into result;
    else
      starts := private.shop_instant(p_data->>'start_local');
      ends := private.shop_instant(p_data->>'end_local');
      if ends<=starts then raise exception 'End must be after start' using errcode='22023'; end if;
      if rid is null then
        insert into public.blocked_times(barber_id,starts_at,ends_at,reason,created_by)
          values((p_data->>'barber_id')::uuid,starts,ends,p_data->>'reason',actor) returning to_jsonb(blocked_times.*) into result;
      else
        update public.blocked_times set barber_id=(p_data->>'barber_id')::uuid,starts_at=starts,ends_at=ends,reason=p_data->>'reason'
          where id=rid and revision=expected returning to_jsonb(blocked_times.*) into result;
      end if;
    end if;
  when 'settings' then
    if char_length(p_data->>'phone')>40 or char_length(p_data->>'address')>500 then raise exception 'Contact details too long' using errcode='22023'; end if;
    select * into cfg from public.shop_settings where id;
    if expected is null or expected<>cfg.revision then raise exception 'Record changed. Reload before saving.' using errcode='40001'; end if;
    if cfg.currency is not null and cfg.currency is distinct from p_data->>'currency' and exists(select 1 from public.services) then
      raise exception 'Currency cannot change after services exist; review and migrate prices first' using errcode='22023';
    end if;
    if cfg.timezone is not null and cfg.timezone is distinct from p_data->>'timezone'
      and (exists(select 1 from public.blocked_times where ends_at>now()) or exists(select 1 from public.appointments where status='confirmed' and ends_at>now())) then
      raise exception 'Resolve upcoming appointments and blocks before changing timezone' using errcode='22023';
    end if;
    update public.shop_settings set name=btrim(p_data->>'name'),phone=nullif(btrim(p_data->>'phone'),''),address=nullif(btrim(p_data->>'address'),''),
      timezone=p_data->>'timezone',currency=p_data->>'currency',minimum_notice_minutes=(p_data->>'minimum_notice_minutes')::integer,
      slot_interval_minutes=(p_data->>'slot_interval_minutes')::integer,booking_horizon_days=(p_data->>'booking_horizon_days')::integer,
      peak_pricing_enabled=coalesce((p_data->>'peak_pricing_enabled')::boolean,cfg.peak_pricing_enabled),
      peak_start_time=coalesce((p_data->>'peak_start_time')::time,cfg.peak_start_time),
      peak_end_time=coalesce((p_data->>'peak_end_time')::time,cfg.peak_end_time),
      peak_multiplier=coalesce((p_data->>'peak_multiplier')::numeric,cfg.peak_multiplier)
      where id returning to_jsonb(shop_settings.*) into result;
    -- booking_enabled is intentionally not writable until public booking is ready.
  else raise exception 'Unknown resource' using errcode='22023';
  end case;
  if result is null then raise exception 'Record changed or missing. Reload before saving.' using errcode='40001'; end if;
  return result;
end;
$$;

-- Candidate start times are the union of real, service-specific availability.
-- Each candidate carries only the service IDs that fit, never customer data.
create function public.get_booking_start_slots(p_date date,p_barber uuid)
returns table(slot_start timestamptz,local_time text,barber_id uuid,barber_name text,service_ids uuid[])
language plpgsql stable security definer set search_path='' as $$
declare cfg public.shop_settings;
begin
  select * into cfg from public.shop_settings where id;
  if not cfg.booking_enabled then raise exception 'Online booking is disabled' using errcode='42501'; end if;
  if p_date is null or p_barber is null then raise exception 'Booking date required' using errcode='22023'; end if;
  return query
    select slots.slot_start,slots.local_time,slots.barber_id,slots.barber_name,array_agg(s.id order by s.id)
    from public.services s
    join public.barber_services bs on bs.service_id=s.id and bs.barber_id=p_barber
    cross join lateral public.get_available_slots(s.id,p_date,p_barber) slots
    where s.is_active
    group by slots.slot_start,slots.local_time,slots.barber_id,slots.barber_name
    order by slots.slot_start;
end;
$$;
revoke all on function public.get_booking_start_slots(date,uuid) from public,anon,authenticated;
grant execute on function public.get_booking_start_slots(date,uuid) to anon,authenticated,service_role;

-- Lock quote verification and creation together: a changed price must be
-- explicitly reviewed by the client, not silently charged at confirmation.
create function public.create_guest_booking_priced(
  p_key uuid,p_barber uuid,p_services uuid[],p_start timestamptz,
  p_name text,p_phone text,p_email text default null,p_expected_price integer default null
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare quoted bigint; receipt jsonb;
begin
  perform private.lock_schedule();
  if coalesce(cardinality(p_services),0) not between 1 and 10
    or (select count(distinct id) from unnest(p_services) id)<>cardinality(p_services) then
    raise exception 'Invalid service selection' using errcode='22023';
  end if;
  -- A successful retry returns the original receipt even if settings changed.
  -- The underlying creation function still verifies its idempotency fingerprint.
  if not exists(select 1 from public.booking_requests where idempotency_key=p_key) then
    select sum(private.price_at(s.price_minor,p_start)) into quoted
      from public.services s where s.id=any(p_services) and s.is_active;
    if p_expected_price is not null and quoted is distinct from p_expected_price::bigint then
      raise exception 'Booking price changed' using errcode='40001';
    end if;
  end if;
  if cardinality(p_services)=1 then
    receipt := public.create_guest_booking(p_key,p_barber,p_services[1],p_start,p_name,p_phone,p_email);
  else
    receipt := public.create_guest_booking_multi(p_key,p_barber,p_services,p_start,p_name,p_phone,p_email);
  end if;
  return receipt;
end;
$$;
revoke all on function public.create_guest_booking_priced(uuid,uuid,uuid[],timestamptz,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.create_guest_booking_priced(uuid,uuid,uuid[],timestamptz,text,text,text,integer) to service_role;
notify pgrst,'reload schema';

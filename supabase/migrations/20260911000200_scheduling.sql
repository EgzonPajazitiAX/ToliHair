-- One transaction-scoped lock serializes schedule writes for this single shop.
-- Statement triggers make the same protocol apply to privileged SQL edits too.
-- Future multi-shop support can replace this with a per-shop lock.
create function private.lock_schedule() returns void language sql volatile set search_path = '' as $$
  select pg_catalog.pg_advisory_xact_lock(714209, 1);
$$;
create function private.lock_schedule_trigger() returns trigger language plpgsql security definer set search_path = '' as $$
begin perform private.lock_schedule(); return null; end;
$$;
do $$
declare t text;
begin
  foreach t in array array['shop_settings','barbers','services','barber_services','working_hours','blocked_times','appointments','booking_requests'] loop
    execute format('create trigger lock_schedule before insert or update or delete on public.%I for each statement execute function private.lock_schedule_trigger()', t);
  end loop;
end $$;

create function private.validate_settings() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.timezone is not null and not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'Invalid shop timezone' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger validate_settings before insert or update on public.shop_settings for each row execute function private.validate_settings();

-- Full interval containment; UTC instants are converted using the shop timezone.
-- No overnight shifts in v1. Midnight may be represented by an end_time of 24:00.
create function private.assert_schedule(p_barber uuid, p_service uuid, p_start timestamptz, p_end timestamptz)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare tz text; local_start timestamp; local_end timestamp;
begin
  select timezone into tz from public.shop_settings where id;
  if tz is null then raise exception 'Shop timezone is not configured' using errcode = '22023'; end if;
  if not exists (select 1 from public.barbers where id = p_barber and is_active) then
    raise exception 'Barber unavailable' using errcode = '22023';
  end if;
  if not exists (select 1 from public.barber_services where barber_id = p_barber and service_id = p_service) then
    raise exception 'Service unavailable for this barber' using errcode = '22023';
  end if;
  local_start := p_start at time zone tz;
  local_end := p_end at time zone tz;
  if not exists (
    select 1 from public.working_hours h
    where h.barber_id = p_barber and h.weekday = extract(isodow from local_start)::integer
      and local_start >= local_start::date + h.start_time
      and local_end <= local_start::date + h.end_time
      and p_start >= (local_start::date + h.start_time) at time zone tz
      and p_end <= (local_start::date + h.end_time) at time zone tz
  ) then raise exception 'Outside working hours' using errcode = '22023'; end if;
  if exists (select 1 from public.blocked_times b where b.barber_id = p_barber
    and tstzrange(b.starts_at,b.ends_at,'[)') && tstzrange(p_start,p_end,'[)')) then
    raise exception 'Time is blocked' using errcode = '23P01';
  end if;
end;
$$;

create function private.check_schedule_edit() returns trigger language plpgsql security definer set search_path = '' as $$
declare a public.appointments;
begin
  -- Service price/name/duration changes do not rewrite existing appointments.
  for a in select * from public.appointments where status = 'confirmed' and ends_at > now() loop
    perform private.assert_schedule(a.barber_id, a.service_id, a.starts_at, a.ends_at);
  end loop;
  return null;
end;
$$;
do $$
declare t text;
begin
  foreach t in array array['shop_settings','barbers','barber_services','working_hours','blocked_times'] loop
    execute format('create trigger check_schedule_edit after insert or update or delete on public.%I for each statement execute function private.check_schedule_edit()', t);
  end loop;
end $$;

create function private.check_appointment() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'confirmed' then raise exception 'New appointments must be confirmed' using errcode = '22023'; end if;
    perform private.assert_schedule(new.barber_id,new.service_id,new.starts_at,new.ends_at);
  else
    new.version := old.version + 1;
    if old.status <> 'confirmed' and new is distinct from old then
      raise exception 'Finalized appointments cannot be edited' using errcode = '22023';
    end if;
    if new.status in ('completed','no_show') and new.starts_at > now() then
      raise exception 'Appointment has not started' using errcode = '22023';
    end if;
    if (new.barber_id,new.service_id,new.starts_at,new.ends_at) is distinct from (old.barber_id,old.service_id,old.starts_at,old.ends_at) then
      perform private.assert_schedule(new.barber_id,new.service_id,new.starts_at,new.ends_at);
    end if;
  end if;
  return new;
end;
$$;
create trigger check_appointment before insert or update on public.appointments for each row execute function private.check_appointment();

create function private.require_staff() returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  -- Hold the authorization row while performing the mutation.
  perform 1 from public.profiles where id = uid and is_active for share;
  if not found then raise exception 'Staff access required' using errcode = '42501'; end if;
  return uid;
end;
$$;

create function private.create_appointment(
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
    p_start + svc.duration_minutes * interval '1 minute',svc.name,svc.duration_minutes,svc.price_minor,cfg.currency,p_source,p_actor)
  returning * into a;
  insert into public.booking_requests(idempotency_key,request_hash,appointment_id) values (p_key,fingerprint,a.id);
  return a;
end;
$$;

-- Guest RPC is server-only. No anon/authenticated EXECUTE grant.
create function public.create_guest_appointment(
  p_key uuid, p_barber uuid, p_service uuid, p_start timestamptz, p_name text, p_phone text, p_email text default null
) returns public.appointments language sql volatile security definer set search_path = '' as $$
  select private.create_appointment(p_key,p_barber,p_service,p_start,p_name,p_phone,p_email,'online',null);
$$;
create function public.create_staff_appointment(
  p_key uuid, p_barber uuid, p_service uuid, p_start timestamptz, p_name text, p_phone text, p_email text default null
) returns public.appointments language plpgsql volatile security definer set search_path = '' as $$
declare actor uuid;
begin
  actor := private.require_staff();
  return private.create_appointment(p_key,p_barber,p_service,p_start,p_name,p_phone,p_email,'staff',actor);
end;
$$;

create function public.set_appointment_status(p_id uuid, p_version integer, p_status public.appointment_status)
returns public.appointments language plpgsql volatile security definer set search_path = '' as $$
declare a public.appointments;
begin
  perform private.require_staff();
  perform private.lock_schedule();
  if p_status is null or p_status = 'confirmed' then raise exception 'Invalid status transition' using errcode = '22023'; end if;
  update public.appointments set status = p_status where id = p_id and version = p_version and status = 'confirmed' returning * into a;
  if not found then raise exception 'Appointment changed or does not exist' using errcode = '40001'; end if;
  return a;
end;
$$;

-- Rescheduling preserves agreed duration/price/name; service changes will be a
-- separate operation in appointment management, with an explicitly reviewed quote.
create function public.reschedule_appointment(p_id uuid, p_version integer, p_barber uuid, p_start timestamptz)
returns public.appointments language plpgsql volatile security definer set search_path = '' as $$
declare a public.appointments; cfg public.shop_settings; local_start timestamp;
begin
  perform private.require_staff();
  perform private.lock_schedule();
  select * into cfg from public.shop_settings where id;
  if p_start is null or not isfinite(p_start) or p_start < now() + cfg.minimum_notice_minutes * interval '1 minute'
    or p_start > now() + cfg.booking_horizon_days * interval '1 day' then
    raise exception 'Outside booking window' using errcode = '22023';
  end if;
  local_start := p_start at time zone cfg.timezone;
  if extract(second from local_start) <> 0 or mod((extract(hour from local_start)::integer * 60 + extract(minute from local_start)::integer),cfg.slot_interval_minutes) <> 0 then
    raise exception 'Start time is not on the booking grid' using errcode = '22023';
  end if;
  update public.appointments set barber_id = p_barber, starts_at = p_start, ends_at = p_start + duration_minutes * interval '1 minute'
    where id = p_id and version = p_version and status = 'confirmed' and starts_at > now() returning * into a;
  if not found then raise exception 'Appointment changed or cannot be rescheduled' using errcode = '40001'; end if;
  return a;
end;
$$;

-- Revoke PostgreSQL's default PUBLIC function execution, including private helpers.
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_staff(), private.is_admin() to authenticated;
revoke all on function public.create_guest_appointment(uuid,uuid,uuid,timestamptz,text,text,text) from public, anon, authenticated;
revoke all on function public.create_staff_appointment(uuid,uuid,uuid,timestamptz,text,text,text) from public, anon, authenticated;
revoke all on function public.set_appointment_status(uuid,integer,public.appointment_status) from public, anon, authenticated;
revoke all on function public.reschedule_appointment(uuid,integer,uuid,timestamptz) from public, anon, authenticated;
grant execute on function public.create_guest_appointment(uuid,uuid,uuid,timestamptz,text,text,text) to service_role;
grant execute on function public.create_staff_appointment(uuid,uuid,uuid,timestamptz,text,text,text) to authenticated;
grant execute on function public.set_appointment_status(uuid,integer,public.appointment_status) to authenticated;
grant execute on function public.reschedule_appointment(uuid,integer,uuid,timestamptz) to authenticated;

create function private.require_admin() returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid;
begin
  actor := private.require_staff();
  if not exists(select 1 from public.profiles where id=actor and role='admin') then
    raise exception 'Administrator access required' using errcode='42501';
  end if;
  return actor;
end;
$$;
revoke all on function private.require_admin() from public, anon, authenticated;

-- Validate the final schedule at transaction commit, so replacing a working week
-- does not fail on the temporary gap between DELETE and INSERT. The same lock
-- remains held until commit, and conflicts still roll back the whole transaction.
do $$ declare t text; begin
  foreach t in array array['shop_settings','barbers','barber_services','working_hours','blocked_times'] loop
    execute format('drop trigger check_schedule_edit on public.%I',t);
    execute format('create constraint trigger check_schedule_edit after insert or update or delete on public.%I deferrable initially deferred for each row execute function private.check_schedule_edit()',t);
  end loop;
end $$;

-- Optimistic revisions also change on trusted direct SQL edits.
do $$ declare t text; begin
  foreach t in array array['services','barbers','blocked_times','shop_settings'] loop
    execute format('alter table public.%I add column revision integer not null default 1 check(revision>0)',t);
  end loop;
end $$;
create function private.bump_revision() returns trigger language plpgsql set search_path='' as $$
begin new.revision := old.revision+1; return new; end;
$$;
revoke all on function private.bump_revision() from public,anon,authenticated;
do $$ declare t text; begin
  foreach t in array array['services','barbers','blocked_times','shop_settings'] loop
    execute format('create trigger bump_revision before update on public.%I for each row execute function private.bump_revision()',t);
  end loop;
end $$;

-- Local datetime strings are interpreted in the configured shop timezone, never
-- in the database/session/browser timezone. Reject nonexistent or ambiguous times.
create function private.shop_instant(p_local text) returns timestamptz language plpgsql stable security definer set search_path='' as $$
declare tz text; wall timestamp; instant timestamptz; delta interval;
begin
  select timezone into tz from public.shop_settings where id;
  if tz is null then raise exception 'Configure the shop timezone first' using errcode='22023'; end if;
  if p_local is null or p_local !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$' then raise exception 'Invalid local date and time' using errcode='22023'; end if;
  wall := p_local::timestamp;
  instant := wall at time zone tz;
  if to_char(wall,'YYYY-MM-DD"T"HH24:MI') <> p_local or instant at time zone tz <> wall then
    raise exception 'This local time does not exist due to a clock change' using errcode='22023';
  end if;
  foreach delta in array array[interval '30 minutes',interval '1 hour',interval '2 hours',interval '24 hours'] loop
    if (instant+delta) at time zone tz=wall or (instant-delta) at time zone tz=wall then
      raise exception 'This local time is ambiguous due to a clock change; choose another time' using errcode='22023';
    end if;
  end loop;
  return instant;
end;
$$;
revoke all on function private.shop_instant(text) from public,anon,authenticated;

-- One narrowly scoped administration RPC. Resource names and columns are fixed;
-- callers cannot choose a table, role, SQL expression, creator, or arbitrary field.
create function public.manage_shop(p_resource text,p_data jsonb) returns jsonb
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
      slot_interval_minutes=(p_data->>'slot_interval_minutes')::integer,booking_horizon_days=(p_data->>'booking_horizon_days')::integer
      where id returning to_jsonb(shop_settings.*) into result;
    -- booking_enabled is intentionally not writable until public booking is ready.
  else raise exception 'Unknown resource' using errcode='22023';
  end case;
  if result is null then raise exception 'Record changed or missing. Reload before saving.' using errcode='40001'; end if;
  return result;
end;
$$;
revoke all on function public.manage_shop(text,jsonb) from public,anon,authenticated;
grant execute on function public.manage_shop(text,jsonb) to authenticated;
notify pgrst, 'reload schema';

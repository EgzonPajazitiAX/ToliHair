-- Requires time_based_pricing. Only an explicit change of start/service requotes
-- an appointment; contact/status edits and settings changes keep its snapshot.
create function private.reprice_appointment_after_selection() returns trigger
language plpgsql security definer set search_path='' as $$
declare quoted bigint;
begin
  if new.service_id=old.service_id and exists (
    select 1 from public.appointment_services where appointment_id=old.id
  ) then
    select sum(private.price_at(s.price_minor,new.starts_at)) into quoted
    from public.appointment_services part join public.services s on s.id=part.service_id
    where part.appointment_id=old.id;
  else
    select private.price_at(s.price_minor,new.starts_at) into quoted
    from public.services s where s.id=new.service_id;
  end if;
  if quoted is null or quoted>2147483647 or quoted<0 then
    raise exception 'Selected services are too long or expensive' using errcode='22023';
  end if;
  new.price_minor:=quoted::integer;
  return new;
end;
$$;
revoke all on function private.reprice_appointment_after_selection() from public,anon,authenticated;
create trigger reprice_appointment_after_selection
before update of starts_at,service_id on public.appointments
for each row when ((new.starts_at,new.service_id) is distinct from (old.starts_at,old.service_id))
execute function private.reprice_appointment_after_selection();

-- Preserve every component when moving a multi-service appointment. A new
-- service selected by the single-service staff editor replaces the combination.
create or replace function private.sync_appointment_services_after_edit() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if (new.service_id,new.service_name,new.duration_minutes) is distinct from
     (old.service_id,old.service_name,old.duration_minutes)
     or not exists(select 1 from public.appointment_services where appointment_id=new.id) then
    delete from public.appointment_services where appointment_id=new.id;
    insert into public.appointment_services(appointment_id,service_id,position,service_name,duration_minutes,price_minor)
    values(new.id,new.service_id,1,new.service_name,new.duration_minutes,new.price_minor);
  elsif new.starts_at is distinct from old.starts_at then
    update public.appointment_services part set price_minor=private.price_at(s.price_minor,new.starts_at)
    from public.services s where part.appointment_id=new.id and s.id=part.service_id;
  end if;
  if (select sum(price_minor) from public.appointment_services where appointment_id=new.id)
     is distinct from new.price_minor::bigint then
    raise exception 'Appointment price breakdown mismatch' using errcode='22023';
  end if;
  return null;
end;
$$;
drop trigger sync_appointment_services_after_edit on public.appointments;
create trigger sync_appointment_services_after_edit
after update of starts_at,service_id,service_name,duration_minutes,price_minor on public.appointments
for each row when ((new.starts_at,new.service_id,new.service_name,new.duration_minutes,new.price_minor)
  is distinct from (old.starts_at,old.service_id,old.service_name,old.duration_minutes,old.price_minor))
execute function private.sync_appointment_services_after_edit();
notify pgrst,'reload schema';

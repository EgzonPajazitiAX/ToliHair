-- Every service belongs to every barber. Keep the join table because the
-- scheduling API already uses it efficiently, but maintain its full Cartesian
-- product inside the database instead of asking administrators to manage it.
create function private.assign_service_to_all_barbers() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.barber_services(barber_id, service_id)
  select b.id, new.id from public.barbers b
  on conflict do nothing;
  return new;
end;
$$;
revoke all on function private.assign_service_to_all_barbers() from public, anon, authenticated;

create function private.assign_all_services_to_barber() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.barber_services(barber_id, service_id)
  select new.id, s.id from public.services s
  on conflict do nothing;
  return new;
end;
$$;
revoke all on function private.assign_all_services_to_barber() from public, anon, authenticated;

create trigger assign_service_to_all_barbers
after insert on public.services
for each row execute function private.assign_service_to_all_barbers();

create trigger assign_all_services_to_barber
after insert on public.barbers
for each row execute function private.assign_all_services_to_barber();

-- Backfill every existing barber/service pair, including installations that
-- previously used manual assignments.
insert into public.barber_services(barber_id, service_id)
select b.id, s.id
from public.barbers b
cross join public.services s
on conflict do nothing;

-- The old management RPC may still receive a service_ids list. If it tries to
-- remove a valid pair, restore that pair at commit. Cascading parent deletion is
-- unaffected because the service or barber no longer exists at that point.
create function private.preserve_universal_service_assignment() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists(select 1 from public.barbers where id = old.barber_id)
    and exists(select 1 from public.services where id = old.service_id) then
    insert into public.barber_services(barber_id, service_id)
    values(old.barber_id, old.service_id)
    on conflict do nothing;
  end if;
  return null;
end;
$$;
revoke all on function private.preserve_universal_service_assignment() from public, anon, authenticated;

create constraint trigger preserve_universal_service_assignment
after delete on public.barber_services
deferrable initially deferred
for each row execute function private.preserve_universal_service_assignment();

notify pgrst, 'reload schema';

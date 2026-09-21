-- Single shop, explicit privileges, no public customer access.
create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
set search_path = public, extensions;

create type public.staff_role as enum ('admin', 'staff');
create type public.appointment_status as enum ('confirmed', 'cancelled', 'completed', 'no_show');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) between 2 and 120),
  role public.staff_role not null default 'staff',
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shop_settings (
  id boolean primary key default true check (id),
  name text not null default 'Toli Hair' check (char_length(btrim(name)) between 1 and 120),
  phone text,
  address text,
  timezone text,
  currency text check (currency ~ '^[A-Z]{3}$'),
  booking_enabled boolean not null default false,
  slot_interval_minutes integer not null default 15 check (slot_interval_minutes between 5 and 120),
  minimum_notice_minutes integer not null default 60 check (minimum_notice_minutes between 0 and 10080),
  booking_horizon_days integer not null default 60 check (booking_horizon_days between 1 and 365),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not booking_enabled or (timezone is not null and currency is not null))
);
insert into public.shop_settings (id) values (true);

create table public.barbers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete set null,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  bio text not null default '' check (char_length(bio) <= 2000),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  duration_minutes integer not null check (duration_minutes between 5 and 480),
  price_minor integer not null check (price_minor >= 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.barber_services (
  barber_id uuid not null references public.barbers(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  primary key (barber_id, service_id)
);
create index barber_services_service_idx on public.barber_services(service_id, barber_id);

create table public.working_hours (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null references public.barbers(id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time),
  check (extract(second from start_time) = 0 and extract(second from end_time) = 0),
  exclude using gist (
    barber_id with =, weekday with =,
    (int4range(extract(epoch from start_time)::integer, extract(epoch from end_time)::integer, '[)')) with &&
  )
);
create index working_hours_barber_day_idx on public.working_hours(barber_id, weekday);

create table public.blocked_times (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null references public.barbers(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text not null default '' check (char_length(reason) <= 500),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (isfinite(starts_at) and isfinite(ends_at) and ends_at > starts_at)
);
create index blocked_times_range_idx on public.blocked_times using gist (barber_id, tstzrange(starts_at, ends_at, '[)'));
create index blocked_times_creator_idx on public.blocked_times(created_by);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null references public.barbers(id) on delete restrict,
  service_id uuid not null references public.services(id) on delete restrict,
  customer_name text not null check (char_length(btrim(customer_name)) between 2 and 120),
  customer_phone text not null check (char_length(customer_phone) between 6 and 30 and customer_phone ~ '^\+?[0-9 ()-]+$'),
  customer_email text check (char_length(customer_email) <= 254 and customer_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.appointment_status not null default 'confirmed',
  service_name text not null,
  duration_minutes integer not null check (duration_minutes between 5 and 480),
  price_minor integer not null check (price_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  source text not null check (source in ('online', 'staff')),
  created_by uuid references public.profiles(id) on delete set null,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (isfinite(starts_at) and isfinite(ends_at) and ends_at > starts_at),
  check (ends_at = starts_at + duration_minutes * interval '1 minute'),
  constraint appointments_no_overlap exclude using gist (
    barber_id with =, (tstzrange(starts_at, ends_at, '[)')) with &&
  ) where (status <> 'cancelled')
);
create index appointments_barber_start_idx on public.appointments(barber_id, starts_at);
create index appointments_status_start_idx on public.appointments(status, starts_at);
create index appointments_start_idx on public.appointments(starts_at);
create index appointments_service_idx on public.appointments(service_id);
create index appointments_creator_idx on public.appointments(created_by);

create table public.booking_requests (
  idempotency_key uuid primary key,
  request_hash text not null,
  appointment_id uuid not null references public.appointments(id) on delete restrict,
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now()
);
create index booking_requests_expiry_idx on public.booking_requests(expires_at);
create index booking_requests_appointment_idx on public.booking_requests(appointment_id);

create function private.is_staff() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = auth.uid() and is_active);
$$;
create function private.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = auth.uid() and is_active and role = 'admin');
$$;
revoke all on function private.is_staff(), private.is_admin() from public, anon;
grant execute on function private.is_staff(), private.is_admin() to authenticated;

do $$
declare t text;
begin
  foreach t in array array['profiles','shop_settings','barbers','services','barber_services','working_hours','blocked_times','appointments','booking_requests'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    if t <> 'booking_requests' then
      execute format('grant select on public.%I to authenticated', t);
      if t = 'profiles' then
        execute 'create policy profiles_read on public.profiles for select to authenticated using (id = (select auth.uid()) or (select private.is_admin()))';
      else
        execute format('create policy staff_read on public.%I for select to authenticated using ((select private.is_staff()))', t);
      end if;
    end if;
  end loop;
end $$;

create function private.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = clock_timestamp(); return new; end;
$$;
do $$
declare t text;
begin
  foreach t in array array['profiles','shop_settings','barbers','services','working_hours','blocked_times','appointments'] loop
    execute format('create trigger touch_updated_at before update on public.%I for each row execute function private.touch_updated_at()', t);
  end loop;
end $$;
revoke all on function private.touch_updated_at() from public, anon, authenticated;
reset search_path;

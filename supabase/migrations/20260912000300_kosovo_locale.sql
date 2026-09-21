-- Toli Hair operates in Kosovo. Keep scheduling and money in one fixed locale,
-- including requests that bypass the application UI and call the admin RPC.
create function private.enforce_shop_locale()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.timezone := 'Europe/Belgrade';
  new.currency := 'EUR';
  return new;
end;
$$;

create trigger enforce_shop_locale
before insert or update on public.shop_settings
for each row execute function private.enforce_shop_locale();

update public.shop_settings
set timezone='Europe/Belgrade', currency='EUR'
where id;
set constraints all immediate;

alter table public.shop_settings alter column timezone set not null;
alter table public.shop_settings alter column currency set not null;
alter table public.shop_settings add constraint shop_settings_kosovo_timezone check (timezone='Europe/Belgrade');
alter table public.shop_settings add constraint shop_settings_euro_currency check (currency='EUR');

revoke all on function private.enforce_shop_locale() from public, anon, authenticated;
notify pgrst, 'reload schema';

# Database foundation (Phase 3)

## Apply to Supabase

1. In Supabase > Connect, obtain the PostgreSQL URL. Use the session pooler if the
   direct database hostname is not reachable over IPv4. URL-encode the password.
2. Set `SUPABASE_DB_URL` in the ignored root `.env` file. Do not send it in chat.
3. Run `npm run db:migrate`. All pending migrations and migration-history entries
   commit together, or roll back together. Existing application tables are never
   dropped or overwritten. A conflicting pre-existing schema fails safely.
4. Run `npm run supabase:check` for Auth API reachability (not schema verification).

The migration runner uses Supabase's `supabase_migrations.schema_migrations`
history table, and never logs credentials. It uses verified TLS for remote DBs.
The official Supabase production CA is included in `certs/prod-ca-2021.crt`
and loaded by `scripts/db-tls.mjs` for migration and verification connections.
If the provider requires its own CA, configure `NODE_EXTRA_CA_CERTS` with that
certificate; do not disable certificate verification. Never edit applied migrations.

`SUPABASE_URL` and `SUPABASE_KEY` configure the public connection. A publishable
key does not provide DDL access. `SUPABASE_SECRET_KEY` is reserved for privileged
server-side RPC in later phases, and is not a substitute for the DB connection URL.

## Scope and defaults

- Ten tables: profiles, shop_settings, barbers, services, barber_services,
  working_hours, blocked_times, appointments, appointment_services and booking_requests.
- One shop, up to ten services per appointment, ISO weekday 1–7. Split same-day shifts
  represent breaks. No overnight shifts; an end of 24:00 is allowed.
- Appointment instants are timestamptz; recurring hours are shop-local times.
- Shop timezone and currency start NULL; online booking starts disabled.
- Slot interval 15 minutes, notice 60 minutes, horizon 60 days are provisional
  editable defaults. No sample services, prices, staff, or hours are seeded remotely.
- All application tables have RLS. Anonymous users have no table grants.
  Active staff can read operational tables; ordinary staff see only their profile.
  Administrators may read staff profiles. Profile writes/role escalation are denied.
- Customers have no accounts. Phone/name/email belong to each appointment.
- Direct authenticated writes are denied. Future Nuxt APIs must verify the staff
  session and call authorized RPCs; they must not use the service key for all staff work.

## Scheduling contract

`create_guest_appointment` is executable only by service_role; Nuxt will call it
after rate limiting and validation in Phase 6. It is not a browser RPC.
`create_staff_appointment`, `reschedule_appointment`, and `set_appointment_status`
require an active authenticated staff profile. Manual creation uses the same
booking window as online creation, but works when online booking is disabled.

A single shop-wide advisory transaction lock serializes schedule mutations.
Statement triggers enforce that lock for privileged writes as well. Reads used
to validate scheduling occur after acquiring it. This keeps working-hour changes,
blocks, deactivation, and bookings consistent under concurrent READ COMMITTED
transactions. At higher isolation levels callers must also handle serialization
failures. PostgreSQL's GiST exclusion constraint independently prevents overlapping
non-cancelled appointments, using end-exclusive ranges.

Schedule changes conflicting with future/ongoing confirmed appointments fail;
staff must explicitly resolve affected bookings first. Service price/duration/name
changes leave historical booking snapshots untouched. Rescheduling preserves that
quote. Changes of service and customer-contact editing are deferred to appointment
management. Finalized appointments cannot be edited; cancellation frees the slot.
Completed/no-show appointments cannot be marked before their start.

Idempotency keys are UUIDs with an internal SHA-256 hash of the normalized request,
including caller/source. Repeated identical requests return the same appointment;
different content fails. Expiry is a retention marker, not automatic deletion.
Do not purge live requests until the booking retry/receipt retention policy is set.

Suggested API error mapping: `23P01`/`23505`/`40001` => 409,
`22023`/`23514` => 422, `42501` => 403. Do not expose SQL errors or rows directly.

## Staff bootstrap and later phases

No user is automatically an administrator. In Phase 4, disable public Auth signup
in the hosted project, create the first staff account through Supabase Auth, then
provision its matching active admin profile through trusted administrative SQL.
`config.toml` disables signup for the local stack only; it does not change hosted
Auth settings. Never derive a role from editable user metadata.

Admin service/barber/schedule CRUD RPCs will be introduced in Phase 5, followed by
Nuxt availability/booking routes and receipt handling in Phase 6. Do not enable
online booking merely because migrations have been applied.

## Reproduce database tests

Docker Desktop must be running. The following container contains only disposable
test data, bound to loopback. Use a fresh container; the test never resets a DB.

```sh
docker run --detach --rm --name tolihair-db-test --publish 127.0.0.1:55439:5432 --env POSTGRES_HOST_AUTH_METHOD=trust --env POSTGRES_DB=tolihair_test postgres:17
npm run db:test
docker stop tolihair-db-test
```

Tests use vanilla PostgreSQL with minimal auth roles/`auth.uid()` fixtures. They
exercise real PostgreSQL RLS and constraints, but are not a full Supabase Auth or
PostgREST integration test. Never apply `tests/bootstrap.sql` to a hosted project.

`server/types/database.types.ts` is generated from the migrated local database
with `supabase gen types typescript --db-url <local-url> --schema public`.

# Phase 5: shop management

Active administrators can manage `/dashboard/services`, `/dashboard/barbers`,
`/dashboard/working-hours`, `/dashboard/blocked-times`, and `/dashboard/settings`.
Ordinary staff cannot read these configuration APIs or mutate configuration.

## Initial setup

1. Set the shop name, contact information, slot interval, minimum booking notice
   and booking horizon in Settings. The Kosovo timezone and EUR are fixed.
2. Create services with prices and durations.
3. Create barbers and assign the services each performs.
4. Save each barber's weekly hours. Multiple intervals represent breaks;
   days with no intervals are closed. `24:00` is permitted as a closing time.
5. Add absences/holidays as blocked intervals for one barber or the entire shop.

Blocked intervals use the shop timezone, not the browser timezone. Their end is
exclusive: a full day runs from midnight to midnight the following day. Invalid
or ambiguous daylight-saving wall times are rejected. Services/barbers can be
deactivated; blocked intervals can be removed after confirmation.

Creating a barber does not create a staff login. Booking enablement remains
disabled until the public booking phase; this UI does not enable it.

## Integrity and security

The versioned `manage_shop` database function checks administrator membership,
uses a scheduling lock, validates explicit fields, and commits changes atomically.
Revision checks reject stale edits with HTTP 409; reload current data before retrying.
Weekly hours are replaced atomically. Deferred schedule checks prevent edits that
invalidate confirmed appointments. Existing appointment price/duration snapshots
are preserved. The database enforces `Europe/Belgrade` (Kosovo CET/CEST rules)
and `EUR`; neither can be changed by the UI or a modified API request.

The server requires same-origin mutation requests, validates strict Zod schemas,
limits request size, and sanitizes database errors. Only configuration columns
are returned; customer details and authentication credentials are not included.

## Verification

```sh
npm run lint
npm run typecheck
npm run build
npm run test:auth
```

The HTTP suite uses an isolated Supabase fixture and the production build.
Database tests require a fresh disposable PostgreSQL 17 instance on loopback
port 55439, database `tolihair_test`, user `postgres`, trust authentication.
Never point them at the hosted project; their target is hardcoded locally.

```sh
npm run db:test
npm run test:management:db
```

The foundation suite applies all migrations and runs 32 assertions. The management
suite then runs 26 checks and rolls back its data. Tests cover roles, revisions,
assignments, schedule conflicts, block CRUD, settings, and daylight-saving changes.
HTTP tests also exercise management authorization, CSRF, validation, size limits,
successful RPC dispatch, conflict responses, and safe error messages.

# Toli Hair — Faza 9: gati për publikim

Nuxt 4, Vue 3, TypeScript, and Nuxt UI barbershop application.

The foundation includes responsive public/auth/dashboard layouts, route shells,
theme, shared customer validation, runtime configuration, and developer tooling.
The Phase 3 migrations are applied to Supabase. Staff login/logout, server-managed
sessions, and role-based dashboard access are implemented. The customer-facing
interactive booking flow, public catalog, availability, booking and receipt APIs,
and administrator enablement are implemented; see [public booking](docs/booking.md).

See [database setup and tests](supabase/README.md). Run `npm run supabase:check`
to verify Auth API reachability and `npm run db:migrate` to apply pending migrations.

See [staff authentication](docs/auth.md) for account setup, deployment, and tests.
See [deployment and release verification](docs/deployment.md) for the production checklist, Docker image, health checks, and rollback procedure.

## Current behavior

`/login` signs confirmed, active staff into the protected dashboard. Dashboard
services, barbers, working hours, blocked times, and settings are editable by admins.
The home-page hero provides a responsive five-step Albanian booking flow and a
private confirmation receipt. The dashboard now includes the daily overview, appointment
filters and actions, manual booking, editing, and daily/weekly calendar views; see
[appointment management](docs/appointments.md).

Anonymous dashboard page requests redirect to `/login`; dashboard APIs return 401.
Admin-only sections return 403 for ordinary staff. This applies in development
and production; there is no preview bypass.

## Application structure

- `app/pages`: routes; `app/layouts`: public, auth, and dashboard shells.
- `app/components`: common, public, booking, and dashboard UI.
- `app/constants/dashboard.ts`: dashboard navigation and section copy.
- `app/assets/css/main.css`: typography, theme, and accessibility styles.
- `app/middleware`: client navigation gate.
- `server/middleware`: staff authorization and no-cache headers.
- `server/api/auth`: login, logout, and current staff identity.
- `server/utils/supabase.ts`: public and privileged typed server clients.
- `server/types/database.types.ts`: generated database types.
- `supabase/migrations`: relational schema, RLS, transactional booking functions.
- `scripts`: connection checks, migration runner, isolated PostgreSQL tests.
- `shared/schemas`: Zod validation safe to share across client and server.

Management repositories, database migrations, and integration tests are included.

## Configuration and checks

`.env.example` documents runtime variable names. Keep your existing `.env` values
and add the required variables as needed. Never commit credentials. `SUPABASE_SECRET_KEY`
is private server configuration and must never use a `NUXT_PUBLIC_` prefix or be
placed in `runtimeConfig.public`. The shop uses Kosovo's CET/CEST rules
(`Europe/Belgrade`) and EUR server-side.

```sh
npm run lint
npm run typecheck
npm run build
npm run verify:release
```

`npm run lint:fix` applies automatic lint corrections. Use a server deployment:
static generation alone cannot run the future booking APIs.

## Next phases

3. Database schema, constraints, RLS, and transactional functions (applied).
4. Staff authentication and authorization (implemented).
5. Shop configuration and schedules (implemented).
6. Availability and booking APIs with concurrency tests (implemented).
7. Full public website and interactive booking (implemented).
8. Appointment management and calendar (implemented).
9. Release verification and deployment preparation (implemented).

## Setup

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.

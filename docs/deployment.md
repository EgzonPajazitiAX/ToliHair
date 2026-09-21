# Publikimi i Toli Hair

Ky aplikacion duhet të publikohet si server Node/Nitro. Eksportimi statik nuk mbështet API-të, autentikimin dhe rezervimet.

## Kërkesat

- Node.js 22–24 ose Docker.
- Një projekt Supabase me regjistrimin publik të përdoruesve të çaktivizuar.
- Domain me HTTPS.
- Të gjitha migrimet e aplikuara para nisjes së versionit të ri.

## Variablat e ambientit

Vendosini në panelin privat të ofruesit; mos e publikoni skedarin `.env` dhe mos i vendosni në imazhin Docker.

Për runtime-in e build-it ose container-it përdorni emrat standardë të Nuxt-it:

```text
NUXT_PUBLIC_SUPABASE_URL=https://PROJECT.supabase.co
NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
NUXT_SUPABASE_SECRET_KEY=sb_secret_...
NUXT_APP_ORIGIN=https://domaini-juaj.example
```

Për komandat lokale ekzistuese mbështeten edhe `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SECRET_KEY` dhe `APP_ORIGIN` nga `.env`. Në një build të prodhimit preferoni gjithmonë emrat `NUXT_*`, sepse mund të injektohen në mënyrë të sigurt kur nis serveri pa i futur sekretet në imazh.

```text
SUPABASE_DB_URL=postgresql://...
```

`SUPABASE_DB_URL` nevojitet vetëm për migrim dhe verifikim, jo për procesin e aplikacionit. Në runtime mund ta hiqni pasi migrimi të ketë përfunduar. Fjalëkalimi brenda URL-së duhet të jetë URL-encoded.

Ekzekutoni lokalisht `npm run check:release-env` para publikimit. Komanda kontrollon vetëm strukturën dhe përputhjen e konfigurimit; nuk i afishon vlerat sekrete.

## Rendi i publikimit

1. Krijoni një backup ose konfirmoni që point-in-time recovery është aktiv në Supabase.
2. Ekzekutoni `npm ci` dhe `npm run verify:release`.
3. Ekzekutoni `npm run db:migrate`. Migrimet kryhen në një transaksion dhe rikthehen tërësisht në rast gabimi.
4. Ekzekutoni `npm run db:verify`.
5. Publikoni serverin ose imazhin Docker.
6. Kontrolloni `GET /api/health`, faqen kryesore, një rezervim prove dhe hyrjen e stafit.

Mos aktivizoni rezervimin publik derisa shërbimet, berberët dhe oraret reale të jenë konfiguruar në panel.

## Docker

```sh
docker build -t tolihair .
docker run --rm -p 3000:3000 \
  -e NUXT_PUBLIC_SUPABASE_URL \
  -e NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY \
  -e NUXT_SUPABASE_SECRET_KEY \
  -e NUXT_APP_ORIGIN \
  tolihair
```

Imazhi ekzekutohet si përdorues jo-root dhe ka healthcheck të integruar. Terminoni TLS-në te reverse proxy/platforma dhe përcillni kërkesat drejt portit `3000`.

## Kontrolli pas publikimit

- `/` paraqet rezervimin në seksionin e parë dhe e ngarkon katalogun.
- `/booking` ridrejton te `/#rezervo`.
- `/login` lejon vetëm staf aktiv.
- `/dashboard` ridrejton vizitorët anonimë dhe nuk cache-ohet.
- `/api/health` kthen `{"status":"ok"}` pa zbuluar konfigurim.
- Header-at `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` dhe `Permissions-Policy` janë aktivë; HSTS aktivizohet kur `APP_ORIGIN` është HTTPS.

## Rikthimi

Nëse versioni i ri dështon, riktheni menjëherë aplikacionin te imazhi/build-i i mëparshëm. Mos ndryshoni dhe mos fshini një migrim të aplikuar. Për ndryshime të databazës përdorni një migrim të ri korrigjues; restaurimi i backup-it rezervohet për humbje ose dëmtim real të të dhënave.

## Kufijtë operacionalë

Rate limiting është në memorien e një procesi. Versioni aktual duhet të ekzekutohet si një instancë e vetme. Para shkallëzimit horizontal, kalojeni rate limiting në një ruajtje të përbashkët si Redis ose mekanizëm ekuivalent të platformës.

# Fazat 6–7: rezervimet publike

Faza 6 implementon pjesën e serverit, ndërsa Faza 7 ofron ndërfaqen e plotë
publike në shqip. Klienti kalon në pesë hapa: shërbimi, berberi, data dhe ora,
të dhënat e kontaktit dhe konfirmimi. Pas krijimit shfaqet fatura e rezervimit.

Ndërfaqja përdor vetëm katalogun dhe oraret e kthyera nga serveri. Tokeni privat
i faturës ruhet përkohësisht në `sessionStorage` dhe dërgohet në trupin e kërkesës;
nuk shfaqet në URL, histori të shfletuesit ose tekstin e faqes.

## Konfigurimi i domosdoshëm

Krijimi i rezervimeve dhe leximi i konfirmimeve përdorin një Supabase secret key
vetëm në server. Vendoseni në `.env` dhe në variablat private të ambientit ku
aplikacioni publikohet:

```dotenv
SUPABASE_SECRET_KEY=
```

Ky çelës ka privilegje të larta: mos përdorni prefiksin `NUXT_PUBLIC_`, mos e
vendosni në kodin e klientit dhe mos e publikoni. Aplikacioni refuzon aktivizimin
e rezervimeve nëse çelësi mungon. Pas konfigurimit, administratori mund t’i
aktivizojë te Paneli → Cilësimet, pasi të ketë së paku një shërbim aktiv, një
berber aktiv, caktimin e shërbimit dhe orarin e punës.

## Kontrata e API-së

- `GET /api/booking/catalog` kthen vetëm konfigurimin publik, shërbimet aktive
  dhe berberët aktivë. Nuk kthen termine ose të dhëna klientësh.
- `GET /api/booking/availability?serviceId=…&date=YYYY-MM-DD&barberId=…`
  kthen oraret e lira. `barberId` është opsional.
- `POST /api/booking` krijon një termin me çelës UUID idempotence, shërbimin,
  berberin, kohën ISO dhe të dhënat e klientit.
- `POST /api/booking/receipt` lexon konfirmimin përmes tokenit të fshehtë të
  faturës. Tokeni dërgohet në trupin JSON dhe nuk vendoset në URL.
- `POST /api/dashboard/booking-status` aktivizon ose çaktivizon rezervimet;
  kërkon administrator të autentikuar dhe revision aktual.

Të gjitha përgjigjet e rezervimit dhe faturës përdorin `Cache-Control: no-store`.
Mutacionet kërkojnë origjinë të njëjtë, kokën `x-toli-request`, JSON, madhësi të
kufizuar dhe validim Zod. Përgjigjet nuk ekspozojnë gabime SQL ose rreshta të
plotë me të dhëna personale.

## Saktësia e disponueshmërisë

PostgreSQL gjeneron kandidatët në kohë absolute UTC dhe i paraqet sipas zonës
kohore të berberhanes. Kjo i kap saktë orët që mungojnë ose përsëriten gjatë
ndryshimit veror/dimëror. Llogaritja merr parasysh:

- kohëzgjatjen dhe statusin e shërbimit;
- shërbimet që ofron secili berber dhe statusin e tij;
- orarin e punës dhe intervalin e termineve;
- njoftimin minimal dhe horizontin e rezervimeve;
- bllokimet dhe të gjitha terminet jo të anuluara.

Disponueshmëria është vetëm informacion paraprak. Krijimi e kontrollon sërish
orarin brenda një transaksioni me advisory lock dhe kufizim GiST, prandaj dy
kërkesa paralele nuk mund ta rezervojnë të njëjtin interval. Çelësi idempotence
e bën riprovimin e së njëjtës kërkesë të sigurt.

Kufizimi i kërkesave është i ndarë për katalogun, disponueshmërinë, rezervimin
dhe faturën. Implementimi aktual është i kufizuar dhe në memorie për publikim
me një instancë. Para shkallëzimit horizontal duhet kaluar në një depo të
përbashkët, si Redis ose shërbimi i platformës.

## Testet

Me një PostgreSQL 17 të disponueshëm vetëm lokalisht në portin `55439`:

```sh
npm run db:test
npm run test:management:db
npm run test:booking:db
npm run test:auth
npm run lint
npm run typecheck
npm run build
```

Testet e rezervimit mbulojnë lejet anonime, katalogun, terminet e lira,
bllokimet, idempotencën, tokenin e faturës dhe orën e përsëritur gjatë kalimit
në orën dimërore. Testet ekzistuese të bazës mbulojnë edhe garën reale të dy
lidhjeve për të njëjtin interval.

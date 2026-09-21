# Menaxhimi i termineve

Faza 8 shton menaxhimin e plotë të termineve për stafin e autentikuar.

## Funksionet

- Përmbledhja e panelit paraqet terminet dhe statistikat e ditës.
- Lista e termineve filtron sipas datës, berberit, statusit dhe klientit.
- Stafi mund të krijojë termine manuale dhe të ndryshojë termine të ardhshme.
- Oraret e lira respektojnë shërbimin, berberin, orarin e punës, bllokimet dhe terminet ekzistuese.
- Terminet mund të anulohen; pas fillimit mund të shënohen si të përfunduara ose si mungesë.
- Kalendari ofron pamje ditore dhe javore, të përshtatshme edhe për ekranet e vogla.

## Siguria dhe integriteti

API-të kërkojnë staf aktiv, ndërsa kërkesat që ndryshojnë të dhëna mbrohen nga kontrolli i origjinës. Funksionet `SECURITY DEFINER` verifikojnë rolin përsëri në bazën e të dhënave. Krijimi dhe ndryshimi bëhen në transaksion, kontrollojnë konfliktet e orarit dhe përdorin versionim optimist për të parandaluar mbishkrimin e ndryshimeve të njëkohshme.

Të dhënat e çmimit, kohëzgjatjes dhe emrit të shërbimit ruhen si fotografi e marrëveshjes së terminit. Kur shërbimi ndryshohet me vetëdije, fotografia rifreskohet nga shërbimi aktiv i zgjedhur.

## Kontrollet lokale

Përdorni një PostgreSQL lokal të dedikuar në portin `55439`, pastaj ekzekutoni:

```sh
npm run db:test
npm run test:appointments:db
npm run test:auth
```

Testet mbulojnë autorizimin, filtrimin, disponueshmërinë gjatë ndryshimit, krijimin manual, versionimin, ndryshimet e statusit, validimin dhe mbrojtjen CSRF.

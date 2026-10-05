# Dokumentet ligjore — shqyrtimi para publikimit

Versioni i hartuar: 04/10/2026. Faqet janë paraprake dhe kanë `noindex, follow` deri në verifikim. Kjo nuk kufizon qasjen publike: mos i trajtoni si politika përfundimtare. Nuk janë publikuar në Vercel nga ky ndryshim.

## Konfirmime nga operatori

- Emri i plotë ligjor i kontrolluesit/operatorit, forma juridike, adresa dhe identifikuesi i biznesit sipas kërkesave të zbatueshme.
- Telefon dhe email funksional për privatësinë/ankesat; verifikoni edhe kontaktin që shfaqet në faqen kryesore.
- Afatet e ruajtjes për klientë, termine, regjistra teknikë dhe kopje rezervë. Kodi nuk fshin automatikisht terminet pas përfundimit/anulimit. Përcaktoni dhe zbatoni një procedurë reale për fshirje/anonimizim, përfshirë kopjet e fushave të klientit në termine.
- Procedura e trajtimit të kërkesave të privatësisë, verifikimi proporcional i identitetit dhe afatet ligjore të përgjigjes.
- Kushtet e anulimit, vonesave, pagesës dhe çdo tarife; drafti nuk shpik penalitete ose afate anulimi.
- Konfigurimi real i Vercel/Supabase, rajonet, marrëveshjet e përpunimit, nënkontraktorët dhe baza/garancitë e transferimeve jashtë Kosovës. Mos supozoni vendndodhje vetëm nga kodi.
- Kontrolloni në dashboard-in e hostimit nëse janë aktivizuar analitika ose shtesa jashtë kodit.
- Google Maps aktualisht ngarkohet si iframe; ikonat mund të kërkohen nga Iconify. Vlerësoni cookies dhe pëlqimin e nevojshëm; teksti i privatësisë nuk zëvendëson një mekanizëm pëlqimi. Nëse nevojitet, përdorni hartë që ngarkohet vetëm pas veprimit/pëlqimit dhe ikona lokale.

## Përfundimi

Shqyrtojini dokumentet me një jurist që njeh legjislacionin e Kosovës dhe praktikat konkrete të biznesit. Pastaj plotësoni identitetin/kontaktin, afatet dhe transferimet, hiqni shënimet paraprake dhe `noindex` në dy faqet, përditësoni datën në komponentin `PublicLegalPage` dhe ruani versionin e miratuar. Vendosni një njoftim të lidhur me privatësinë pranë mbledhjes së të dhënave të rezervimit përpara publikimit përfundimtar; mos e ngatërroni pranimin e kushteve me pëlqimin për marketing.

## Burime dhe sjellja e verifikuar

- Ligji nr. 06/L-082: https://gzk.rks-gov.net/ActDetail.aspx?ActID=18616
- AIP: https://aip.rks-gov.net/
- Supabase: https://supabase.com/privacy
- Vercel: https://vercel.com/legal/privacy-notice
- Formulari: `shared/schemas/customer.ts`; krijimi i terminit: `app/composables/useBooking.ts` dhe `server/api/booking/index.post.ts`.
- Konfirmimi/anulimi: `app/pages/booking/success.vue`; cookies e stafit: `server/utils/auth.ts`; kufizimi i kërkesave: `server/utils/booking-limiter.ts`.
- Nuk u shtuan mekanizma pëlqimi, pagesash, fshirjeje ose anulimi: këto janë çështje të veçanta nga krijimi i dy faqeve informuese.

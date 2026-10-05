<script setup lang="ts">
useSeoMeta({ title: 'Politika e privatësisë | Toli Hair', description: 'Si trajtohen të dhënat gjatë rezervimit të një termini te Toli Hair.', robots: 'noindex, follow' })
const sections = [
  { id: 'pergjegjesia', title: 'Përgjegjësia dhe kontakti' },
  { id: 'te-dhenat', title: 'Të dhënat që përpunohen' },
  { id: 'qellimi', title: 'Pse përdoren të dhënat' },
  { id: 'ofruesit', title: 'Qasja dhe ofruesit teknikë' },
  { id: 'ruajtja', title: 'Ruajtja e të dhënave' },
  { id: 'shfletuesi', title: 'Cookies dhe shërbimet e jashtme' },
  { id: 'te-drejtat', title: 'Të drejtat e tua' },
  { id: 'siguria', title: 'Siguria dhe përditësimet' },
]
</script>

<template>
  <PublicLegalPage title="Politika e privatësisë" description="Këtu shpjegojmë çfarë të dhënash përdoren kur rezervon te Toli Hair, për çfarë shërbejnë dhe si mund të na kontaktosh për to." icon="i-lucide-shield-check" :sections="sections">
    <section id="pergjegjesia">
      <h2>1. Përgjegjësia dhe kontakti</h2>
      <p>Kjo politikë përshkruan përdorimin e faqes dhe rezervimet e berberhanes Toli Hair në Kosovë. Për pyetje mbi të dhënat e tua, kontakto berberhanen nëpërmjet <NuxtLink to="/#kontakti">të dhënave të kontaktit në faqe</NuxtLink> ose drejtpërdrejt në lokal.</p>
      <p>Dokumenti është version për shqyrtim. Identiteti i plotë ligjor i operatorit, kontakti i dedikuar për privatësinë dhe afatet konkrete të ruajtjes duhet të konfirmohen për versionin përfundimtar.</p>
    </section>
    <section id="te-dhenat">
      <h2>2. Të dhënat që përpunohen</h2>
      <ul>
        <li><strong>Kontakti:</strong> emri dhe mbiemri, numri i telefonit dhe emaili, nëse zgjedh ta japësh. Emri dhe telefoni kërkohen për rezervimin; emaili është opsional.</li>
        <li><strong>Termini:</strong> berberi, shërbimet, data, ora, kohëzgjatja, çmimi, numri i rezervimit dhe statusi, për shembull i konfirmuar, i përfunduar ose i anuluar.</li>
        <li><strong>Të dhëna teknike:</strong> adresa IP, koha e kërkesës dhe të dhëna të pajisjes ose shfletuesit mund të përpunohen nga infrastruktura për funksionimin, diagnostikimin dhe sigurinë e faqes.</li>
      </ul>
      <p>Rezervimi nuk kërkon llogari klienti. Formulari nuk kërkon dokument identifikimi, të dhëna shëndetësore ose të dhëna karte bankare. Mos vendos informacione të tilla në fushat e rezervimit.</p>
    </section>
    <section id="qellimi">
      <h2>3. Pse përdoren të dhënat</h2>
      <p>Emri, kontakti dhe zgjedhjet e tua përdoren për të regjistruar terminin, organizuar orarin e berberit dhe komunikuar për ndryshime ose pyetje lidhur me rezervimin. Përpunimi i nevojshëm për rezervimin lidhet me kërkesën tënde për shërbim.</p>
      <p>Kontrollet kundër kërkesave abuzive mbështesin sigurinë dhe funksionimin e sistemit. Kur zbatohet një detyrim ligjor, të dhënat përkatëse mund të trajtohen edhe për atë qëllim. Formulari i rezervimit nuk të regjistron në ndonjë listë marketingu.</p>
    </section>
    <section id="ofruesit">
      <h2>4. Qasja dhe ofruesit teknikë</h2>
      <p>Paneli i menaxhimit është i kufizuar për stafin e autorizuar. Shërbimet teknike që përdor aplikacioni përfshijnë:</p>
      <ul>
        <li><strong>Supabase:</strong> baza e të dhënave të rezervimeve dhe identifikimi i stafit. <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer">Politika e Supabase</a>.</li>
        <li><strong>Vercel:</strong> hostimi dhe përpunimi i kërkesave të faqes. <a href="https://vercel.com/legal/privacy-notice" target="_blank" rel="noopener noreferrer">Politika e Vercel</a>.</li>
      </ul>
      <p>Këta ofrues mund të përpunojnë të dhëna jashtë Kosovës. Rajonet, nënkontraktorët dhe garancitë për transferimet duhen verifikuar sipas konfigurimit dhe marrëveshjeve të biznesit; kjo faqe nuk pohon se të dhënat ruhen vetëm në Kosovë.</p>
      <p>Të dhëna mund t’u jepen autoriteteve kompetente kur kërkohet ligjërisht. Përmbledhja e rezervimit nuk është një listë publike e klientëve.</p>
    </section>
    <section id="ruajtja">
      <h2>5. Ruajtja e të dhënave</h2>
      <p>Anulimi ose përfundimi i një termini ndryshon statusin e tij dhe nuk i fshin automatikisht të dhënat. Versioni aktual i sistemit nuk ka një afat të konfiguruar për fshirje automatike të rezervimeve.</p>
      <p>Afati i ruajtjes duhet të përcaktohet sipas nevojës për administrimin e rezervimeve, trajtimin e ankesave dhe detyrimeve ligjore të zbatueshme. Për të kërkuar fshirje ose informacion për të dhënat e tua, kontakto Toli Hair. Kopjet rezervë dhe regjistrat teknikë mund të ndjekin cikle të veçanta të ofruesve.</p>
    </section>
    <section id="shfletuesi">
      <h2>6. Cookies dhe shërbimet e jashtme</h2>
      <p>Pas rezervimit, shfletuesi ruan përkohësisht një kod për të rihapur konfirmimin në të njëjtën skedë. Ai hiqet kur nis një rezervim të ri dhe zakonisht kur mbyllet sesioni i skedës. Fshirja e tij nga shfletuesi nuk e anulon ose fshin terminin nga sistemi.</p>
      <p>Hyrja e stafit përdor cookies të identifikimit. Në kodin aktual nuk është integruar një mjet reklamimi ose analitike marketingu. Kjo nuk përjashton përpunimin teknik nga hostimi dhe shërbimet e jashtme.</p>
      <p>Kur ngarkohet harta Google Maps, shfletuesi lidhet me Google dhe mund të dërgojë adresën IP e informacione teknike; Google mund të përdorë cookies sipas konfigurimit të shfletuesit. Ikonat mund të ngarkohen nga shërbimi Iconify. Këto kërkesa të jashtme nuk përmbajnë fushat e formularit të rezervimit.</p>
      <p>Lexo <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">politikën e Google</a> dhe <a href="https://iconify.design/privacy/" target="_blank" rel="noopener noreferrer">politikën e Iconify</a>. Mund të menaxhosh cookies dhe ruajtjen lokale nga cilësimet e shfletuesit; kufizimet mund të ndikojnë te harta, ikonat ose rihapja e konfirmimit.</p>
    </section>
    <section id="te-drejtat">
      <h2>7. Të drejtat e tua</h2>
      <p>Sipas kushteve të ligjit të zbatueshëm, mund të kërkosh qasje, korrigjim, fshirje, kufizim të përpunimit, bartje të të dhënave ose të kundërshtosh përpunimin. Kur përpunimi mbështetet në pëlqim, mund ta tërheqësh atë. Jo çdo e drejtë zbatohet pa përjashtime në çdo rast.</p>
      <p>Na jep vetëm informacionin e nevojshëm për të gjetur rezervimin, si numri i tij dhe kontakti i përdorur. Mund të kërkohet verifikim proporcional i identitetit. Mos dërgo fjalëkalime ose të dhëna karte.</p>
      <p>Mund të paraqesësh ankesë te <a href="https://aip.rks-gov.net/" target="_blank" rel="noopener noreferrer">Agjencia për Informim dhe Privatësi</a>. Referenca ligjore është <a href="https://gzk.rks-gov.net/ActDetail.aspx?ActID=18616" target="_blank" rel="noopener noreferrer">Ligji nr. 06/L-082 për mbrojtjen e të dhënave personale</a>.</p>
    </section>
    <section id="siguria">
      <h2>8. Siguria dhe përditësimet</h2>
      <p>Përdor lidhjen zyrtare HTTPS. Sistemi përdor kontroll të hyrjes së stafit, verifikim të të dhënave dhe kufizim të kërkesave abuzive. Asnjë sistem nuk mund të garantojë siguri absolute. Mbaje privat kodin e konfirmimit, sepse mundëson qasjen te përmbledhja e terminit.</p>
      <p>Ndryshimet në funksione ose në mënyrën e trajtimit të të dhënave duhet të pasqyrohen në këtë politikë dhe në datën e përditësimit. Për rregullat e rezervimit, shiko <NuxtLink to="/kushtet-e-perdorimit">Kushtet e përdorimit</NuxtLink>.</p>
    </section>
  </PublicLegalPage>
</template>

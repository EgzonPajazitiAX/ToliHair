<script setup lang="ts">
useSeoMeta({ title: 'Kushtet e përdorimit | Toli Hair', description: 'Informacion për rezervimet, oraret, çmimet dhe ndryshimin e termineve te Toli Hair.', robots: 'noindex, follow' })
const sections = [
  { id: 'sherbimi', title: 'Përdorimi i faqes' },
  { id: 'rezervimi', title: 'Rezervimi dhe konfirmimi' },
  { id: 'cmimet', title: 'Shërbimet dhe çmimet' },
  { id: 'orari', title: 'Paraqitja në termin' },
  { id: 'ndryshimet', title: 'Ndryshimi dhe anulimi' },
  { id: 'perdorimi', title: 'Përdorimi i përgjegjshëm' },
  { id: 'problemet', title: 'Problemet teknike dhe ankesat' },
  { id: 'dokumentet', title: 'Privatësia dhe përditësimet' },
]
</script>

<template>
  <PublicLegalPage title="Kushtet e përdorimit" description="Informacion i qartë për rezervimin e terminit, orarin e shërbimit dhe mënyrën si të na kontaktosh kur planet ndryshojnë." icon="i-lucide-file-text" :sections="sections">
    <section id="sherbimi">
      <h2>1. Përdorimi i faqes</h2>
      <p>Faqja e Toli Hair të mundëson të shohësh shërbimet dhe të rezervosh te berberi që zgjedh. Shërbimi i berberhanes kryhet në lokal; rezervimi online shërben për organizimin e terminit.</p>
      <p>Ky është version për shqyrtim. Identiteti i plotë i operatorit dhe çdo rregull specifik për anulimet, vonesat ose tarifat kërkojnë konfirmim nga biznesi përpara versionit përfundimtar.</p>
    </section>
    <section id="rezervimi">
      <h2>2. Rezervimi dhe konfirmimi</h2>
      <p>Zgjidh berberin, një ose disa shërbime, datën dhe një orë të lirë. Vendos emrin e plotë dhe numrin e saktë të telefonit; emaili është opsional. Nuk nevojitet krijimi i një llogarie.</p>
      <p>Kontrollo përmbledhjen përpara se të shtypësh “Konfirmo rezervimin”. Termini konfirmohet kur sistemi e ruan me sukses dhe shfaq faqen e konfirmimit me numrin e rezervimit. Vetëm zgjedhja e një ore nuk e bllokon atë.</p>
      <p>Nëse dikush tjetër e rezervon të njëjtin orar përpara konfirmimit tënd, sistemi mund të kërkojë të zgjedhësh një orë tjetër. Ruaje numrin e rezervimit. Konfirmimi shfaqet në faqe; sistemi aktual nuk premton dërgim automatik me SMS ose email.</p>
    </section>
    <section id="cmimet">
      <h2>3. Shërbimet dhe çmimet</h2>
      <p>Çmimet shfaqen në euro. Për disa shërbime, përmbledhja llogarit çmimin dhe kohëzgjatjen totale të zgjedhjeve të tua. Kontrolloji këto para konfirmimit.</p>
      <p>Faqja aktualisht nuk përpunon pagesa online dhe nuk kërkon të dhëna karte. Për mënyrat e pagesës në lokal, pyet stafin. Çdo shërbim shtesë duhet të diskutohet me berberin bashkë me çmimin dhe kohën që kërkon.</p>
      <p>Kohëzgjatja e publikuar përdoret për planifikimin e orarit. Nëse vëren një çmim ose përshkrim të paqartë, kontakto berberhanen përpara rezervimit.</p>
    </section>
    <section id="orari">
      <h2>4. Paraqitja në termin</h2>
      <p>Datat dhe orët e rezervimit janë sipas orës lokale të Kosovës, përfshirë ndryshimin sezonal të orës. Nëse rezervon nga jashtë vendit, planifiko ardhjen sipas kësaj ore.</p>
      <p>Paraqitu rreth 10 minuta përpara terminit. Në rast vonese, njofto stafin sa më shpejt; mundësia për ta kryer shërbimin varet nga koha e mbetur dhe rezervimet pasuese. Çdo zgjidhje ose riplanifikim diskutohet me ty.</p>
    </section>
    <section id="ndryshimet">
      <h2>5. Ndryshimi dhe anulimi</h2>
      <p>Për ndryshim ose anulim, <NuxtLink to="/#kontakti">kontakto Toli Hair</NuxtLink> dhe jep numrin e rezervimit ose emrin e datën e terminit. Njofto sa më herët që të mundesh, që orari të lirohet për klientët e tjerë.</p>
      <p>Faqja aktualisht nuk ofron anulim automatik nga klienti. Mbyllja e faqes, fshirja e historikut ose nisja e një rezervimi tjetër nuk e anulon terminin ekzistues. Kërko konfirmim nga stafi për ndryshimin.</p>
      <p>Nëse berberi nuk mund ta realizojë terminin, stafi mund të përdorë kontaktin që ke dhënë për të diskutuar një orar ose berber alternativ. Këto kushte nuk përcaktojnë tarifa anulimi apo penalitete për mosparaqitje.</p>
    </section>
    <section id="perdorimi">
      <h2>6. Përdorimi i përgjegjshëm</h2>
      <p>Përdor të dhëna të sakta dhe rezervo vetëm termine që synon t’i respektosh. Nëse rezervon për dikë tjetër, sigurohu që ke autorizimin e tij; për një fëmijë, rezervimi dhe komunikimi duhet të menaxhohen nga prindi ose kujdestari.</p>
      <p>Mos krijo rezervime të rreme, mos përdor të dhënat e të tjerëve pa autorizim dhe mos ndërhy në funksionimin e sistemit. Kërkesat e shumta në një periudhë të shkurtër mund të kufizohen për të mbrojtur shërbimin.</p>
    </section>
    <section id="problemet">
      <h2>7. Problemet teknike dhe ankesat</h2>
      <p>Faqja mund të jetë përkohësisht e padisponueshme për shkak të mirëmbajtjes ose problemeve me lidhjen. Nëse konfirmimi nuk shfaqet dhe nuk je i sigurt nëse termini u ruajt, kontakto stafin përpara se të krijosh rezervime të përsëritura.</p>
      <p>Për shqetësime rreth shërbimit, çmimit ose rezervimit, kontakto Toli Hair me një përshkrim të çështjes dhe numrin e terminit, nëse e ke. Këto kushte nuk kufizojnë të drejtat e detyrueshme që ke sipas legjislacionit të zbatueshëm në Kosovë.</p>
    </section>
    <section id="dokumentet">
      <h2>8. Privatësia dhe përditësimet</h2>
      <p>Për mënyrën si përdoren të dhënat personale, lexo <NuxtLink to="/politika-e-privatesise">Politikën e privatësisë</NuxtLink>. Dhënia e kontaktit për rezervim nuk përbën regjistrim për reklama.</p>
      <p>Ndryshimet në këto kushte pasqyrohen me datën e përditësimit. Ndryshimet që prekin një termin të konfirmuar duhen komunikuar drejtpërdrejt me klientin. Për sqarime përdor <NuxtLink to="/#kontakti">kontaktin e berberhanes</NuxtLink>.</p>
    </section>
  </PublicLegalPage>
</template>

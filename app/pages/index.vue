<script setup lang="ts">
import type { BookingCatalog } from '#shared/types/booking'

useSeoMeta({
  title: 'Toli Hair | Berberhane moderne',
  description: 'Prerje profesionale, kujdes për mjekrën dhe rezervim i thjeshtë online te Toli Hair.',
  ogTitle: 'Toli Hair | Stili yt, i punuar me kujdes',
  ogImage: '/images/toli-hair-hero.png',
})

const { data: catalog } = await useFetch<BookingCatalog>('/api/booking/catalog', { key: 'catalog-home' })
const shop = computed(() => catalog.value?.shop)
const services = computed(() => catalog.value?.services ?? [])
const phoneLink = computed(() => shop.value?.phone ? `tel:${shop.value.phone.replace(/[^\d+]/g, '')}` : '')
const directionsLink = computed(() => shop.value?.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shop.value.address)}` : '')
const mapLink = computed(() => shop.value?.address ? `https://www.google.com/maps?q=${encodeURIComponent(shop.value.address)}&output=embed` : '')
const money = (value: number) => new Intl.NumberFormat('sq-XK', { style: 'currency', currency: 'EUR' }).format(value / 100)
const serviceIcons = ['i-lucide-scissors', 'i-lucide-sparkles', 'i-lucide-scan-face', 'i-lucide-wand-sparkles']
const serviceIcon = (index: number) => serviceIcons[index % serviceIcons.length]
</script>

<template>
  <div>
    <section class="hero" aria-labelledby="hero-title">
      <div class="hero-background" aria-hidden="true">
        <img src="/images/toli-hair-hero.png" alt="" width="1586" height="1000" fetchpriority="high">
        <div class="hero-shade" />
      </div>
      <div class="shell hero-grid">
        <div class="hero-copy">
          <div class="availability"><span /> Rezervime online, pa pritje</div>
          <p class="eyebrow mt-8 text-brand-300">Toli Hair · Berberhane moderne</p>
          <h1 id="hero-title">Stili yt,<br><em>i punuar me kujdes.</em></h1>
          <p class="hero-description">Prerje precize, detaje të pastra dhe një përvojë që respekton kohën tënde. Rezervo vizitën në pak hapa.</p>
          <div class="mt-8 flex flex-col gap-3 sm:flex-row">
            <UButton to="/booking" size="xl" trailing-icon="i-lucide-arrow-up-right" class="justify-center">Rezervo termin</UButton>
            <UButton to="/#sherbimet" size="xl" color="neutral" variant="outline" trailing-icon="i-lucide-arrow-down" class="hero-outline justify-center">Shiko shërbimet</UButton>
          </div>
          <div class="assurances">
            <span><UIcon name="i-lucide-shield-check" /> Pa llogari</span>
            <span><UIcon name="i-lucide-clock-3" /> Ora në kohë reale</span>
            <span><UIcon name="i-lucide-circle-check" /> Konfirmim i menjëhershëm</span>
          </div>
        </div>
        <div class="hero-note"><UIcon name="i-lucide-scissors" /><span><strong>Detaji bën diferencën.</strong><small>Përkujdesje në çdo prerje.</small></span></div>
      </div>
    </section>

    <section id="sherbimet" class="services-section section-space scroll-mt-20" aria-labelledby="services-title">
      <div class="shell services-layout">
        <div class="services-intro">
          <p class="eyebrow text-primary"><span class="services-rule" /> Shërbimet tona</p>
          <h2 id="services-title" class="display">Stili fillon<br>me <em>detajet.</em></h2>
          <p class="services-description">Një prerje që të përshtatet. Një pamje e kuruar. Zgjidh kujdesin që të duhet dhe lëre pjesën tjetër në duart tona.</p>
          <UButton to="/booking" size="xl" trailing-icon="i-lucide-arrow-up-right" class="services-cta">Rezervo vizitën tënde</UButton>
          <div class="service-values" aria-label="Përparësitë e shërbimit">
            <div><UIcon name="i-lucide-message-circle" /><span><strong>Konsultim</strong><small>Stili përshtatet me ty</small></span></div>
            <div><UIcon name="i-lucide-sparkles" /><span><strong>Detaje</strong><small>Përfundim i pastër</small></span></div>
            <div><UIcon name="i-lucide-clock-3" /><span><strong>Në kohë</strong><small>Orar i rezervuar</small></span></div>
          </div>
        </div>

        <div class="services-gallery">
          <div class="services-gallery-heading">
            <div><span>Kujdes i zgjedhur</span><p>Çdo shërbim realizohet me kohën dhe vëmendjen që meriton.</p></div>
            <span class="services-count">{{ services.length }} {{ services.length === 1 ? 'shërbim' : 'shërbime' }}</span>
          </div>
          <ul v-if="services.length" class="service-card-grid">
            <li v-for="(service, index) in services" :key="service.id" :class="{ 'service-card-featured': index === 0 }">
              <NuxtLink to="/booking" class="service-card">
                <span class="service-card-decoration" aria-hidden="true" />
                <div class="service-card-top">
                  <span class="service-card-icon"><UIcon :name="serviceIcon(index)" /></span>
                  <UIcon name="i-lucide-arrow-up-right" class="service-card-arrow" aria-hidden="true" />
                </div>
                <div class="service-card-copy">
                  <p>Shërbim profesional</p>
                  <h3>{{ service.name }}</h3>
                  <span>{{ service.description || 'Kujdes i personalizuar dhe përfundim i pastër, i realizuar me vëmendje në çdo detaj.' }}</span>
                </div>
                <div class="service-card-meta">
                  <span><UIcon name="i-lucide-clock-3" />{{ service.duration_minutes }} minuta</span>
                  <span class="service-card-price">{{ money(service.price_minor) }}</span>
                </div>
              </NuxtLink>
            </li>
          </ul>
          <div v-else class="service-menu-empty"><UIcon name="i-lucide-scissors" /><span>Shërbimet do të shfaqen sapo të publikohen.</span></div>
          <div class="services-gallery-footer"><span><UIcon name="i-lucide-layers-3" /> Mund të kombinosh disa shërbime në një rezervim.</span><NuxtLink to="/booking">Fillo rezervimin <UIcon name="i-lucide-arrow-right" /></NuxtLink></div>
        </div>
      </div>
    </section>

    <section id="rreth-nesh" class="story scroll-mt-20">
      <div class="shell story-grid">
        <div><p class="eyebrow text-brand-300">Përvoja Toli Hair</p><h2 class="display mt-5 text-4xl text-white sm:text-6xl">Mjeshtëri klasike. Ritëm modern.</h2></div>
        <div><p class="text-lg leading-8 text-white/65">Një vizitë e mirë fillon me dëgjim dhe përfundon me detaje të sakta. Çdo prerje përshtatet me ty dhe çdo termin respekton kohën tënde.</p><ol><li><span>01</span>Konsultim i qartë</li><li><span>02</span>Punë e pastër</li><li><span>03</span>Rezervim pa komplikime</li></ol></div>
      </div>
    </section>

    <section id="kontakti" class="contact scroll-mt-20" aria-labelledby="contact-title">
      <div class="shell contact-grid">
        <div class="contact-brand"><CommonBrand /><p>Një hapësirë moderne për prerje të sakta, kujdes personal dhe kohë të kaluar mirë.</p><UButton to="/booking" trailing-icon="i-lucide-calendar-check">Rezervo online</UButton></div>
        <div><p class="contact-label">Shërbimet</p><ul class="contact-services"><li v-for="service in services" :key="service.id"><span>{{ service.name }}</span><strong>{{ money(service.price_minor) }}</strong></li><li v-if="!services.length">Së shpejti</li></ul></div>
        <div><p id="contact-title" class="contact-label">Na kontaktoni</p><address>
          <div><UIcon name="i-lucide-map-pin" /><span><strong>Adresa</strong><a v-if="directionsLink" :href="directionsLink" target="_blank" rel="noopener noreferrer">{{ shop?.address }}</a><small v-else>Adresa do të publikohet së shpejti</small></span></div>
          <div><UIcon name="i-lucide-phone" /><span><strong>Telefoni</strong><a v-if="phoneLink" :href="phoneLink">{{ shop?.phone }}</a><small v-else>Numri do të publikohet së shpejti</small></span></div>
          <div><UIcon name="i-lucide-calendar-clock" /><span><strong>Rezervimet</strong><NuxtLink to="/booking">Online, 24 orë në ditë</NuxtLink></span></div>
        </address></div>
        <div class="map"><iframe v-if="mapLink" :src="mapLink" title="Lokacioni i Toli Hair" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen /><div v-else class="map-empty"><UIcon name="i-lucide-map" /><strong>Lokacioni</strong><span>Harta shfaqet pasi adresa të vendoset në panel.</span></div></div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.hero { position: relative; isolation: isolate; min-height: 100svh; overflow: hidden; background: #07100c; color: white; }
.hero-background { position: absolute; z-index: -2; inset: 0; }
.hero-background img { width: 100%; height: 100%; object-fit: cover; object-position: 58% center; }
.hero-shade { position: absolute; inset: 0; background: linear-gradient(90deg, rgb(4 10 7 / .98) 0%, rgb(5 12 9 / .94) 26%, rgb(5 12 9 / .73) 47%, rgb(5 12 9 / .24) 72%, rgb(5 12 9 / .16) 100%), linear-gradient(0deg, rgb(3 8 5 / .82) 0%, transparent 38%, rgb(3 8 5 / .2) 100%); }
.hero-grid { position: relative; display: flex; min-height: 100svh; align-items: center; padding-top: var(--ui-header-height); }
.hero-copy { z-index: 2; display: flex; width: min(100%, 46rem); flex-direction: column; justify-content: center; padding-block: clamp(3rem, 7vw, 6rem); }
.availability { display: inline-flex; width: fit-content; align-items: center; gap: .7rem; border: 1px solid rgb(255 255 255 / .12); border-radius: 999px; padding: .55rem .85rem; color: rgb(255 255 255 / .7); font-size: .75rem; }
.availability span { width: .5rem; height: .5rem; border-radius: 50%; background: #86c4aa; box-shadow: 0 0 0 .3rem rgb(134 196 170 / .12); }
.hero h1 { margin-top: 1rem; max-width: 49rem; font-size: clamp(3.3rem, 7vw, 6.6rem); font-weight: 780; letter-spacing: -.07em; line-height: .9; }
.hero h1 em { color: #86c4aa; font-style: normal; }
.hero-description { max-width: 36rem; margin-top: 1.75rem; color: rgb(255 255 255 / .64); font-size: clamp(1rem, 1.5vw, 1.15rem); line-height: 1.75; }
.hero .hero-outline { background: rgb(7 16 12 / .7); color: #fff; border: 1px solid rgb(255 255 255 / .4); box-shadow: none; backdrop-filter: blur(8px); }
.hero .hero-outline:hover, .hero .hero-outline:active { background: #d9eee4; border-color: #d9eee4; color: #0d1f1a; }
.hero .hero-outline:focus-visible { outline: 2px solid #b5ddcc; outline-offset: 4px; }
.assurances { display: flex; flex-wrap: wrap; gap: 1rem 1.5rem; margin-top: 2rem; color: rgb(255 255 255 / .46); font-size: .72rem; }
.assurances span { display: flex; align-items: center; gap: .4rem; }.assurances svg { color: #86c4aa; }
.hero-note { position: absolute; right: 0; bottom: 1.5rem; display: flex; align-items: center; gap: .8rem; border: 1px solid rgb(255 255 255 / .15); border-radius: .75rem; background: rgb(8 17 13 / .78); padding: .8rem 1rem; box-shadow: 0 1rem 3rem rgb(0 0 0 / .2); backdrop-filter: blur(1rem); }.hero-note > svg { width: 1.25rem; color: #86c4aa; }.hero-note strong,.hero-note small { display:block }.hero-note strong { font-size:.78rem }.hero-note small { margin-top:.2rem;color:rgb(255 255 255/.48);font-size:.65rem }
.services-section { position: relative; overflow: hidden; border-top: 1px solid #e1e6de; background: radial-gradient(circle at 8% 12%, rgb(54 127 102 / .1), transparent 26rem), #f5f5ef; }
.services-section::before { position: absolute; top: 0; right: 4%; width: 18rem; height: 18rem; border: 1px solid rgb(34 81 67 / .08); border-radius: 50%; content: ''; transform: translateY(-55%); }
.services-layout { position: relative; display: grid; gap: 3rem; align-items: start; }
.services-intro .eyebrow { display: flex; align-items: center; gap: .8rem; }
.services-rule { width: 2rem; height: 1px; background: currentColor; }
.services-intro h2 { margin-top: 1.5rem; font-size: clamp(2.75rem, 5vw, 4.6rem); line-height: 1.06; }
.services-intro h2 em { color: var(--ui-primary); font-style: normal; }
.services-description { max-width: 26rem; margin-top: 1.5rem; color: #5c6961; font-size: 1rem; line-height: 1.8; }
.services-cta { margin-top: 1.75rem; }
.service-values { display: grid; max-width: 27rem; margin-top: 2.25rem; border-top: 1px solid #d8dfd6; }
.service-values > div { display: grid; grid-template-columns: 2rem 1fr; align-items: center; gap: .75rem; padding-block: .9rem; border-bottom: 1px solid #d8dfd6; }
.service-values svg { width: 1.1rem; color: #367f66; }
.service-values strong,.service-values small { display: block; }
.service-values strong { color: #25352e; font-size: .8rem; font-weight: 700; }
.service-values small { margin-top: .15rem; color: #748078; font-size: .7rem; }
.services-gallery { min-width: 0; }
.services-gallery-heading { display: flex; align-items: end; justify-content: space-between; gap: 1.5rem; margin-bottom: 1rem; }
.services-gallery-heading > div > span { color: #225143; font-size: .68rem; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
.services-gallery-heading p { max-width: 27rem; margin-top: .45rem; color: #69766e; font-size: .78rem; line-height: 1.55; }
.services-count { flex-shrink: 0; border: 1px solid #cbd7ce; border-radius: 999px; padding: .4rem .65rem; color: #526159; font-size: .65rem; font-weight: 650; }
.service-card-grid { display: grid; gap: .85rem; }
.service-card-grid > li { min-width: 0; }
.service-card { position: relative; display: flex; min-height: 15.5rem; height: 100%; overflow: hidden; flex-direction: column; border: 1px solid #dce3da; border-radius: .8rem; background: rgb(255 255 251 / .9); padding: 1.25rem; color: #17201c; box-shadow: 0 .9rem 2.5rem rgb(26 53 40 / .045); transition: transform .25s ease, border-color .25s ease, box-shadow .25s ease; }
.service-card:hover { border-color: #abc9ba; box-shadow: 0 1.25rem 3rem rgb(26 53 40 / .1); transform: translateY(-3px); }
.service-card:focus-visible { outline: 3px solid rgb(54 127 102 / .3); outline-offset: 3px; }
.service-card-decoration { position: absolute; top: -4.5rem; right: -4rem; width: 11rem; height: 11rem; border: 1px solid rgb(54 127 102 / .11); border-radius: 50%; transition: transform .35s ease; }
.service-card-decoration::after { position: absolute; inset: 1.25rem; border: 1px solid rgb(54 127 102 / .08); border-radius: inherit; content: ''; }
.service-card:hover .service-card-decoration { transform: scale(1.08); }
.service-card-top { position: relative; display: flex; align-items: center; justify-content: space-between; }
.service-card-icon { display: grid; width: 2.7rem; height: 2.7rem; place-items: center; border-radius: .65rem; background: #edf3ed; color: #286652; }
.service-card-icon svg { width: 1.2rem; height: 1.2rem; }
.service-card-arrow { width: 1rem; height: 1rem; color: #9aa59e; transition: color .2s ease, transform .2s ease; }
.service-card:hover .service-card-arrow { color: #286652; transform: translate(2px,-2px); }
.service-card-copy { position: relative; margin-top: 1.5rem; }
.service-card-copy > p { color: #718078; font-size: .62rem; font-weight: 750; letter-spacing: .14em; text-transform: uppercase; }
.service-card-copy h3 { margin-top: .45rem; font-size: clamp(1.2rem, 2vw, 1.55rem); font-weight: 720; letter-spacing: -.035em; overflow-wrap: anywhere; }
.service-card-copy > span { display: block; margin-top: .65rem; color: #66736b; font-size: .78rem; line-height: 1.65; overflow-wrap: anywhere; }
.service-card-meta { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-top: auto; padding-top: 1.2rem; color: #65736b; font-size: .7rem; }
.service-card-meta > span:first-child { display: flex; align-items: center; gap: .35rem; }
.service-card-meta svg { width: .85rem; height: .85rem; }
.service-card-price { color: #7b8780; font-size: .72rem; font-weight: 600; font-variant-numeric: tabular-nums; }
.service-card-featured .service-card { min-height: 17rem; border-color: #17382d; background: linear-gradient(135deg,#17382d,#0d2019); color: white; box-shadow: 0 1.5rem 3.5rem rgb(16 43 33 / .16); }
.service-card-featured .service-card-decoration { width: 18rem; height: 18rem; border-color: rgb(134 196 170 / .14); }
.service-card-featured .service-card-icon { background: rgb(134 196 170 / .14); color: #b5ddcc; }
.service-card-featured .service-card-arrow { color: #86c4aa; }
.service-card-featured .service-card-copy > p { color: #86c4aa; }
.service-card-featured .service-card-copy > span { max-width: 31rem; color: rgb(255 255 255 / .58); }
.service-card-featured .service-card-meta { color: rgb(255 255 255 / .58); }
.service-card-featured .service-card-price { color: rgb(255 255 255 / .48); }
.service-menu-empty { display: flex; min-height: 14rem; align-items: center; justify-content: center; gap: .75rem; border: 1px dashed #cbd7ce; border-radius: .8rem; color: #68756d; font-size: .85rem; }
.services-gallery-footer { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-top: .9rem; padding: .85rem .15rem; color: #68756d; font-size: .72rem; }
.services-gallery-footer > span,.services-gallery-footer a { display: flex; align-items: center; gap: .4rem; }
.services-gallery-footer svg { width: .9rem; height: .9rem; }
.services-gallery-footer a { flex-shrink: 0; color: #286652; font-weight: 700; }
.services-gallery-footer a:hover { color: #17382d; }
@media (min-width: 640px) { .service-card-grid { grid-template-columns: repeat(2,minmax(0,1fr)); } .service-card-featured { grid-column: 1 / -1; } .service-card-featured .service-card { padding: 1.6rem; } }
@media (min-width: 900px) { .services-layout { grid-template-columns: minmax(0,.72fr) minmax(0,1.28fr); gap: clamp(3rem,6vw,6.5rem); } .services-intro { position: sticky; top: calc(var(--ui-header-height) + 2rem); padding-top: .4rem; } }
@media (max-width: 639px) { .services-gallery-heading { align-items: start; } .services-gallery-heading p { max-width: 15rem; } .services-count { margin-top: .15rem; } .service-card { min-height: 14.5rem; } .service-card-featured .service-card { min-height: 15.5rem; } .services-gallery-footer { align-items: flex-start; flex-direction: column; } .services-cta { justify-content: center; width: 100%; } }
.story { background:#173128 }.story-grid { display:grid;gap:3rem;padding-block:clamp(4rem,9vw,7rem) }.story ol { margin-top:2.5rem;border-top:1px solid rgb(255 255 255/.12) }.story li { display:grid;grid-template-columns:3rem 1fr;border-bottom:1px solid rgb(255 255 255/.12);padding-block:1rem;color:white;font-weight:650 }.story li span { color:#86c4aa;font-size:.7rem }
.contact { background:#0d1713;color:white }.contact-grid { display:grid;gap:2.75rem;padding-block:clamp(3.5rem,7vw,5.5rem) }.contact-brand p { max-width:17rem;margin:1.5rem 0;color:rgb(255 255 255/.54);font-size:.85rem;line-height:1.75 }.contact-label { margin-bottom:1.2rem;color:#86c4aa;font-size:.7rem;font-weight:800;letter-spacing:.17em;text-transform:uppercase }.contact-services li { display:flex;justify-content:space-between;gap:1rem;border-bottom:1px solid rgb(255 255 255/.09);padding:.65rem 0;color:rgb(255 255 255/.6);font-size:.8rem }.contact-services strong { color:white }.contact address { display:grid;gap:1.35rem;font-style:normal }.contact address>div { display:grid;grid-template-columns:1.2rem 1fr;gap:.8rem }.contact address svg { color:#86c4aa }.contact address strong,.contact address a,.contact address small { display:block }.contact address strong { margin-bottom:.2rem;font-size:.8rem }.contact address a,.contact address small { color:rgb(255 255 255/.55);font-size:.8rem;line-height:1.5 }.contact address a:hover { color:white }
.map { min-height:18rem;overflow:hidden;border:1px solid rgb(255 255 255/.12);background:#17231e }.map iframe { width:100%;height:100%;min-height:18rem;border:0;filter:grayscale(.55) invert(.9) contrast(.8) }.map-empty { display:flex;min-height:18rem;flex-direction:column;align-items:center;justify-content:center;gap:.6rem;padding:2rem;text-align:center;color:rgb(255 255 255/.45) }.map-empty svg { width:2rem;height:2rem }.map-empty strong { color:white }.map-empty span { max-width:15rem;font-size:.78rem }
@media(min-width:640px){.contact-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(min-width:900px){.story-grid{grid-template-columns:1fr 1fr;align-items:end}.story-grid{gap:7rem}}
@media(min-width:1024px){.contact-grid{grid-template-columns:.9fr 1fr 1fr 1.65fr}}
@media(max-width:899px){.hero-background img{object-position:74% center}.hero-shade{background:linear-gradient(90deg,rgb(3 9 6/.97) 0%,rgb(3 9 6/.84) 55%,rgb(3 9 6/.34) 100%),linear-gradient(0deg,rgb(3 8 5/.84),transparent 55%)}.hero-copy{padding-block:3.5rem 5rem}.hero-note{right:1rem;bottom:1rem}}
@media(max-width:639px){.hero-background img{object-position:82% center}.hero h1{font-size:clamp(3rem,15vw,4.4rem)}.hero-description{max-width:31rem;color:rgb(255 255 255/.72)}.assurances{gap:.75rem 1rem}.hero-note{display:none}}
</style>

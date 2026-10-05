<script setup lang="ts">
defineProps<{
  title: string
  description: string
  icon: string
  sections: { id: string, title: string }[]
}>()
</script>

<template>
  <div class="shell legal-page">
    <UButton to="/" variant="link" color="neutral" icon="i-lucide-arrow-left" class="mb-6 px-0">Kthehu në ballinë</UButton>
    <header class="legal-header">
      <span class="legal-icon" aria-hidden="true"><UIcon :name="icon" class="size-6" /></span>
      <p class="eyebrow text-primary">Toli Hair · Informacion për klientët</p>
      <h1>{{ title }}</h1>
      <p class="legal-description">{{ description }}</p>
      <div class="legal-meta"><span>Version për shqyrtim</span><span>Përditësuar më <time datetime="2026-10-04">04/10/2026</time></span></div>
    </header>
    <div class="legal-layout">
      <nav aria-label="Përmbajtja e dokumentit" class="legal-navigation">
        <p class="eyebrow mb-3 text-muted">Në këtë faqe</p>
        <a v-for="section in sections" :key="section.id" :href="`#${section.id}`">{{ section.title }}</a>
      </nav>
      <article class="legal-content" :aria-label="title"><slot /></article>
    </div>
    <div class="legal-bottom">
      <p>Ke pyetje për rezervimin ose të dhënat e tua?</p>
      <UButton to="/#kontakti" variant="outline" trailing-icon="i-lucide-arrow-up-right">Kontakto Toli Hair</UButton>
    </div>
  </div>
</template>

<style scoped>
.legal-page { max-width: 68rem; padding-block: clamp(1.5rem, 5vw, 4rem); }
.legal-header { max-width: 48rem; padding-bottom: 2rem; }
.legal-icon { display: grid; width: 3rem; height: 3rem; margin-bottom: 1.25rem; place-items: center; border: 1px solid var(--color-brand-200); border-radius: .65rem; background: var(--color-brand-50); color: var(--ui-primary); }
.legal-header h1 { margin-top: .75rem; font-size: clamp(2rem, 4.5vw, 3.25rem); font-weight: 750; line-height: 1.12; letter-spacing: -.045em; }
.legal-description { margin-top: 1rem; color: var(--ui-text-muted); line-height: 1.75; }
.legal-meta { display: flex; flex-wrap: wrap; gap: .75rem 1.5rem; margin-top: 1.25rem; color: var(--ui-text-muted); font-size: .75rem; }
.legal-meta > span:first-child { color: var(--ui-primary); font-weight: 600; }
.legal-layout { display: grid; align-items: start; gap: 1.5rem; border-top: 1px solid var(--ui-border); padding-top: 2rem; }
.legal-navigation { border: 1px solid var(--ui-border); border-radius: .65rem; background: var(--ui-bg-elevated); padding: 1.25rem; }
.legal-navigation a { display: block; padding-block: .4rem; color: var(--ui-text-muted); font-size: .8125rem; line-height: 1.5; }
.legal-navigation a:hover { color: var(--ui-primary); text-decoration: underline; text-underline-offset: .2rem; }
.legal-content { min-width: 0; border: 1px solid var(--ui-border); border-radius: .75rem; background: white; padding: clamp(1.25rem, 3vw, 2rem); }
.legal-content :deep(section) { scroll-margin-top: calc(var(--ui-header-height) + 1.5rem); }
.legal-content :deep(section + section) { margin-top: 2rem; padding-top: 1.75rem; border-top: 1px solid var(--ui-border); }
.legal-content :deep(h2) { margin-bottom: .75rem; font-size: 1.125rem; font-weight: 700; letter-spacing: -.02em; line-height: 1.4; }
.legal-content :deep(p), .legal-content :deep(li) { color: var(--ui-text-muted); font-size: .9375rem; line-height: 1.8; overflow-wrap: anywhere; }
.legal-content :deep(p + p), .legal-content :deep(ul) { margin-top: .75rem; }
.legal-content :deep(ul) { padding-left: 1.25rem; list-style: disc; }
.legal-content :deep(li + li) { margin-top: .4rem; }
.legal-content :deep(strong) { color: var(--ui-text); font-weight: 600; }
.legal-content :deep(a) { color: var(--ui-primary); text-decoration: underline; text-underline-offset: .2rem; }
.legal-bottom { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1rem; margin-top: 2rem; border-top: 1px solid var(--ui-border); padding-top: 1.5rem; font-size: .875rem; }
@media (min-width: 900px) { .legal-layout { grid-template-columns: 15rem minmax(0, 1fr); gap: 2rem; } .legal-navigation { position: sticky; top: calc(var(--ui-header-height) + 1rem); } }
</style>

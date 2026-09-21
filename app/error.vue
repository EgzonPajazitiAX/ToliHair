<script setup lang="ts">
import type { NuxtError } from '#app'

defineProps<{ error: NuxtError }>()
useSeoMeta({ title: 'Faqja nuk është e disponueshme | Toli Hair', robots: 'noindex, nofollow' })
</script>

<template>
  <UApp>
    <main class="shell flex min-h-screen max-w-xl flex-col items-start justify-center py-16">
      <CommonBrand />
      <p class="eyebrow mt-14 mb-4 text-primary">{{ error.statusCode }}</p>
      <h1 class="display text-5xl">{{ error.statusCode === 404 ? 'Kjo faqe nuk u gjet.' : 'Një ndërprerje e shkurtër.' }}</h1>
      <p class="mt-6 text-muted">{{ error.statusCode === 404 ? 'Nuk mundëm ta gjenim faqen që kërkuat.' : 'Kjo faqe nuk është e disponueshme tani. Ju lutemi provoni përsëri më vonë.' }}</p>
      <UButton class="mt-8" @click="clearError({ redirect: '/' })">Kthehu te berberhania</UButton>
    </main>
  </UApp>
</template>

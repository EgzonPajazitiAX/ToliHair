<script setup lang="ts">
import { dashboardNavigation } from '~/constants/dashboard'

const route = useRoute()
const section = computed(() => dashboardNavigation.find(item => item.to === route.path.replace(/\/$/, '')) ?? dashboardNavigation[0])
useSeoMeta({ title: () => `${section.value.label} | Toli Hair`, robots: 'noindex, nofollow' })
</script>

<template>
  <section>
    <p class="eyebrow mb-4 text-primary">Paneli i Toli Hair</p>
    <h1 class="display text-4xl sm:text-5xl">{{ section.label }}</h1>
    <p class="mt-4 mb-10 text-muted">{{ section.description }}</p>
    <CommonEmptyState :title="section.emptyTitle" :description="section.emptyDescription" />
  </section>
</template>

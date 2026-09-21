<script setup lang="ts">
defineProps<{ title: string, description: string, label?: string, to?: string }>()
</script>

<template>
  <UCard class="text-center" :ui="{ body: 'px-6 py-12 sm:p-14' }">
    <span aria-hidden="true" class="mx-auto mb-6 grid size-14 place-items-center rounded-2xl bg-brand-50 text-primary"><UIcon name="i-lucide-inbox" class="size-6" /></span>
    <h2 class="font-display text-3xl">{{ title }}</h2>
    <p class="mx-auto mt-4 max-w-md text-sm leading-7 text-muted">{{ description }}</p>
    <UButton v-if="label && to" :to="to" color="neutral" variant="outline" class="mt-7">{{ label }}</UButton>
  </UCard>
</template>

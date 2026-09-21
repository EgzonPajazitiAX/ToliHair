<script setup lang="ts">
const props = defineProps<{ current?: number }>()
const steps = ['Berberi', 'Shërbimet', 'Data dhe ora', 'Të dhënat tuaja', 'Konfirmimi']
const currentStep = computed(() => Math.min(Math.max(props.current || 1, 1), steps.length))
const progress = computed(() => `${(currentStep.value / steps.length) * 100}%`)
</script>

<template>
  <div class="mb-5 rounded-md border border-default bg-elevated px-4 py-3 sm:hidden" aria-label="Ecuria e rezervimit">
    <div class="flex items-center justify-between gap-4 text-xs">
      <span class="font-semibold text-primary">Hapi {{ currentStep }} nga {{ steps.length }}</span>
      <span class="truncate text-right text-muted">{{ steps[currentStep - 1] }}</span>
    </div>
    <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-accented" aria-hidden="true">
      <div class="h-full rounded-full bg-primary transition-[width] duration-300" :style="{ width: progress }" />
    </div>
  </div>

  <ol aria-label="Hapat e rezervimit" class="mb-8 hidden grid-cols-5 gap-2 sm:grid">
    <li v-for="(step, index) in steps" :key="step" class="rounded-md border px-3 py-2.5 text-xs transition-colors" :class="index + 1 === current ? 'border-primary bg-primary text-white' : index + 1 < (current || 1) ? 'border-primary/20 bg-brand-50 text-primary' : 'border-default bg-elevated text-muted'" :aria-current="index + 1 === current ? 'step' : undefined">
      <span class="mb-1 block text-[.65rem] font-bold opacity-65">0{{ index + 1 }}</span><span class="font-semibold">{{ step }}</span>
    </li>
  </ol>
</template>

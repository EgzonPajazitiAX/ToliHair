<script setup lang="ts">
const props = defineProps<{ current?: number }>()
const steps = ['Berberi', 'Data dhe ora', 'Shërbimet', 'Të dhënat tuaja', 'Konfirmimi']
const currentStep = computed(() => Math.min(Math.max(props.current || 1, 1), steps.length))
const progress = computed(() => `${(currentStep.value / steps.length) * 100}%`)
</script>

<template>
  <div class="mb-5 rounded-md border border-default bg-white px-4 py-3 sm:hidden" aria-label="Ecuria e rezervimit">
    <div class="flex items-center justify-between gap-4 text-xs">
      <span class="font-semibold text-primary">Hapi {{ currentStep }} nga {{ steps.length }}</span>
      <span class="truncate text-right text-muted">{{ steps[currentStep - 1] }}</span>
    </div>
    <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-accented" aria-hidden="true">
      <div class="h-full rounded-full bg-primary transition-[width] duration-300" :style="{ width: progress }" />
    </div>
  </div>

  <ol aria-label="Hapat e rezervimit" class="booking-stepper">
    <li v-for="(step, index) in steps" :key="step" class="booking-step" :class="{ 'is-current': index + 1 === currentStep, 'is-complete': index + 1 < currentStep }" :aria-current="index + 1 === currentStep ? 'step' : undefined">
      <span class="step-number" aria-hidden="true"><UIcon v-if="index + 1 < currentStep" name="i-lucide-check" class="size-4" /><template v-else>{{ index + 1 }}</template></span>
      <span class="step-label">{{ step }}</span>
      <span v-if="index + 1 < currentStep" class="sr-only"> — Përfunduar</span>
    </li>
  </ol>
</template>

<style scoped>
.booking-stepper { display: none; grid-template-columns: repeat(5, minmax(0, 1fr)); margin-bottom: 1.75rem; border: 1px solid var(--ui-border); border-radius: .75rem; background: white; padding: 1.25rem 1rem; }
.booking-step { position: relative; display: flex; align-items: center; flex-direction: column; gap: .625rem; text-align: center; color: var(--ui-text-muted); }
.booking-step:not(:last-child)::after { content: ''; position: absolute; top: 1rem; left: calc(50% + 1.4rem); right: calc(-50% + 1.4rem); height: 1px; background: var(--ui-border); }
.booking-step.is-complete::after { background: var(--color-brand-200); }
.step-number { display: grid; width: 2rem; height: 2rem; place-items: center; border: 1px solid var(--ui-border); border-radius: .5rem; font-size: .75rem; font-weight: 600; background: #f8faf7; }
.step-label { font-size: .75rem; font-weight: 500; }
.is-current { color: var(--ui-primary); }
.is-current .step-label { font-weight: 700; }
.is-current .step-number { border-color: var(--ui-primary); background: var(--ui-primary); color: white; box-shadow: 0 0 0 4px var(--color-brand-50); }
.is-complete .step-number { border-color: var(--color-brand-200); background: var(--color-brand-50); color: var(--ui-primary); }
@media (min-width: 640px) { .booking-stepper { display: grid; } }
</style>

<script setup lang="ts">
import type { AppointmentStatus } from '#shared/types/appointments'

const props = defineProps<{ status: AppointmentStatus }>()
const item = computed(() => appointmentStatuses[props.status])
</script>

<template>
  <UBadge :color="item.color" variant="subtle">{{ item.label }}</UBadge>
</template>

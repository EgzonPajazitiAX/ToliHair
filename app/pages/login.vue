<script setup lang="ts">
import { loginSchema } from '#shared/schemas/auth'
import { safeDashboardRedirect } from '#shared/utils/auth-policy'

definePageMeta({ layout: 'auth' })
useSeoMeta({ title: 'Hyrja e stafit | Toli Hair', robots: 'noindex, nofollow' })
const route = useRoute()
const { login } = useAuth()
const form = reactive({ email: '', password: '' })
const pending = ref(false)
const message = ref('')

async function submit() {
  if (pending.value) return
  pending.value = true
  message.value = ''
  try {
    await login(form.email.trim(), form.password)
    form.password = ''
    await navigateTo(safeDashboardRedirect(route.query.redirect))
  }
  catch (error: unknown) {
    const status = (error as { statusCode?: number }).statusCode
    message.value = status === 429 ? 'Shumë tentativa. Ju lutemi prisni para se të provoni përsëri.'
      : status === 503 ? 'Hyrja nuk është përkohësisht e disponueshme. Provoni përsëri pas pak.'
        : 'Hyrja dështoi. Kontrolloni të dhënat ose kontaktoni administratorin.'
  }
  finally { pending.value = false }
}
</script>

<template>
  <div class="w-full max-w-md">
    <div class="mb-7 text-center">
      <span class="mx-auto mb-5 grid size-12 place-items-center rounded-2xl bg-brand-950 text-brand-200"><UIcon name="i-lucide-lock-keyhole" class="size-5" /></span>
      <p class="eyebrow mb-3 text-primary">Hapësirë e sigurt</p>
      <h1 class="display text-4xl sm:text-5xl">Hyrja e stafit</h1>
      <p class="mt-3 text-sm leading-6 text-muted">Menaxho terminet dhe punën e përditshme të Toli Hair.</p>
    </div>
    <UCard :ui="{ body: 'p-5 sm:p-7' }">
      <UForm :schema="loginSchema" :state="form" class="space-y-6" @submit="submit">
        <UFormField label="Adresa e emailit" name="email" required>
          <UInput v-model="form.email" type="email" autocomplete="username" placeholder="emri@shembull.com" class="w-full" :disabled="pending" />
        </UFormField>
        <UFormField label="Fjalëkalimi" name="password" required>
          <UInput v-model="form.password" type="password" autocomplete="current-password" class="w-full" :disabled="pending" />
        </UFormField>
        <p v-if="message" role="alert" class="text-sm text-error">{{ message }}</p>
        <UButton type="submit" :loading="pending" :disabled="pending" block size="lg">Hyr</UButton>
      </UForm>
      <p class="mt-6 border-t border-default pt-5 text-center text-xs leading-6 text-muted">Vetëm për stafin e autorizuar. Për ndihmë me qasjen, kontaktoni administratorin.</p>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import { dashboardNavigation } from '~/constants/dashboard'
import { requiresAdmin } from '#shared/utils/auth-policy'

const route = useRoute()
const { staff, logout, refresh } = useAuth()
const open = ref(false)
const collapsed = ref(false)
const leaving = ref(false)
const logoutError = ref('')

const navigationIcons: Record<string, string> = {
  '/dashboard': 'i-lucide-layout-dashboard',
  '/dashboard/appointments': 'i-lucide-calendar-check-2',
  '/dashboard/calendar': 'i-lucide-calendar-days',
  '/dashboard/services': 'i-lucide-scissors',
  '/dashboard/barbers': 'i-lucide-users-round',
  '/dashboard/working-hours': 'i-lucide-clock-3',
  '/dashboard/blocked-times': 'i-lucide-calendar-x-2',
  '/dashboard/settings': 'i-lucide-settings-2',
}

const allowedNavigation = computed(() => dashboardNavigation.filter(item => staff.value?.role === 'admin' || !requiresAdmin(item.to)))
const activeSection = computed(() => allowedNavigation.value.find(item => item.to === route.path.replace(/\/$/, '')) ?? allowedNavigation.value[0])
const menuItems = computed<NavigationMenuItem[]>(() => allowedNavigation.value.map(item => ({
  label: item.label,
  to: item.to,
  icon: navigationIcons[item.to],
  exact: item.to === '/dashboard',
  onSelect: () => { open.value = false },
})))
const workItems = computed(() => menuItems.value.slice(0, 3))
const managementItems = computed(() => menuItems.value.slice(3, -1))
const settingsItems = computed(() => menuItems.value.slice(-1))
const initials = computed(() => staff.value?.fullName?.trim().split(/\s+/).slice(0, 2).map(part => part.charAt(0)).join('').toUpperCase() || 'TH')

async function signOut() {
  leaving.value = true
  logoutError.value = ''
  try {
    await logout()
    await navigateTo('/login', { replace: true })
  }
  catch {
    logoutError.value = 'Dalja nuk mund të konfirmohej. Ju lutemi provoni përsëri.'
  }
  finally {
    leaving.value = false
  }
}

async function checkSession() {
  try {
    if (!await refresh()) await navigateTo('/login', { replace: true })
  }
  catch { /* Një ndërprerje e përkohshme nuk duhet ta mbyllë sesionin. */ }
}

let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  window.addEventListener('focus', checkSession)
  timer = setInterval(checkSession, 60_000)
})
onBeforeUnmount(() => {
  window.removeEventListener('focus', checkSession)
  if (timer) clearInterval(timer)
})
</script>

<template>
  <UDashboardGroup unit="rem" class="bg-default">
    <a href="#main-content" class="skip-link">Kalo te përmbajtja</a>

    <UDashboardSidebar
      id="toli-dashboard-sidebar"
      v-model:open="open"
      v-model:collapsed="collapsed"
      mode="drawer"
      collapsible
      resizable
      :default-size="17"
      :min-size="14"
      :max-size="22"
      :collapsed-size="4.5"
      :ui="{
        root: 'bg-elevated/55',
        header: 'h-16 border-b border-default px-3',
        body: 'gap-5 px-3 py-4',
        footer: 'border-t border-default p-3',
      }"
    >
      <template #header="{ collapsed: isCollapsed }">
        <NuxtLink v-if="isCollapsed" to="/dashboard" aria-label="Toli Hair — Përmbledhja" class="mx-auto grid size-9 place-items-center rounded-lg bg-primary text-white">
          <UIcon name="i-lucide-scissors" class="size-4.5" />
        </NuxtLink>
        <CommonBrand v-else />
      </template>

      <template #default="{ collapsed: isCollapsed }">
        <div>
          <p v-if="!isCollapsed" class="sidebar-label">Puna e ditës</p>
          <UNavigationMenu :items="workItems" :collapsed="isCollapsed" orientation="vertical" tooltip popover class="w-full" />
        </div>
        <div v-if="managementItems.length">
          <p v-if="!isCollapsed" class="sidebar-label">Menaxhimi</p>
          <UNavigationMenu :items="managementItems" :collapsed="isCollapsed" orientation="vertical" tooltip popover class="w-full" />
        </div>
        <UNavigationMenu :items="settingsItems" :collapsed="isCollapsed" orientation="vertical" tooltip popover class="mt-auto w-full" />
      </template>

      <template #footer="{ collapsed: isCollapsed }">
        <div class="flex items-center gap-2" :class="isCollapsed ? 'flex-col' : ''">
          <div class="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-xs font-bold text-white" aria-hidden="true">{{ initials }}</div>
          <div v-if="!isCollapsed" class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold text-highlighted">{{ staff?.fullName || 'Përdoruesi' }}</p>
            <p class="truncate text-xs text-muted">{{ staff?.role === 'admin' ? 'Administrator' : 'Staf' }}</p>
          </div>
          <UTooltip text="Dil nga llogaria">
            <UButton color="neutral" variant="ghost" icon="i-lucide-log-out" :loading="leaving" :disabled="leaving" aria-label="Dil nga llogaria" @click="signOut" />
          </UTooltip>
        </div>
        <UDashboardSidebarCollapse class="mt-2 hidden w-full justify-center lg:flex" />
      </template>
    </UDashboardSidebar>

    <UDashboardPanel id="toli-dashboard-main" :ui="{ body: 'p-0 sm:p-0' }">
      <template #header>
        <UDashboardNavbar
          :title="activeSection?.label"
          :icon="activeSection ? navigationIcons[activeSection.to] : undefined"
          toggle-side="right"
          :toggle="{ color: 'neutral', variant: 'ghost', size: 'lg' }"
          :ui="{ root: 'h-16 px-4 sm:px-6', title: 'font-semibold' }"
        >
          <template #right>
            <UButton to="/" color="neutral" variant="ghost" icon="i-lucide-arrow-up-right" class="hidden lg:inline-flex">Shiko faqen</UButton>
          </template>
        </UDashboardNavbar>
      </template>

      <template #body>
        <main id="main-content" class="dashboard-content" tabindex="-1">
          <UAlert v-if="logoutError" color="error" variant="soft" icon="i-lucide-circle-alert" title="Dalja nuk u krye" :description="logoutError" class="mb-6" />
          <slot />
        </main>
      </template>
    </UDashboardPanel>
  </UDashboardGroup>
</template>

<style scoped>
.sidebar-label { margin: 0 .65rem .45rem; color: var(--ui-text-dimmed); font-size: .67rem; font-weight: 700; letter-spacing: .11em; text-transform: uppercase; }
.dashboard-content { width: 100%; max-width: 90rem; padding: clamp(1.25rem, 3vw, 2.5rem); }
</style>

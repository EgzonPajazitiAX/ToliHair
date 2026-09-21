<script setup lang="ts">
const open = ref(false)
const route = useRoute()
const scrolled = ref(false)
const isLanding = computed(() => route.path === '/')

const navigation = [
  { label: 'Ballina', to: '/', icon: 'i-lucide-house' },
  { label: 'Shërbimet', to: '/#sherbimet', icon: 'i-lucide-scissors' },
  { label: 'Rreth nesh', to: '/#rreth-nesh', icon: 'i-lucide-users' },
  { label: 'Kontakti', to: '/#kontakti', icon: 'i-lucide-map-pin' },
  { label: 'Hyrja e stafit', to: '/login', icon: 'i-lucide-lock-keyhole' },
]

const headerClass = computed(() => [
  'site-header z-50 border-b text-white transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300',
  isLanding.value ? 'fixed inset-x-0 top-0' : 'sticky top-0',
  scrolled.value || !isLanding.value
    ? 'border-white/10 bg-[#07100c]/92 shadow-[0_10px_35px_rgb(0_0_0/.22)] backdrop-blur-xl'
    : 'border-transparent bg-[#07100c]/35 backdrop-blur-[3px]',
])

function updateHeader() {
  scrolled.value = window.scrollY > 20
}

function isMobileItemActive(to: string) {
  if (to === '/') return route.path === '/' && !route.hash
  if (to.startsWith('/#')) return route.path === '/' && route.hash === to.slice(1)
  return route.path === to
}

onMounted(() => {
  updateHeader()
  window.addEventListener('scroll', updateHeader, { passive: true })
})

watch(() => route.fullPath, () => nextTick(updateHeader))
onBeforeUnmount(() => window.removeEventListener('scroll', updateHeader))
</script>

<template>
  <UHeader
    v-model:open="open"
    mode="drawer"
    :toggle="{ color: 'neutral', variant: 'ghost', icon: open ? 'i-lucide-x' : 'i-lucide-menu', class: 'text-white hover:bg-white/10 hover:text-white' }"
    :class="headerClass"
    :ui="{
      container: 'min-h-16 lg:min-h-18',
      title: 'text-white hover:text-white',
      content: 'border-t border-white/10 bg-[#07100c] text-white',
      overlay: 'bg-[#020604]/72 backdrop-blur-sm',
      body: 'px-4 pb-6 pt-5',
    }"
  >
    <template #title>
      <CommonBrand />
    </template>

    <UNavigationMenu
      :items="navigation.slice(0, 4)"
      color="neutral"
      variant="link"
      class="hidden md:flex"
      :ui="{ link: 'text-white/68 hover:text-white data-[active=true]:text-brand-300', linkLeadingIcon: 'text-brand-300' }"
    />

    <template #right>
      <UButton to="/login" color="neutral" variant="ghost" class="hidden text-white/72 hover:bg-white/10 hover:text-white lg:inline-flex">Hyrja e stafit</UButton>
      <UButton to="/booking" trailing-icon="i-lucide-arrow-up-right" class="hidden shadow-lg shadow-black/15 md:inline-flex">Rezervo termin</UButton>
    </template>

    <template #body>
      <nav aria-label="Navigimi mobil" class="grid gap-1.5">
        <UButton
          v-for="item in navigation"
          :key="item.to"
          :to="item.to"
          :icon="item.icon"
          color="neutral"
          variant="ghost"
          size="lg"
          class="min-h-12 justify-start px-3.5 text-base transition-colors"
          :class="isMobileItemActive(item.to) ? 'bg-white/10 text-brand-200 hover:bg-white/12 hover:text-brand-100' : 'text-white/72 hover:bg-white/6 hover:text-white'"
          @click="open = false"
        >
          {{ item.label }}
        </UButton>
      </nav>
      <UButton to="/booking" size="lg" block trailing-icon="i-lucide-arrow-right" class="mt-5 justify-center" @click="open = false">Rezervo termin</UButton>
    </template>
  </UHeader>
</template>

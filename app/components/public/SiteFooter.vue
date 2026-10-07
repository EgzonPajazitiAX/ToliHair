<template>
  <footer class="border-t border-white/10 bg-[#0d1713] py-8 text-white">
    <div class="shell flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
      <p class="text-sm text-white/60">© {{ new Date().getFullYear() }} Toli Hair. Pak kohë për veten.</p>
      <nav aria-label="Informacion ligjor" class="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 sm:justify-end">
        <NuxtLink to="/politika-e-privatesise" class="inline-flex min-h-11 items-center text-xs text-white/70 underline-offset-4 hover:text-white hover:underline">Politika e privatësisë</NuxtLink>
        <NuxtLink to="/kushtet-e-perdorimit" class="inline-flex min-h-11 items-center text-xs text-white/70 underline-offset-4 hover:text-white hover:underline">Kushtet e përdorimit</NuxtLink>
      </nav>
    </div>
  </footer>
</template>

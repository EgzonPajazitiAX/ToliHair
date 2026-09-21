<template>
  <footer class="border-t border-white/10 bg-[#0d1713] py-8 text-white">
    <div class="shell flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
      <p class="text-sm text-white/60">© {{ new Date().getFullYear() }} Toli Hair. Pak kohë për veten.</p>
      <NuxtLink to="/login" class="text-xs text-white/60 hover:text-white">Hyrja e stafit <span aria-hidden="true">↗</span></NuxtLink>
    </div>
  </footer>
</template>

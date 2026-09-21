<template>
  <div class="flex min-h-screen flex-col">
    <a href="#main-content" class="skip-link">Kalo te përmbajtja</a>
    <PublicSiteHeader />
    <main id="main-content" class="flex-1" tabindex="-1"><slot /></main>
    <PublicSiteFooter />
  </div>
</template>

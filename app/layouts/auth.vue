<template>
  <div class="flex min-h-screen flex-col bg-[#f4f6f3]">
    <a href="#main-content" class="skip-link">Kalo te përmbajtja</a>
    <header class="shell flex items-center justify-between gap-4 py-5 sm:py-7">
      <CommonBrand />
      <UButton to="/" color="neutral" variant="ghost" icon="i-lucide-arrow-left">Kthehu në faqe</UButton>
    </header>
    <main id="main-content" class="shell flex flex-1 items-center justify-center py-8 sm:py-12" tabindex="-1"><slot /></main>
  </div>
</template>

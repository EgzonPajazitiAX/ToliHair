<template>
  <UApp :toaster="{ position: 'bottom-right', max: 3 }">
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>

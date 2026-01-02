<script setup>
definePageMeta({
  layout: "sidebar",
  middleware: ["auth"],
});
</script>
<template>
  <UContainer>
    <UCard class="mt-6">
      <template #header> Clocking Page </template>

      <p>This is the clocking page content.</p>
    </UCard>
  </UContainer>
</template>

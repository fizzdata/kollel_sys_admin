<script setup>
const props = defineProps({
  modelValue: Boolean,
  data: {
    type: Array,
    required: true,
  },
});

const emit = defineEmits(["update:modelValue"]);

const gridColsClass = computed(() => {
  if (!props.data || props.data.length === 1) return "grid-cols-1";
  if (props.data.length === 2) return "grid-cols-2";
  return "grid-cols-1 md:grid-cols-2";
});

function downloadPdf(check) {
  const link = document.createElement("a");
  link.href = check.url;
  link.download = `check-${check.id}.pdf`;
  link.click();
}

function printPdf(check) {
  const win = window.open(check.url);
  win.onload = () => win.print();
}
</script>

<template>
  <UModal
    :open="modelValue"
    fullscreen
    @update:open="$emit('update:modelValue', $event)"
  >
    <template #header>
      <div class="flex justify-between w-full items-center">
        <h2 class="text-xl font-bold text-primary">Checks Preview</h2>

        <UButton
          size="sm"
          variant="outline"
          color="primary"
          class="rounded-full p-2"
          icon="i-lucide-x"
          @click="$emit('update:modelValue', false)"
        />
      </div>
    </template>

    <!-- Body -->
    <template #body>
      <!-- Grid Preview -->
      <div :class="`grid gap-4 ${gridColsClass}`">
        <div
          v-for="check in props.data"
          :key="check.id"
          class="border border-gray-200 rounded p-2"
        >
          <p class="font-semibold mb-2">Check #{{ check.id }}</p>

          <iframe :src="check.url" class="w-full h-[80vh] rounded" />

          <div class="flex justify-end items-center gap-2 mt-3">
            <UButton
              size="sm"
              icon="i-heroicons-arrow-down-tray"
              @click="downloadPdf(check)"
            >
              Download
            </UButton>

            <UButton
              size="sm"
              icon="i-heroicons-printer"
              variant="outline"
              @click="printPdf(check)"
            >
              Print
            </UButton>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>

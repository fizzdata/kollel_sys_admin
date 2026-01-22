<script setup>
definePageMeta({
  layout: "sidebar",
  middleware: ["auth"],
});

const loading = ref(false);
const fingerprintStatus = ref("idle"); // idle | scanning | success | error
const route = useRoute();
const studentId = route.params.id;

const startFingerprintScan = () => {
  fingerprintStatus.value = "scanning";

  // TODO: integrate fingerprint SDK / device API
  setTimeout(() => {
    fingerprintStatus.value = "success";
  }, 2000);
};
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-start w-full md:w-fit">
      <UButton
        variant="outline"
        color="primary"
        :to="`/students/${studentId}`"
        icon="i-lucide-arrow-left"
        class="w-fit"
        label="Back to Student Detail Page"
      />
    </div>

    <!-- Page Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold">Register Fingerprint</h1>
        <p class="text-sm text-gray-500">
          Register a fingerprint for a student (Admin only)
        </p>
      </div>
    </div>

    <!-- Fingerprint Registration -->
    <UCard class="rounded-2xl">
      <h2 class="font-semibold mb-4">Fingerprint Registration</h2>

      <div class="flex flex-col items-center justify-center gap-4 py-10">
        <div
          class="h-20 w-20 rounded-full flex items-center justify-center"
          :class="{
            'bg-gray-100': fingerprintStatus === 'idle',
            'bg-amber-100': fingerprintStatus === 'scanning',
            'bg-emerald-100': fingerprintStatus === 'success',
            'bg-rose-100': fingerprintStatus === 'error',
          }"
        >
          <UIcon
            name="i-lucide-fingerprint"
            class="size-10"
            :class="{
              'text-gray-400': fingerprintStatus === 'idle',
              'text-amber-600': fingerprintStatus === 'scanning',
              'text-emerald-600': fingerprintStatus === 'success',
              'text-rose-600': fingerprintStatus === 'error',
            }"
          />
        </div>

        <p class="text-sm text-gray-600">
          <span v-if="fingerprintStatus === 'idle'">
            Ready to scan fingerprint
          </span>
          <span v-else-if="fingerprintStatus === 'scanning'">
            Scanning fingerprint…
          </span>
          <span v-else-if="fingerprintStatus === 'success'">
            Fingerprint registered successfully
          </span>
          <span v-else>Fingerprint registration failed </span>
        </p>

        <UButton
          color="primary"
          :loading="fingerprintStatus === 'scanning'"
          @click="startFingerprintScan"
        >
          Start Fingerprint Scan
        </UButton>
      </div>
    </UCard>
  </div>
</template>

<script setup>
const { jobs } = useJobTracker();

const statusColor = (status) => {
  if (status === "completed") return "success";
  if (status === "failed") return "error";
  return "primary";
};

const barClass = (job) => {
  if (job.status === "failed") return "bg-red-400";
  if (job.status === "completed") return "bg-green-400";
  return "bg-primary";
};
</script>

<template>
  <div class="fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-3">
    <TransitionGroup name="job-fade">
      <div
        v-for="job in jobs"
        :key="job.id"
        class="rounded-2xl border border-gray-200 bg-white p-4 shadow-lg"
      >
        <div class="mb-2 flex items-center justify-between gap-2">
          <p class="truncate text-sm font-semibold text-gray-900">
            {{ job.label }}
          </p>
          <UBadge :color="statusColor(job.status)" variant="soft" size="xs">
            {{ job.status }}
          </UBadge>
        </div>

        <div class="h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            v-if="job.status === 'processing' && !job.total"
            class="h-2 w-1/3 animate-pulse rounded-full bg-primary"
          />
          <div
            v-else
            class="h-2 rounded-full transition-all duration-500"
            :class="barClass(job)"
            :style="{ width: `${Math.min(job.progress, 100)}%` }"
          />
        </div>

        <p class="mt-2 truncate text-xs text-gray-500">{{ job.message }}</p>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.job-fade-enter-active,
.job-fade-leave-active {
  transition: all 0.3s ease;
}
.job-fade-enter-from,
.job-fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>

<script setup>
definePageMeta({
  layout: "sidebar",
  middleware: ["auth"],
});

const api = useApi();
const dashboardData = ref(null);
const loading = ref(true);
const toast = useToast();
// Fetch dashboard data
const fetchDashboard = async () => {
  try {
    loading.value = true;
    const response = await api("/api/dashboard", {
      method: "GET",
    });

    if (response) {
      dashboardData.value = response;
    }
  } catch (error) {
    console.error("Error fetching dashboard:", error);
    toast.add({
      title: "Error",
      description:
        "An unexpected error occurred while fetching dashboard stats. Please try again later.",
      color: "error",
    });
  } finally {
    loading.value = false;
  }
};

// Helper to format time from seconds
const formatTime = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

// Helper to calculate session progress
const getSessionProgress = (start, end) => {
  const now = new Date();
  const currentSeconds =
    now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

  if (currentSeconds < start) return 0;
  if (currentSeconds > end) return 100;

  const elapsed = currentSeconds - start;
  const total = end - start;
  return Math.round((elapsed / total) * 100);
};

// Computed stats from API data
const stats = computed(() => {
  if (!dashboardData.value) return [];

  return [
    {
      label: "Active Students",
      value: dashboardData.value.students_active?.toString() || "0",
      delta: `${dashboardData.value.students_in || 0} clocked in`,
    },
    {
      label: "Total Payouts",
      value: "$" + `${dashboardData.value.money_out || "0"}`,
      delta: `${dashboardData.value.pending_requests || 0} pending`,
    },
    {
      label: "Files",
      value: dashboardData.value.files?.toString() || "0",
      delta: "Uploaded documents",
    },
    {
      label: "Uncleared Checks",
      value: dashboardData.value.checks_not_cleared?.toString() || "0",
      delta: "Needs attention",
    },
  ];
});

// Computed sessions from API data
const sessions = computed(() => {
  if (!dashboardData.value?.today_schedules) return [];

  return dashboardData.value.today_schedules.map((schedule) => {
    const startTime = formatTime(schedule.start);
    const endTime = formatTime(schedule.end);
    const progress = getSessionProgress(schedule.start, schedule.end);

    return {
      name: `Session ${schedule.session}`,
      time: `${startTime} - ${endTime}`,
      progress,
    };
  });
});

// Computed alerts from API data
const alerts = computed(() => {
  if (!dashboardData.value?.alerts) return [];

  return dashboardData.value.alerts.map((alert) => ({
    title: alert.title,
    message: alert.message,
    timestamp: alert.created_at,
  }));
});

// Fetch data on mount
onMounted(() => {
  fetchDashboard();
});
</script>

<template>
  <div>
    <div
      class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
    >
      <div>
        <h1 class="text-3xl font-semibold text-primary">
          {{ dashboardData?.org_name }}
        </h1>
        <p class="text-gray-600">Dashboard Overview</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <UButton
          label="Refresh"
          icon="i-heroicons-arrow-path"
          :loading="loading"
          @click="fetchDashboard"
        />
        <UButton
          color="primary"
          label="Open Session"
          icon="i-heroicons-clock"
          to="/schedule"
        />
      </div>
    </div>

    <div
      v-if="loading && !dashboardData"
      class="flex justify-center items-center py-20"
    >
      <BaseSpinner />
    </div>

    <div v-else>
      <div class="grid grid-cols-1 gap-4 mt-6 md:grid-cols-2 lg:grid-cols-4">
        <UCard
          v-for="stat in stats"
          :key="stat.label"
          class="rounded-2xl border border-gray-100"
        >
          <div class="space-y-2">
            <p class="text-sm text-gray-500">{{ stat.label }}</p>
            <p class="text-3xl font-semibold text-gray-900">{{ stat.value }}</p>
            <p class="text-xs text-emerald-600 font-medium">{{ stat.delta }}</p>
          </div>
        </UCard>
      </div>

      <div class="grid grid-cols-1 gap-6 mt-8">
        <UCard class="rounded-2xl">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold text-gray-900">Alerts</h2>
            <span class="text-xs text-gray-500">Needs attention</span>
          </div>
          <ul v-if="alerts.length > 0" class="space-y-4">
            <li
              v-for="alert in alerts"
              :key="alert.title"
              class="rounded-xl bg-amber-50 p-3 border-l-4 border-amber-400"
            >
              <p class="text-sm font-semibold text-amber-900">
                {{ alert.title }}
              </p>
              <p class="text-xs text-amber-700">{{ alert.message }}</p>
              <p class="mt-2 text-xs text-amber-600">
                {{ new Date(alert.timestamp).toLocaleString() }}
              </p>
            </li>
          </ul>
          <p v-else class="text-sm text-gray-500 text-center py-4">
            No alerts at this time
          </p>
        </UCard>
      </div>

      <div class="grid grid-cols-1 gap-6 mt-8 lg:grid-cols-2">
        <UCard class="rounded-2xl">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold text-gray-900">Session Status</h2>
            <span class="text-xs text-gray-500">Live</span>
          </div>
          <div v-if="sessions.length > 0" class="space-y-4">
            <div
              v-for="(session, index) in sessions"
              :key="index"
              class="rounded-xl border border-gray-100 p-4"
            >
              <p class="text-sm font-semibold text-gray-900">
                {{ session.name }}
              </p>
              <p class="text-xs text-gray-500">{{ session.time }}</p>
              <div class="mt-3 h-2 w-full rounded-full bg-gray-100">
                <div
                  class="h-2 rounded-full transition-all duration-500"
                  :class="
                    session.progress >= 100
                      ? 'bg-gray-400'
                      : session.progress > 70
                        ? 'bg-amber-500'
                        : 'bg-primary'
                  "
                  :style="{ width: `${Math.min(session.progress, 100)}%` }"
                ></div>
              </div>
              <p class="mt-2 text-xs text-gray-500">
                {{
                  session.progress >= 100
                    ? "Completed"
                    : `${session.progress}% elapsed`
                }}
              </p>
            </div>
          </div>
          <p v-else class="text-sm text-gray-500 text-center py-8">
            No sessions scheduled for today
          </p>
        </UCard>

        <UCard class="rounded-2xl">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold text-gray-900">System Overview</h2>
            <span class="text-xs text-gray-500">Summary</span>
          </div>
          <div class="space-y-4">
            <div
              class="flex items-center justify-between p-3 rounded-lg bg-blue-50"
            >
              <div>
                <p class="text-sm font-semibold text-blue-900">
                  Active Students
                </p>
                <p class="text-xs text-blue-700">Total enrolled</p>
              </div>
              <p class="text-2xl font-bold text-blue-900">
                {{ dashboardData?.students_active || 0 }}
              </p>
            </div>
            <div
              class="flex items-center justify-between p-3 rounded-lg bg-green-50"
            >
              <div>
                <p class="text-sm font-semibold text-green-900">
                  Currently Clocked In
                </p>
                <p class="text-xs text-green-700">In session now</p>
              </div>
              <p class="text-2xl font-bold text-green-900">
                {{ dashboardData?.students_in || 0 }}
              </p>
            </div>
            <div
              class="flex items-center justify-between p-3 rounded-lg bg-purple-50"
            >
              <div>
                <p class="text-sm font-semibold text-purple-900">
                  Total Payouts
                </p>
                <p class="text-xs text-purple-700">All time</p>
              </div>
              <p class="text-xl font-bold text-purple-900">
                $ {{ dashboardData?.money_out || "0" }}
              </p>
            </div>
          </div>
        </UCard>
      </div>
    </div>
  </div>
</template>

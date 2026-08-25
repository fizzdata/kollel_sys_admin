<script setup>
definePageMeta({
  layout: "sidebar",
  middleware: ["auth"],
});

const api = useApi();
const toast = useToast();

const loading = ref(false);
const logs = ref(null);
const currentPage = ref(1);
const detailsModalOpen = ref(false);
const selectedLog = ref(null);

const actionColor = (action) => {
  if (action === "insert") return "success";
  if (action === "delete") return "error";
  return "primary";
};

const tableLabels = {
  students: "Students",
  transactions: "Transactions",
  checks: "Checks",
  daily_session: "Schedule",
};

const formatDateTime = (value) => {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value.replace(" ", "T")));
  } catch {
    return value;
  }
};

const auditColumns = [
  {
    accessorKey: "admin_name",
    header: "Admin",
  },
  {
    accessorKey: "table_name",
    header: "Table",
    cell: ({ row }) =>
      h(
        resolveComponent("UBadge"),
        { color: "neutral", variant: "soft" },
        { default: () => tableLabels[row.original.table_name] || row.original.table_name },
      ),
  },
  {
    accessorKey: "action",
    header: "Action",
    cell: ({ row }) =>
      h(
        resolveComponent("UBadge"),
        { color: actionColor(row.original.action), variant: "soft" },
        { default: () => row.original.action },
      ),
  },
  {
    accessorKey: "created_at",
    header: "Time",
    cell: ({ row }) => formatDateTime(row.original.created_at),
  },
  {
    id: "details",
    header: "",
    cell: ({ row }) =>
      h(
        resolveComponent("UButton"),
        {
          size: "xs",
          color: "neutral",
          variant: "outline",
          onClick: () => showDetails(row.original),
        },
        { default: () => "Details" },
      ),
  },
];

const showDetails = (log) => {
  selectedLog.value = log;
  detailsModalOpen.value = true;
};

const formattedBindings = computed(() => {
  if (!selectedLog.value?.bindings) return "[]";
  try {
    const parsed =
      typeof selectedLog.value.bindings === "string"
        ? JSON.parse(selectedLog.value.bindings)
        : selectedLog.value.bindings;
    return JSON.stringify(parsed, null, 2);
  } catch {
    return String(selectedLog.value.bindings);
  }
});

const fetchLogs = async () => {
  try {
    loading.value = true;
    const response = await api(`/api/audit-logs`, {
      method: "GET",
      params: { page: currentPage.value },
    });

    if (response?.success) {
      logs.value = response.logs;
      currentPage.value = response.logs?.current_page;
    }
  } catch (err) {
    console.log("🚀 ~ fetchLogs ~ err:", err);
    toast.add({
      description: "Error fetching audit log. Please try again later.",
      color: "error",
      timeout: 3000,
    });
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  await fetchLogs();
});

const paginationData = computed(() => {
  if (logs.value && "current_page" in logs.value) {
    return logs.value;
  }
  return null;
});

async function goToPage(page) {
  if (page >= 1 && page <= logs.value.last_page) {
    currentPage.value = page;
    await fetchLogs();
  }
}
</script>

<template>
  <UCard class="rounded-2xl shadow-sm">
    <h2 class="text-lg sm:text-xl font-bold">Audit Log</h2>
    <p class="mt-1 text-sm text-gray-600">
      Every admin-made change to students, transactions, checks, and the
      schedule &mdash; who made it and when.
    </p>
  </UCard>

  <UCard class="rounded-2xl shadow-sm mt-6">
    <UTable
      :columns="auditColumns"
      :loading="loading"
      :data="logs && logs.data"
      class="flex-1"
    />

    <div
      v-if="paginationData"
      class="flex flex-col md:flex-row justify-between md:items-center mt-4 md:text-sm text-xs text-gray-600"
    >
      <div class="text-sm text-gray-700">
        Showing {{ paginationData.from }} to {{ paginationData.to }} of
        {{ paginationData.total }} results
      </div>
      <div class="flex mt-4 md:mt-0 justify-center items-center sm:flex-row">
        <div class="flex gap-2">
          <UButton
            @click="goToPage(1)"
            :disabled="!paginationData.prev_page_url"
          >
            First
          </UButton>
          <UButton
            @click="goToPage(paginationData.current_page - 1)"
            :disabled="!paginationData.prev_page_url"
          >
            Previous
          </UButton>
        </div>
        <span class="px-3 py-1">
          Page {{ paginationData.current_page }} of
          {{ paginationData.last_page }}
        </span>
        <div class="flex gap-2">
          <UButton
            @click="goToPage(paginationData.current_page + 1)"
            :disabled="!paginationData.next_page_url"
          >
            Next
          </UButton>
          <UButton
            @click="goToPage(paginationData.last_page)"
            :disabled="!paginationData.next_page_url"
          >
            Last
          </UButton>
        </div>
      </div>
    </div>
  </UCard>

  <UModal v-model:open="detailsModalOpen" title="Audit Log Details">
    <template #body>
      <div v-if="selectedLog" class="space-y-4">
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div class="text-xs font-semibold uppercase tracking-wide text-gray-500">Admin</div>
            <div>{{ selectedLog.admin_name }}</div>
          </div>
          <div>
            <div class="text-xs font-semibold uppercase tracking-wide text-gray-500">Time</div>
            <div>{{ formatDateTime(selectedLog.created_at) }}</div>
          </div>
          <div>
            <div class="text-xs font-semibold uppercase tracking-wide text-gray-500">Table</div>
            <div>{{ tableLabels[selectedLog.table_name] || selectedLog.table_name }}</div>
          </div>
          <div>
            <div class="text-xs font-semibold uppercase tracking-wide text-gray-500">Action</div>
            <div class="capitalize">{{ selectedLog.action }}</div>
          </div>
        </div>

        <div>
          <div class="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
            SQL
          </div>
          <pre class="rounded-lg bg-gray-900 text-gray-100 text-xs p-3 overflow-x-auto whitespace-pre-wrap break-all">{{ selectedLog.sql }}</pre>
        </div>

        <div>
          <div class="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
            Values
          </div>
          <pre class="rounded-lg bg-gray-900 text-gray-100 text-xs p-3 overflow-x-auto whitespace-pre-wrap break-all">{{ formattedBindings }}</pre>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup>
definePageMeta({
  layout: "sidebar",
  middleware: ["auth"],
});

const api = useApi();
const toast = useToast();

// Reactive data
const checks = ref([]);
const loading = ref(false);
const exporting = ref(false);
const currentPage = ref(1);
const totalPages = ref(1);

// Date filters for export
const fromDate = ref("");
const toDate = ref("");

// Filter options
const payToFilter = ref("");
const clearedFilter = ref("");
const searchTerm = ref("");
const paginationData = ref({
  from: 0,
  to: 0,
  total: 0,
});
// Filter options
const clearedOptions = [
  { label: "All", value: null },
  { label: "Cleared", value: "1" },
  { label: "Pending", value: "0" },
];

// Fetch checks data
const fetchChecks = async (page = 1) => {
  loading.value = true;
  try {
    let url = `/api/checks?page=${page}`;

    // Add filters to URL
    if (payToFilter.value) {
      url += `&pay_to=${encodeURIComponent(payToFilter.value)}`;
    }
    if (clearedFilter.value) {
      url += `&cleared=${clearedFilter.value}`;
    }
    if (searchTerm.value) {
      url += `&search=${encodeURIComponent(searchTerm.value)}`;
    }

    const response = await api(url);

    if (response.success) {
      checks.value = response.checks.data || response.checks;
      paginationData.value = {
        from: response.checks.from,
        to: response.checks.to,
        total: response.checks.total,
      };
      currentPage.value = response.checks.current_page || 1;
      totalPages.value = response.checks.last_page || 1;
    } else {
      toast.add({
        title: "Error",
        description: response?.message || "Failed to fetch checks",
        color: "error",
      });
    }
  } catch (error) {
    console.log("🚀 ~ fetchChecks ~ error:", error);
    toast.add({
      title: "Error",
      description: "Failed to fetch checks. Please try again later.",
      color: "error",
    });
  } finally {
    loading.value = false;
  }
};

// Mark check as cleared
const markAsCleared = async (checkId) => {
  try {
    const response = await api(`/api/checks/${checkId}/cleared`, {
      method: "POST",
      body: { id: checkId },
    });

    if (response.success) {
      toast.add({
        title: "Success",
        description: "Check marked as cleared",
        color: "success",
      });
      // Refresh the list
      await fetchChecks(currentPage.value);
    } else {
      toast.add({
        title: "Error",
        description: response.message || "Failed to mark check as cleared",
        color: "error",
      });
    }
  } catch (error) {
    toast.add({
      title: "Error",
      description: "Failed to mark check as cleared",
      color: "error",
    });
  }
};

// Export to Excel
const exportToExcel = async () => {
  if (!fromDate.value || !toDate.value) {
    toast.add({
      title: "Error",
      description: "Please select both from and to dates for export",
      color: "error",
    });
    return;
  }

  exporting.value = true;
  try {
    const response = await api(
      `/api/checks/export?from_date=${fromDate.value}&to_date=${toDate.value}`,
    );

    // Handle file download
    const blob = new Blob([response], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `checks_export_${fromDate.value}_to_${toDate.value}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast.add({
      title: "Success",
      description: "Export completed successfully",
      color: "success",
    });
  } catch (error) {
    toast.add({
      title: "Error",
      description: "Failed to export checks",
      color: "error",
    });
  } finally {
    exporting.value = false;
  }
};

// Format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
};

// Format date
const formatDate = (date) => {
  return new Date(date).toLocaleDateString("en-US");
};

// Load initial data
onMounted(() => {
  fetchChecks();
});

// Watch for filter changes
watch([payToFilter, clearedFilter], () => {
  currentPage.value = 1; // Reset to first page
  fetchChecks();
});
let searchTimeout = null;

watch(searchTerm, () => {
  currentPage.value = 1;

  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }

  searchTimeout = setTimeout(() => {
    currentPage.value = 1; // Reset to first page
    fetchChecks();
  }, 500); // debounce delay (ms)
});

// Pagination
const goToPage = (page) => {
  fetchChecks(page);
};

// Table columns
const columns = [
  {
    accessorKey: "check_number",
    header: "Check #",
    cell: ({ row }) =>
      h("span", { class: "font-mono text-sm" }, row.original.check_number),
  },
  {
    accessorKey: "pay_to",
    header: "Pay To",
    cell: ({ row }) =>
      h("div", { class: "max-w-xs truncate text-sm" }, row.original.pay_to),
  },
  {
    accessorKey: "check_date",
    header: "Date",
    cell: ({ row }) =>
      h("span", { class: "text-sm" }, formatDate(row.original.check_date)),
  },
  {
    accessorKey: "amount",
    header: "Amount",
    cell: ({ row }) =>
      h(
        "span",
        { class: "font-semibold text-green-600 text-sm" },
        formatCurrency(row.original.amount),
      ),
  },
  {
    accessorKey: "memo",
    header: "Memo",
    cell: ({ row }) =>
      h(
        "div",
        { class: "max-w-xs truncate text-sm text-gray-600" },
        row.original.memo || "-",
      ),
  },
  {
    accessorKey: "cleared",
    header: "Status",
    cell: ({ row }) =>
      h(
        resolveComponent("UBadge"),
        {
          color: row.original.cleared ? "success" : "warning",
          variant: "solid",
          size: "sm",
        },
        () => (row.original.cleared ? "Cleared" : "Pending"),
      ),
  },
  {
    header: "Actions",
    cell: ({ row }) =>
      h("div", { class: "flex gap-2 items-center" }, [
        !row.original.cleared
          ? h(
              resolveComponent("UButton"),
              {
                size: "sm",
                color: "neutral",
                variant: "soft",
                onClick: () => markAsCleared(row.original.id),
              },
              () => [
                h(resolveComponent("UIcon"), {
                  name: "i-heroicons-check-circle",
                  class: "w-4 h-4 mr-1",
                }),
                "Mark Cleared",
              ],
            )
          : h(
              resolveComponent("UButton"),
              {
                size: "sm",
                color: "success",
                variant: "soft",
                class: "pointer-events-none font-bold",
              },
              () => [
                h(resolveComponent("UIcon"), {
                  name: "i-heroicons-check-circle",
                  class: "w-4 h-4 mr-1",
                }),
                "Already cleared",
              ],
            ),
      ]),
  },
];
</script>

<template>
  <UCard class="rounded-2xl shadow-sm">
    <div
      class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <h2 class="text-xl font-bold">Checks Management</h2>

      <!-- Export Section -->
      <div class="flex flex-wrap gap-2 sm:gap-2 sm:justify-end">
        <UInput
          v-model="fromDate"
          type="date"
          placeholder="From Date"
          class="w-40"
        />
        <UInput
          v-model="toDate"
          type="date"
          placeholder="To Date"
          class="w-40"
        />
        <UButton
          @click="exportToExcel"
          :loading="exporting"
          icon="i-heroicons-document-arrow-down"
          label="Export to Excel"
        />
      </div>
    </div>
  </UCard>

  <!-- Filter Section -->
  <div class="flex flex-col md:flex-row gap-4 items-center my-6">
    <UInput
      v-model="searchTerm"
      icon="i-lucide-search"
      size="lg"
      variant="outline"
      placeholder="Search checks..."
      :ui="{ trailing: 'pe-1' }"
      class="flex-1 w-full"
    >
      <template v-if="searchTerm?.length" #trailing>
        <UButton
          color="neutral"
          variant="link"
          size="sm"
          icon="i-lucide-circle-x"
          aria-label="Clear search"
          @click="searchTerm = ''"
        />
      </template>
    </UInput>

    <UInput
      v-model="payToFilter"
      icon="i-lucide-user"
      size="lg"
      variant="outline"
      placeholder="Filter by Pay To..."
      :ui="{ trailing: 'pe-1' }"
      class="w-full md:w-64"
    >
      <template v-if="payToFilter?.length" #trailing>
        <UButton
          color="neutral"
          variant="link"
          size="sm"
          icon="i-lucide-circle-x"
          aria-label="Clear filter"
          @click="payToFilter = ''"
        />
      </template>
    </UInput>

    <USelect
      v-model="clearedFilter"
      :items="clearedOptions"
      size="lg"
      placeholder="Filter by Status"
      class="w-full md:w-48"
    />
  </div>

  <!-- Checks Table -->
  <UCard class="rounded-2xl shadow-sm mt-6">
    <div
      class="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-0"
    >
      <h2 class="md:text-lg text-base font-bold">View and manage checks</h2>
    </div>
    <UTable
      :columns="columns"
      :loading="loading"
      :data="checks"
      sticky
      class="flex-1 md:mt-6 mt-2 max-h-160"
    />

    <!-- Pagination -->
    <div
      class="flex flex-col md:flex-row justify-between md:items-center mt-4 md:text-sm text-xs text-gray-600"
    >
      <div>
        Showing {{ paginationData.from }} to {{ paginationData.to }} of
        {{ paginationData.total }} results
      </div>

      <div class="flex mt-2 md:mt-0 justify-center items-center sm:flex-row">
        <UButton
          @click="goToPage(currentPage - 1)"
          :disabled="currentPage === 1 || loading"
          size="sm"
          color="neutral"
          variant="soft"
          icon="i-heroicons-chevron-left"
          label="Previous"
        />
        <div class="px-3 py-1">Page {{ currentPage }} of {{ totalPages }}</div>
        <UButton
          @click="goToPage(currentPage + 1)"
          :disabled="currentPage === totalPages || loading"
          size="sm"
          color="neutral"
          variant="soft"
          trailing-icon="i-heroicons-chevron-right"
          label="Next"
        />
      </div>
    </div>
  </UCard>
</template>

<script setup>
definePageMeta({
  layout: "sidebar",
  middleware: ["auth"],
});

const api = useApi();
const toast = useToast();
import CheckCreateModal from "~/components/common/CheckCreateModal.vue";

const showCreateModal = ref(false);

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
const statusFilter = ref("");
// Backwards-compatible alias: some templates/code reference `clearedFilter`
const clearedFilter = statusFilter;
const searchTerm = ref("");

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
    if (statusFilter.value) {
      url += `&status=${statusFilter.value}`;
    }
    if (searchTerm.value) {
      url += `&search=${encodeURIComponent(searchTerm.value)}`;
    }

    const response = await api(url);

    if (response.success) {
      checks.value = response.checks.data || response.checks;
      currentPage.value = response.checks.current_page || 1;
      totalPages.value = response.checks.last_page || 1;
    } else {
      toast.add({
        title: "Error",
        description: response.message || "Failed to fetch checks",
        color: "error",
      });
    }
  } catch (error) {
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
    const response = await api(`/api/checks/${checkId}/status`, {
      method: "POST",
      body: { id: checkId, status: "cleared" },
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
// print checks — open PDF in a new tab and trigger browser print
const printChecks = async (checkId) => {
  try {
    const response = await api(`/api/checks/${checkId}/print`, {
      method: "GET",
    });

    if (response.success) {
      const byteCharacters = atob(response.pdf);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);

      const printWindow = window.open(url, "_blank");
      const tryPrint = () => {
        if (!printWindow) return;
        try {
          printWindow.focus();
          printWindow.print();
        } catch (e) {
          // ignore print errors
        }
      };

      // Try to print once the window has loaded, with a fallback timeout
      if (printWindow) {
        printWindow.onload = tryPrint;
        setTimeout(tryPrint, 500);
        // Revoke URL after a delay to avoid breaking the opened PDF before printing
        setTimeout(() => {
          try {
            window.URL.revokeObjectURL(url);
          } catch (e) {}
        }, 10000);
      } else {
        // Could not open new window/tab
        window.URL.revokeObjectURL(url);
        toast.add({
          title: "Error",
          description: "Unable to open print window",
          color: "error",
        });
      }
    } else {
      toast.add({
        title: "Error",
        description: response.message || "Failed to print check",
        color: "error",
      });
    }
  } catch (error) {
    toast.add({
      title: "Error",
      description: "Failed to print check",
      color: "error",
    });
  }
};

// download check PDF without opening a new window
const downloadCheck = async (checkId, checkNumber = "") => {
  try {
    const response = await api(`/api/checks/${checkId}/print`, {
      method: "GET",
    });

    if (response.success) {
      const byteCharacters = atob(response.pdf);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `check_${checkNumber || checkId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      //window.URL.revokeObjectURL(url);
    } else {
      toast.add({
        title: "Error",
        description: response.message || "Failed to download PDF",
        color: "error",
      });
    }
  } catch (error) {
    toast.add({
      title: "Error",
      description: "Failed to download PDF",
      color: "error",
    });
  }
};
// Mark check as voided
const markAsVoided = async (checkId) => {
  try {
    const response = await api(`/api/checks/${checkId}/status`, {
      method: "POST",
      body: { id: checkId, status: "voided" },
    });

    if (response.success) {
      toast.add({
        title: "Success",
        description: "Check marked as voided",
        color: "success",
      });
      // Refresh the list
      await fetchChecks(currentPage.value);
    } else {
      toast.add({
        title: "Error",
        description: response.message || "Failed to mark check as voided",
        color: "error",
      });
    }
  } catch (error) {
    toast.add({
      title: "Error",
      description: "Failed to mark check as voided",
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
watch([payToFilter, statusFilter, searchTerm], () => {
  currentPage.value = 1; // Reset to first page
  fetchChecks();
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
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) =>
      h(
        resolveComponent("UBadge"),
        {
          color: row.original.status === "cleared" ? "green" : "yellow",
          variant: "solid",
          size: "sm",
        },
        () => row.original.status,
      ),
  },
  {
    header: "Actions",
    cell: ({ row }) =>
      h("div", { class: "flex gap-2 items-center" }, [
        row.original.status !== "cleared"
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
              "span",
              { class: "text-xs text-gray-500 px-2 py-1" },
              "Already cleared",
            ),
        row.original.status !== "voided"
          ? h(
              resolveComponent("UButton"),
              {
                size: "sm",
                color: "red",
                variant: "soft",
                onClick: () => markAsVoided(row.original.id),
              },
              () => [
                h(resolveComponent("UIcon"), {
                  name: "i-heroicons-x-circle",
                  class: "w-4 h-4 mr-1",
                }),
                "Mark Voided",
              ],
            )
          : h(
              "span",
              { class: "text-xs text-gray-500 px-2 py-1" },
              "Voided",
            ),
            h(
              resolveComponent("UButton"),
              {
                size: "sm",
                color: "blue",
                variant: "soft",
                onClick: () => printChecks(row.original.id),
              },
              () => [
                h(resolveComponent("UIcon"), {
                  name: "i-heroicons-printer",
                  class: "w-4 h-4 mr-1",
                }),
                "Print",
              ],
            ),
            h(
              resolveComponent("UButton"),
              {
                size: "sm",
                color: "green",
                variant: "soft",
                onClick: () => downloadCheck(row.original.id, row.original.check_number),
              },
              () => [
                h(resolveComponent("UIcon"), {
                  name: "i-heroicons-arrow-down-tray",
                  class: "w-4 h-4 mr-1",
                }),
                "Download PDF",
              ],
            ),
      ]),
  },
];
</script>

<template>
  <UCard class="rounded-2xl shadow-sm">
    <div
      class="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-4 md:mb-0"
    >
      <h2 class="text-xl font-bold">Checks Management</h2>

      <!-- Export Section -->
      <div class="flex items-center gap-2">
        <UButton
          @click="showCreateModal = true"
          size="md"
          color="primary"
          icon="i-heroicons-plus"
          label="Create Check"
        />
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
      class="flex-1"
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
      v-model="statusFilter"
      :items="clearedOptions"
      size="lg"
      placeholder="Filter by Status"
      class="w-full md:w-48"
    />
  </div>

  <!-- Checks Table -->
  <UCard class="rounded-2xl shadow-sm mt-6">
    <div
      class="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-4 md:mb-0"
    >
      <h2 class="text-lg font-bold">View and manage checks</h2>
    </div>
    <UTable
      :columns="columns"
      :loading="loading"
      :data="checks"
      class="flex-1 mt-6"
    />

    <!-- Pagination -->
    <div
      class="flex justify-between items-center mt-6 pt-4 border-t border-default"
    >
      <div class="text-sm text-gray-600">
        Page {{ currentPage }} of {{ totalPages }}
      </div>
      <div class="flex gap-2">
        <UButton
          @click="goToPage(currentPage - 1)"
          :disabled="currentPage === 1"
          size="sm"
          color="gray"
          variant="soft"
          icon="i-heroicons-chevron-left"
          label="Previous"
        />

        <UButton
          @click="goToPage(currentPage + 1)"
          :disabled="currentPage === totalPages"
          size="sm"
          color="gray"
          variant="soft"
          icon="i-heroicons-chevron-right"
          label="Next"
        />
      </div>
    </div>
  </UCard>

  <CheckCreateModal v-model:open="showCreateModal" @submit="fetchChecks" @cancel="showCreateModal = false" />
</template>

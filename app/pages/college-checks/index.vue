<script setup>
import { object, string, number } from "yup";
import {
  CalendarDate,
  getLocalTimeZone,
  today,
  DateFormatter,
} from "@internationalized/date";

definePageMeta({
  layout: "sidebar",
  middleware: ["auth"],
});

// Initialize date formatter
const df = new DateFormatter("en-US", {
  dateStyle: "medium",
});

// Update your filters object to include dateRange
const filters = reactive({
  dateRange: {
    start: null,
    end: null,
  },
  user_id: null,
  account_year: "",
});

const api = useApi();
const toast = useToast();
const route = useRoute();
const loading = ref(false);
const showModal = ref(false);
const isSubmitting = ref(false);
const open = ref(false);
const checks = ref([]);
const showDeleteConfirmModal = ref(false);
const printLoadingStates = ref({});
const collegeId = computed(() => route.query.id); // Default to current ID if not in URL
const errorMessage = ref("");
const isValidId = ref(false);
const searchTerm = ref("");
const isDateRangeOpen = ref(false);
const loadingItems = ref(false);

const handleDateRangeSelect = (value) => {
  // Close the popover when both start and end dates are selected
  if (value?.start && value?.end) {
    isDateRangeOpen.value = false;
  }
};

const defaultDate = today(getLocalTimeZone());

// Form state
const form = ref({
  id: null,
  user_id: "",
  payee: "",
  amount: null,
  memo: "",
  date: defaultDate,
  year:
    new Date().getFullYear().toString() +
    "/" +
    (new Date().getFullYear() + 1).toString(),
});

// Users list for dropdown
const users = ref([]);

// Validation schema
const schema = object({
  user_id: string().required("User is required"),
  payee: string().nullable(),
  amount: number()
    .transform((value) => (isNaN(value) ? undefined : value)) // Transform empty strings to undefined
    .required("Amount is required")
    .positive("Amount must be positive"),
  memo: string().nullable().max(50, "Memo should not exceed 50 characters"),
  date: string().required("Date is required"),
  year: string().required("Year is required"),
});

const state = reactive({ ...form.value });

const onSubmit = async (event) => {
  isSubmitting.value = true;

  const endpoint = form.value.id
    ? `/collage_ap/${collegeId.value}/check/${form.value.id}`
    : `/collage_ap/${collegeId.value}/check`;
  const method = form.value.id ? "PUT" : "POST";

  delete event.data.id;

  try {
    const response = await api(endpoint, {
      method: method,
      body: event.data,
    });

    if (response?.success) {
      toast.add({
        title: "Success",
        description: response?.msg
          ? response?.msg
          : form.value.id
            ? "Check updated successfully"
            : "Check created successfully",
        color: "success",
        duration: 2000,
      });
      showModal.value = false;
      form.value.id = null;
      resetForm();
      await fetchList(false);
    } else if (response?._data?.msg) {
      toast.add({
        title: "Failed",
        description: response._data.msg,
        color: "error",
      });
    } else {
      toast.add({
        title: "Unexpected Response",
        description: "Something went wrong. Please try again.",
        color: "error",
      });
    }
  } catch (error) {
    console.error("Error creating check:", error);
    toast.add({
      title: "Error",
      description: "Failed to create check",
      color: "error",
    });
  } finally {
    isSubmitting.value = false;
    showModal.value = false;
  }
};

const resetForm = () => {
  Object.assign(form.value, {
    id: null,
    user_id: "",
    payee: "",
    amount: null,
    memo: "",
    date: defaultDate,
    year:
      new Date().getFullYear().toString() +
      "/" +
      (new Date().getFullYear() + 1).toString(),
  });
  Object.assign(state, form.value);
};

const editCheck = (check) => {
  form.value.id = check.check_id;
  state.user_id = check.id;
  state.payee = check.c_check_payee;
  state.amount = check.c_check_amount;
  state.memo = check.check_memo;

  if (check.c_check_date) {
    const [year, month, day] = check.c_check_date.split("-").map(Number);
    state.date = new CalendarDate(year, month, day); // ✅ correct
  } else {
    state.date = null;
  }

  state.year = check.c_check_account_year;

  showModal.value = true;
};

const deleteCheck = (check) => {
  form.value.id = check.check_id;
  showDeleteConfirmModal.value = true;
};

const onDeleteConfirm = async () => {
  if (!form.value.id) return;
  isSubmitting.value = true;

  try {
    const response = await api(
      `/collage_ap/${collegeId.value}/check/${form.value.id}`,
      {
        method: "DELETE",
      },
    );

    if (response?.success) {
      toast.add({
        title: "Success",
        description: response?.msg || "Check deleted successfully",
        color: "success",
        duration: 2000,
      });
      await fetchList(false);
      form.value.id = null;
      showDeleteConfirmModal.value = false;
    } else {
      toast.add({
        description:
          response?.msg ||
          response?.message ||
          response?._data?.msg ||
          "Failed to delete check. Please try again later.",
        color: "error",
        duration: 2000,
      });
      showDeleteConfirmModal.value = false;
    }
  } catch (error) {
    console.error("Delete failed:", error);
    toast.add({
      title: "Error",
      description: "Something went wrong. Please try again later.",
      color: "error",
      duration: 2000,
    });
  } finally {
    isSubmitting.value = false;
    showDeleteConfirmModal.value = false;
  }
};

const columns = [
  { accessorKey: "c_user_name", header: "User Name" },
  { accessorKey: "agreed_amount", header: "Agreed Amount" },
  { accessorKey: "c_check_date", header: "Check Date" },
  { accessorKey: "c_check_amount", header: "Check Amount" },
  { accessorKey: "c_check_status", header: "Check Status" },
  { accessorKey: "c_check_account_year", header: "Account Year" },
  { accessorKey: "check_memo", header: "Check Memo" },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) =>
      h("div", { class: "flex gap-2 items-center" }, [
        // Tooltip with Edit Icon Button
        h(
          resolveComponent("UTooltip"),
          { text: "Edit Check" },
          {
            default: () =>
              h(resolveComponent("UButton"), {
                icon: "i-heroicons-pencil-square",
                size: "xs",
                color: "success",
                variant: "soft",
                onClick: () => editCheck(row.original),
              }),
          },
        ),

        // Tooltip with Delete Icon Button
        h(
          resolveComponent("UTooltip"),
          { text: "Delete Check" },
          {
            default: () =>
              h(resolveComponent("UButton"), {
                icon: "i-heroicons-trash",
                size: "xs",
                color: "error",
                variant: "soft",
                onClick: () => deleteCheck(row.original),
              }),
          },
        ),
        // Tooltip with Print Icon Button
        h(
          resolveComponent("UTooltip"),
          { text: "Print Check" },
          {
            default: () =>
              h(resolveComponent("UButton"), {
                icon: printLoadingStates.value[row.original.check_id]
                  ? "i-heroicons-arrow-path"
                  : "i-heroicons-printer",
                loading: printLoadingStates.value[row.original.check_id],
                size: "xs",
                color: "info",
                variant: "soft",
                onClick: () => printCheck(row.original),
                disabled: printLoadingStates.value[row.original.check_id],
              }),
          },
        ),
      ]),
  },
];

// Add this new function to handle printing
const printCheck = async (check) => {
  try {
    printLoadingStates.value[check.check_id] = true;

    const response = await api(
      `/collage_ap/${collegeId.value}/check/${check.check_id}/print`,
      {
        method: "POST",
      },
    );

    if (response.success && response.pdf) {
      // Create a Blob from the base64 PDF
      const byteCharacters = atob(response.pdf);
      const byteNumbers = new Array(byteCharacters.length);

      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }

      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/pdf" });

      // Create a URL for the blob
      const fileURL = URL.createObjectURL(blob);

      // Open the PDF in a new tab
      const newWindow = window.open();
      newWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Check #${check.check_id}</title>
            <style>
              @media print {
                @page { margin: 0; }
                body { 
                  margin: 0;
                  padding: 0;
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                }
                .no-print { 
                  display: none !important; 
                }
                .print-only { 
                  display: block !important; 
                  position: absolute;
                  top: 0;
                  left: 0;
                  width: 100%;
                  height: 100%;
                }
                iframe { 
                  width: 100%;
                  height: 100%;
                  border: none;
                }
              }
              @media screen {
                body, html { 
                  margin: 0; 
                  padding: 0; 
                  height: 100%;
                  overflow: hidden;
                }
                .print-only {
                  display: none;
                }
              }
            </style>
          </head>
          <body>
            <div class="print-only">
              <iframe src="${fileURL}"></iframe>
            </div>
            
            <iframe class="no-print" src="${fileURL}" style="width:100%; height:100vh; border:none;"></iframe>
            
            <script>
              // Auto-print when the PDF is loaded
              window.onload = function() {
                // Optional: Auto-print after a short delay
                // setTimeout(() => window.print(), 500);
              };
            <\/script>
          </body>
        </html>
      `);
      newWindow.document.close();

      // Clean up the URL object when the window is closed
      newWindow.onbeforeunload = function () {
        URL.revokeObjectURL(fileURL);
      };
    } else if (!response?._data?.success && response?._data?.msg) {
      throw new Error(
        response?._data?.msg ||
          response?._data?.[0] ||
          "Failed to generate PDF",
      );
    }
  } catch (error) {
    console.error("Print error:", error);
    toast.add({
      description:
        error.message || "Failed to print check. Please try again later.",
      color: "error",
      duration: 5000,
    });
  } finally {
    // Clear loading state when done
    printLoadingStates.value[check.check_id] = false;
  }
};

const fetchUsers = async () => {
  try {
    const response = await api(`/collage_ap/${collegeId.value}/users`); // Call it as a function
    if (response?.success) {
      users.value = response?.c_users;
    }
  } catch (error) {
    console.error("Error fetching projects:", error);
  }
};

// Add computed property to filter users based on search term
const filteredChecks = computed(() => {
  if (!searchTerm.value) return checks.value;

  const term = searchTerm.value.toLowerCase();
  return checks.value.filter((item) => {
    return (
      item.c_user_name?.toLowerCase().includes(term) ||
      item.c_user_email?.toLowerCase().includes(term) ||
      item.check_memo?.toLowerCase().includes(term)
    );
  });
});

// Calculate total amount
const totalAmount = computed(() => {
  return filteredChecks.value.reduce((sum, check) => {
    return sum + parseFloat(check.c_check_amount || 0);
  }, 0);
});

// Format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount || 0);
};

// Add year options (you can modify this based on your needs)
const yearOptions = computed(() => {
  return Array.from({ length: 10 }, (_, i) => {
    const startYear = new Date().getFullYear() - 2 + i;
    const endYear = startYear + 1;
    return {
      value: `${startYear}/${endYear}`,
      label: `${startYear}/${endYear}`,
    };
  });
});

// Check if any filters are active
const hasActiveFilters = computed(() => {
  return Object.values(filters).some(
    (value) =>
      (Array.isArray(value) && value.length > 0) ||
      (value !== null && value !== undefined && value !== ""),
  );
});

// Reset all filters
const resetFilters = () => {
  Object.keys(filters).forEach((key) => {
    filters[key] = "";
  });
  fetchList(false); // Refetch without filters
};

// Apply filters and refetch data
const applyFilters = async () => {
  await fetchList(false);
};

// Update your fetchList function to use the date range
const fetchList = async (showLoading = true) => {
  loadingItems.value = true;
  if (showLoading === true) {
    loading.value = true;
  }
  try {
    const params = new URLSearchParams();

    // In your fetchList function
    if (filters.dateRange?.start) {
      // Add one day to include the full start date
      const startDate = new Date(
        filters.dateRange.start.toDate(getLocalTimeZone()),
      );
      startDate.setDate(startDate.getDate() + 1);
      const formattedStartDate = startDate.toISOString().split("T")[0];
      params.append("start_date", formattedStartDate);
    }

    if (filters.dateRange?.end) {
      // Add one day to include the full end date
      const endDate = new Date(
        filters.dateRange.end.toDate(getLocalTimeZone()),
      );
      endDate.setDate(endDate.getDate() + 1);
      const formattedEndDate = endDate.toISOString().split("T")[0];
      params.append("end_date", formattedEndDate);
    }

    if (filters.user_id) params.append("user_id", filters.user_id);

    // ✅ build query string
    let queryString = params.toString();

    // Append account_year without encoding `/`
    if (filters.account_year) {
      queryString +=
        (queryString ? "&" : "") + `account_year=${filters.account_year}`;
    }

    const response = await api(
      `/collage_ap/${collegeId.value}/checks?${queryString}`,
    );

    if (response?.success) {
      checks.value = response?.data || [];
      isValidId.value = true;
    } else if (!response?.success) {
      errorMessage.value = response?.msg || "Org not found";
      isValidId.value = false;
    }
  } catch (error) {
    console.error("Error fetching checks:", error);
    // Handle error
  } finally {
    loadingItems.value = false;
    if (showLoading) {
      loading.value = false;
    }
  }
};

// Run again whenever the ID changes
// watch(collegeId, async (newId) => {
//   if (newId) {
//     await fetchList();
//     await fetchUsers();
//   }
// });

// onMounted(async () => {
//   if (collegeId.value) {
//     await fetchList();
//     await fetchUsers();
//   }
// });
</script>

<template>
  <div class="flex items-center justify-between">
    <div v-if="loading" class="flex items-center justify-center pt-10 w-full">
      <BaseSpinner :show-loader="loading" size="md" />
    </div>

    <!-- v-else-if="isValidId" -->

    <UCard class="w-full">
      <template #header>
        <div
          class="flex flex-col md:flex-row md:justify-between md:items-center gap-4"
        >
          <h2 class="text-xl font-bold">
            Checks
            <span class="ml-2 text-gray-500 text-base">
              ({{ filteredChecks.length }} checks, Total:
              {{ formatCurrency(totalAmount) }})
            </span>
          </h2>

          <div class="flex justify-end items-center gap-4">
            <!-- <UInput
              v-model="searchTerm"
              icon="i-lucide-search"
              size="md"
              variant="outline"
              placeholder="Search..."
              :ui="{ trailing: 'pe-1' }"
            >
              <template v-if="searchTerm?.length" #trailing>
                <UButton
                  color="neutral"
                  variant="link"
                  size="sm"
                  icon="i-lucide-circle-x"
                  aria-label="Clear input"
                  @click="searchTerm = ''"
                />
              </template>
            </UInput> -->

            <UButton
              @click="
                () => {
                  resetForm();
                  showModal = true;
                }
              "
            >
              + Add Check
            </UButton>
          </div>
        </div>
      </template>

      <!-- Add this filter section above your table -->
      <UCard class="mb-4">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <!-- Date Range Picker -->
          <div>
            <UFormField label="Date Range">
              <UPopover v-model:open="isDateRangeOpen">
                <UButton
                  color="neutral"
                  variant="subtle"
                  icon="i-lucide-calendar"
                  class="w-full"
                >
                  <template v-if="filters.dateRange?.start">
                    <template v-if="filters.dateRange.end">
                      {{
                        df.format(
                          filters.dateRange.start.toDate(getLocalTimeZone()),
                        )
                      }}
                      -
                      {{
                        df.format(
                          filters.dateRange.end.toDate(getLocalTimeZone()),
                        )
                      }}
                    </template>
                    <template v-else>
                      {{
                        df.format(
                          filters.dateRange.start.toDate(getLocalTimeZone()),
                        )
                      }}
                    </template>
                  </template>
                  <template v-else> Select date range </template>
                </UButton>

                <template #content>
                  <UCalendar
                    v-model="filters.dateRange"
                    class="p-2"
                    :number-of-months="2"
                    @update:modelValue="handleDateRangeSelect"
                    range
                  />
                </template>
              </UPopover>
            </UFormField>
          </div>

          <!-- User Filter -->
          <UFormField label="User">
            <USelect
              v-model="filters.user_id"
              :items="
                users?.map((u) => ({ value: u.id, label: u.c_user_name }))
              "
              option-attribute="label"
              value-attribute="value"
              placeholder="Select user"
              class="w-full"
              clearable
            />
          </UFormField>

          <!-- Year Filter -->
          <UFormField label="School Year">
            <USelect
              v-model="filters.account_year"
              :items="yearOptions"
              placeholder="Select year"
              class="w-full"
              clearable
            />
          </UFormField>
          <div class="flex justify-end mt-4 space-x-2">
            <UButton
              color="gray"
              variant="soft"
              @click="resetFilters"
              :disabled="!hasActiveFilters"
            >
              Reset
            </UButton>
            <UButton
              color="primary"
              icon="i-heroicons-adjustments-horizontal"
              @click="applyFilters"
              :loading="loading"
              :disabled="filteredChecks.length === 0"
            >
              Apply Filters
            </UButton>
          </div>
        </div>
      </UCard>

      <UTable
        :data="filteredChecks"
        :columns="columns"
        :loading="loadingItems"
        class="flex-1"
      />
    </UCard>

    <!-- <div v-else>{{ errorMessage }}</div> -->
  </div>

  <!-- Add/Edit check modal -->
  <UModal
    v-model:open="showModal"
    :title="form.id ? 'Edit Check' : 'Add New Check'"
  >
    <template #body>
      <UForm :schema="schema" :state="state" @submit="onSubmit">
        <div class="border-b pb-4 border-gray-200">
          <div class="grid md:grid-cols-2 gap-4">
            <UFormField label="User" name="user_id">
              <USelect
                v-model="state.user_id"
                :items="
                  users?.map((u) => ({ value: u.id, label: u.c_user_name }))
                "
                placeholder="Select user"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Payee" name="payee">
              <UInput
                v-model="state.payee"
                placeholder="Enter payee name"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Amount" name="amount">
              <UInput
                v-model="state.amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Date" name="date">
              <UPopover v-model:open="open">
                <UButton
                  color="neutral"
                  variant="subtle"
                  icon="i-lucide-calendar"
                  class="w-full"
                >
                  {{
                    state.date
                      ? state.date.toString()
                      : today(getLocalTimeZone()).toString()
                  }}
                </UButton>

                <template #content>
                  <UCalendar
                    v-model="state.date"
                    class="p-2 w-full"
                    @update:model-value="open = false"
                  />
                </template>
              </UPopover>
            </UFormField>

            <UFormField label="School Year" name="year">
              <USelect
                v-model="state.year"
                :items="yearOptions"
                :default-value="`${new Date().getFullYear()}/${
                  new Date().getFullYear() + 1
                }`"
                placeholder="Select school year"
                class="w-full"
              />
            </UFormField>
          </div>
          <UFormField label="Memo" name="memo" class="mt-4">
            <UTextarea
              v-model="state.memo"
              placeholder="Add check Memo"
              class="w-full"
            />
          </UFormField>
        </div>
        <div class="flex justify-end gap-3 mt-3">
          <UButton
            color="neutral"
            variant="outline"
            label="Cancel"
            @click="showModal = false"
          />
          <UButton
            type="submit"
            :loading="isSubmitting"
            :disabled="isSubmitting"
            :label="form.id ? 'Update' : 'Create'"
          />
        </div>
      </UForm>
    </template>
  </UModal>

  <UModal v-model:open="showDeleteConfirmModal" title="Confirm Delete">
    <template #body>
      <p class="text-sm text-gray-600 border-b pb-4 border-gray-200">
        Are you sure you want to delete this check? This action cannot be
        undone.
      </p>

      <div class="flex justify-end gap-2 mt-3">
        <UButton
          color="neutral"
          variant="outline"
          @click="showDeleteConfirmModal = false"
        >
          Cancel
        </UButton>
        <UButton
          color="error"
          variant="solid"
          @click="onDeleteConfirm"
          :loading="isSubmitting"
          :disabled="isSubmitting"
        >
          Delete
        </UButton>
      </div>
    </template>
  </UModal>
</template>

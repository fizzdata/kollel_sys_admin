<script setup>
import {
  today,
  DateFormatter,
  getLocalTimeZone,
} from "@internationalized/date";
import { object, string, number } from "yup";

definePageMeta({
  layout: "sidebar",
  middleware: ["auth"],
});

const df = new DateFormatter("en-US", {
  dateStyle: "medium",
});

const api = useApi();
const toast = useToast();
const todayDate = today(getLocalTimeZone());
const open = ref(false);
const newTransactionModal = ref(false);
const fromDate = todayDate.subtract({ days: 30 });
const loading = ref(false);
const transactions = ref(null);
const currentPage = ref(1);
const students = ref([]);
const studentFetching = ref(false);
const isSubmitting = ref(false);
const isDeleteTransactionModalOpen = ref(false);
const isTransactionDeleting = ref(false);
const selectedTransaction = ref(null);
const maxLength = 255;

const schema = object({
  student_id: number()
    .typeError("User is required") // ensures number, not string
    .required("User is required"),
  amount: number()
    .typeError("Amount must be a number")
    .required("Amount is required")
    .min(0, "Amount cannot be negative"),
  description: string()
    .required("Description is required")
    .max(
      maxLength,
      `Description cannot be longer than ${maxLength} characters`,
    ),
});

const state = reactive({
  id: undefined,
  student_id: undefined,
  amount: undefined,
  description: undefined,
});

const resetForm = () => {
  state.id = undefined;
  state.student_id = undefined;
  state.amount = undefined;
  state.description = undefined;
};

const calendarRange = ref({
  start: fromDate,
  end: todayDate,
});

const transactionsColumns = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => {
      const val =
        row.original.first_yiddish_name + " " + row.original.last_yiddish_name;
      return val;
    },
  },
  { accessorKey: "date", header: "Date" },
  {
    accessorKey: "description",
    header: "Description",
    meta: {
      class: {
        th: "max-w-md",
        td: "max-w-md breakwords whitespace-normal",
      },
    },
  },
  {
    accessorKey: "deposit",
    header: "Deposit",
    cell: ({ row }) => {
      const val = row.original.amount;
      return val >= 0
        ? h("span", { class: "font-medium text-green-600" }, `$${val}`)
        : "-";
    },
  },
  {
    accessorKey: "check",
    header: "Check",
    cell: ({ row }) => {
      const val = row.original.amount;
      return val < 0
        ? h("span", { class: "font-medium text-red-600" }, `$${Math.abs(val)}`)
        : "-";
    },
  },
  {
    header: "Quick Actions",
    cell: ({ row }) =>
      h("div", { class: "flex gap-2 items-center" }, [
        // Edit User Button
        h(
          resolveComponent("UTooltip"),
          { text: "Edit User" },
          {
            default: () =>
              h(resolveComponent("UButton"), {
                icon: "i-lucide-square-pen",
                size: "md",
                color: "success",
                variant: "soft",
                onClick: () => handleEditClick(row.original),
              }),
          },
        ),

        h(
          resolveComponent("UTooltip"),
          { text: "Delete User" },
          {
            default: () =>
              h(resolveComponent("UButton"), {
                icon: "i-lucide-trash-2",
                size: "md",
                color: "error",
                variant: "soft",
                onClick: () => handleDeleteClick(row.original),
              }),
          },
        ),
      ]),
  },
];

const onClickNewTransaction = () => {
  newTransactionModal.value = true;
  fetchStudents();
};

const fetchStudents = async () => {
  try {
    studentFetching.value = true;
    const response = await api(`/api/students?active_only=true`);

    if (response?.success) {
      students.value = response?.students.map((item) => ({
        label: item?.first_yiddish_name + " " + item?.last_yiddish_name,
        value: item?.id,
      }));
    }
  } catch (err) {
    console.log("🚀 ~ fetchStudents ~ err:", err);
  } finally {
    studentFetching.value = false;
  }
};

const fetchTransactions = async (data) => {
  try {
    loading.value = true;
    const response = await api(`/api/transactions`, {
      method: "GET",
      params: {
        date_from: data?.date_from,
        date_to: data?.date_to,
        page: currentPage.value,
      },
    });

    if (response?.success) {
      transactions.value = response?.transactions;
      currentPage.value = response?.transactions?.current_page;
    }
  } catch (err) {
    console.log("🚀 ~ fetchTransactions ~ err:", err);
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  await fetchTransactions({
    date_from: calendarRange.value.start?.toString(),
    date_to: calendarRange.value.end?.toString(),
  });
});

const handleEditClick = (t) => {
  state.id = t.id;
  state.student_id = t.id;
  state.amount = t.amount;
  state.description = t.description;

  newTransactionModal.value = true;
};

const handleDeleteClick = (t) => {
  selectedTransaction.value = t;
  isDeleteTransactionModalOpen.value = true;
};

const onSubmit = async (event) => {
  isSubmitting.value = true;

  const endpoint = state?.id
    ? `/api/transactions/${state.id}`
    : `/api/transactions`;
  const method = state?.id ? "PUT" : "POST";

  const payload = state?.id
    ? {
        id: state?.id,
        amount: event.data.amount,
        description: event.data.description,
      }
    : {
        student_id: event.data.student_id,
        amount: event.data.amount,
        description: event.data.description,
      };

  try {
    const response = await api(endpoint, {
      method: method,
      body: payload,
    });

    if (response?.success) {
      toast.add({
        title: "Success",
        description: response?.message
          ? response?.message
          : state.id
            ? "Transaction Updated"
            : "Transaction Created",
        color: "success",
        duration: 2000,
      });
      state.id = null;
      newTransactionModal.value = false;
      await fetchTransactions({
        date_from: calendarRange.value.start?.toString(),
        date_to: calendarRange.value.end?.toString(),
      });
    } else if (response?._data?.message) {
      toast.add({
        title: "Failed",
        description: response._data.message,
        color: "error",
      });
    } else {
      toast.add({
        title: "Failed",
        description:
          response?.message || "Something went wrong. Please try again.",
        color: "error",
      });
    }
  } catch (error) {
    console.error("Submission error:", error);
    toast.add({
      title: "Error",
      description: "An unexpected error occurred.",
      color: "error",
    });
  } finally {
    isSubmitting.value = false;
    resetForm();
  }
};

const confirmDeleteTransaction = async () => {
  try {
    isTransactionDeleting.value = true;
    const response = await api(
      `/api/transactions/${selectedTransaction.value.id}`,
      {
        method: "DELETE",
      },
    );

    if (response?.success) {
      toast.add({
        title: "Success",
        description: response?.message || "Transaction Deleted.",
        color: "success",
        duration: 2000,
      });
      isDeleteTransactionModalOpen.value = false;
      await fetchTransactions({
        date_from: calendarRange.value.start?.toString(),
        date_to: calendarRange.value.end?.toString(),
      });

      selectedTransaction.value = null;
    } else {
      toast.add({
        title: "Failed",
        description:
          response?.message ||
          response?._data.errors ||
          response?._data.message ||
          "Error deleting Transaction'",
        color: "error",
        duration: 2000,
      });
    }
  } catch (error) {
    console.error("Error deleting Rules:", error);
  } finally {
    isTransactionDeleting.value = false;
  }
};

const paginationData = computed(() => {
  // Return pagination metadata if it exists
  if (transactions.value && "current_page" in transactions.value) {
    return transactions.value;
  }
  return null;
});

async function goToPage(page) {
  if (page >= 1 && page <= transactions.value.last_page) {
    currentPage.value = page;
    await fetchTransactions({
      date_from: calendarRange.value.start?.toString(),
      date_to: calendarRange.value.end?.toString(),
    });
  }
}
// watch for datepicker changes
watch(
  () => calendarRange.value,
  async (val) => {
    if (!val?.start || !val?.end) return;

    // close popover
    open.value = false;

    // call API
    await fetchTransactions({
      date_from: val.start.toString(),
      date_to: val.end.toString(),
    });
  },
  { deep: true },
);
</script>
<template>
  <UCard class="rounded-2xl shadow-sm">
    <div class="flex justify-between items-center gap-4">
      <h2 class="text-xl font-bold">All Transactions</h2>
      <div class="flex justify-end gap-2">
        <UButton
          @click="onClickNewTransaction"
          icon="i-lucide-circle-plus"
          label="New Transaction"
        />

        <UButton icon="i-lucide-file-text" label="Export" />
      </div>
    </div>
  </UCard>
  <div class="flex justify-between my-6">
    <div class="flex gap-4 items-center">
      <UPopover v-model:open="open">
        <UButton
          color="neutral"
          variant="outline"
          size="lg"
          icon="i-lucide-calendar"
        >
          <template v-if="calendarRange.start">
            <template v-if="calendarRange.end">
              {{ df.format(calendarRange.start.toDate(getLocalTimeZone())) }}
              -
              {{ df.format(calendarRange.end.toDate(getLocalTimeZone())) }}
            </template>
            <template v-else>
              {{ df.format(calendarRange.start.toDate(getLocalTimeZone())) }}
            </template>
          </template>
          <template v-else> Pick a date </template>
        </UButton>

        <template #content>
          <UCalendar
            v-model="calendarRange"
            range
            :number-of-months="2"
            class="p-2"
          />
        </template>
      </UPopover>
    </div>
  </div>

  <!-- Clockings Table -->
  <UCard>
    <UTable
      :columns="transactionsColumns"
      :loading="loading"
      :data="transactions && transactions?.data"
      class="flex-1 mt-6"
    />

    <div
      v-if="paginationData"
      class="flex flex-col md:flex-row items-center justify-between mt-4 w-full gap-4"
    >
      <div class="text-sm text-gray-700">
        Showing {{ paginationData.from }} to {{ paginationData.to }} of
        {{ paginationData.total }} results
      </div>
      <div class="flex flex-col items-center sm:flex-row">
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
  <UModal v-model:open="newTransactionModal">
    <!-- Custom Header -->
    <template #header>
      <div class="flex justify-between w-full">
        <h2 class="text-xl font-bold text-primary">
          {{ state.id ? "Edit" : "Create New" }} Transaction
        </h2>

        <!-- Close Button -->
        <UButton
          size="sm"
          variant="outline"
          color="primary"
          class="rounded-full p-2"
          icon="i-lucide-x"
          @click="
            () => {
              newTransactionModal = false;
              resetForm();
            }
          "
        />
      </div>
    </template>

    <template #body>
      <div
        v-if="studentFetching"
        class="flex items-center justify-center pt-10 w-full"
      >
        <BaseSpinner :show-loader="studentFetching" size="md" />
      </div>

      <UForm
        v-else
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <UFormField v-if="!state?.id" label="Select Student" name="student_id">
          <USelect
            v-model="state.student_id"
            :items="students"
            placeholder="Please Select"
            class="w-full"
            size="lg"
          />
        </UFormField>
        <UFormField label="Amount" name="amount">
          <UInput
            v-model="state.amount"
            class="w-full"
            type="number"
            size="lg"
            placeholder="Enter amount"
          />
        </UFormField>
        <UFormField label="Description" name="description">
          <UTextarea
            v-model="state.description"
            class="w-full"
            type="text"
            size="lg"
            aria-describedby="character-count"
            placeholder="Enter description"
          >
            <template #trailing>
              <div
                id="character-count"
                class="text-xs text-muted tabular-nums"
                aria-live="polite"
                role="status"
              >
                {{ state.description?.length || 0 }}/{{ maxLength }}
              </div>
            </template>
          </UTextarea>
        </UFormField>
        <div
          class="flex justify-end items-center gap-2 mt-4 border-t border-gray-200 pt-4"
        >
          <UButton
            color="neutral"
            variant="solid"
            label="Cancel"
            @click="
              () => {
                newTransactionModal = false;
                resetForm();
              }
            "
          />

          <UButton type="submit" :label="state.id ? 'Update' : 'Create'" />
        </div>
      </UForm>
    </template>
  </UModal>

  <UModal
    v-model:open="isDeleteTransactionModalOpen"
    title="Confirm Delete Transaction"
    :close="{
      color: 'primary',
      variant: 'outline',
      class: 'rounded-full',
    }"
  >
    <template #body>
      <div>
        <p>Are you sure you want to delete this transaction?</p>
      </div>
      <div
        class="flex gap-2 justify-end items-center border-t border-gray-200 mt-4"
      >
        <UButton
          color="neutral"
          variant="solid"
          class="mt-4"
          label="Cancel"
          @click="isDeleteTransactionModalOpen = false"
        />

        <UButton
          color="error"
          variant="solid"
          class="mt-4"
          label="Delete"
          :loading="isTransactionDeleting"
          :disabled="isTransactionDeleting"
          @click="confirmDeleteTransaction()"
        />
      </div>
    </template>
  </UModal>
</template>

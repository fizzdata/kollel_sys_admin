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

// Get today's date
const todayDate = today(getLocalTimeZone());

// Get date 10 days ago
const fromDate = todayDate.subtract({ days: 10 });

const calendarRange = ref({
  start: fromDate,
  end: todayDate,
});

const api = useApi();
const loading = ref(false);
const showModal = ref(false);
const processRules = ref([]);
const processChecksLoading = ref(false);
const processDepositLoading = ref(false);
const newGroup = ref(false);
const isSubmitting = ref(false);
const toast = useToast();
const groups = ref([]);
const deleteModal = ref(false);
const fetchingGroups = ref(false);
const processChecksModal = ref(false);
const processDepositModal = ref(false);
const errorProcessMessages = ref(null);
const operaterLabels = ref({});
const metricLabels = ref({});
const isProcessAllPayrollModalOpen = ref(false);
const processAllPayroll = ref([]);
const errorProcessAllPayrollMessage = ref(null);
const fetchingAllProcessPayroll = ref(false);
const isDeletingProcessAllPayroll = ref(false);
const deleteAllProcessPayrollConfirmModal = ref(false);
const selectedPayroll = ref(null);
const activeTab = ref("0");

const fetchingPayroll = ref(false);
const fetchingSettings = ref(false);
const recentPayroll = ref([]);

const settings = ref(null);

const tabs = [
  { label: "Recent Payroll", key: "recent-payroll" },
  { label: "Groups", key: "groups" },
  { label: "Settings", key: "setting" },
];

const isGroupModalOpen = async () => {
  newGroup.value = true;
  resetGroupForm();
};

const processAllPayrollBtnClick = () => {
  isProcessAllPayrollModalOpen.value = true;
  fetchAllProcessPayroll();
};

const processAllPayrollColumns = [
  { accessorKey: "description", header: "Description" },
  { accessorKey: "date", header: "Date" },
  { accessorKey: "period", header: "Period" },

  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.original.status;

      const statusMap = {
        pending: { color: "warning", label: "Pending" },
        completed: { color: "success", label: "Completed" },
        failed: { color: "error", label: "Failed" },
      };

      const badge = statusMap[status] || {
        color: "neutral",
        label: status,
      };

      return h(
        resolveComponent("UBadge"),
        {
          color: badge.color,
          variant: "solid",
          size: "md",
        },
        () => badge.label,
      );
    },
  },

  { accessorKey: "total", header: "Total" },
  { accessorKey: "type", header: "Type" },

  {
    header: "Quick Actions",
    cell: ({ row }) =>
      h("div", { class: "flex gap-2 items-center" }, [
        h(
          resolveComponent("UTooltip"),
          { text: "Delete Payroll" },
          {
            default: () =>
              h(resolveComponent("UButton"), {
                icon: "i-lucide-trash-2",
                size: "md",
                color: "error",
                variant: "soft",
                disabled: isDeletingProcessAllPayroll.value,
                onClick: () => onConfirmDeleteProcess(row.original),
              }),
          },
        ),
      ]),
  },
];
const onConfirmDeleteProcess = async (payroll) => {
  deleteAllProcessPayrollConfirmModal.value = true;
  selectedPayroll.value = payroll;
};

const confirmDeleteProcessAllPayroll = async () => {
  try {
    isDeletingProcessAllPayroll.value = true;

    if (!selectedPayroll.value) return;
    const response = await api(`/api/payroll/${selectedPayroll.value.id}`, {
      method: "DELETE",
    });

    if (response?.success) {
      toast.add({
        title: "Success",
        description: response?.message || "Group deleted successfully",
        color: "success",
        duration: 2000,
      });

      await fetchAllProcessPayroll();
    } else {
      toast.add({
        title: "Failed",
        description:
          response?._data.errors ||
          response?._data.message ||
          "Failed to delete group",
        color: "error",
        duration: 2000,
      });
    }
  } catch (error) {
    console.error("Error deleting group:", error);
  } finally {
    isDeletingProcessAllPayroll.value = false;
    deleteAllProcessPayrollConfirmModal.value = false;
    selectedPayroll.value = null;
  }
};

const fetchAllProcessPayroll = async () => {
  try {
    fetchingAllProcessPayroll.value = true;
    const response = await api(`/api/payroll`);

    if (response?.success) {
      processAllPayroll.value = response?.payrolls;
    } else {
      errorProcessAllPayrollMessage.value = response?.message;
    }
  } catch (err) {
    console.log("🚀 ~ fetchProcessRules ~ err:", err);
  } finally {
    fetchingAllProcessPayroll.value = false;
  }
};

const isModalOpen = async () => {
  resetGroupForm();
  showModal.value = true;
  await rulesOptionsFetch();
  await fetchProcessRules({
    from_date: calendarRange.value.start?.toString(),
    till_date: calendarRange.value.end?.toString(),
  });
};

// MM/dd/yyyy
const fetchProcessRules = async (date) => {
  try {
    loading.value = true;
    const response = await api(`/api/payroll/process`, {
      method: "GET",
      params: {
        from_date: date?.from_date,
        till_date: date?.till_date,
      },
    });

    if (response?.success) {
      processRules.value = Object.values(response?.data || {});
    } else {
      errorProcessMessages.value = response?.message;
    }
  } catch (err) {
    console.log("🚀 ~ fetchProcessRules ~ err:", err);
  } finally {
    loading.value = false;
  }
};

const columns = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) =>
      h(
        resolveComponent("NuxtLink"),
        {
          to: `/payroll/${row.original.id}`, // dynamic route to user detail page
          class: "text-primary hover:underline",
        },
        row.original.name,
      ),
  },
  {
    accessorKey: "amount",
    header: "Amount",
    cell: ({ row }) => {
      const val = row.original.amount;
      return `$${val}`;
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
                onClick: () => editGroup(row.original),
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
                onClick: () => deleteUser(row.original),
              }),
          },
        ),
      ]),
  },
];
const recentPayrollColumns = [
  {
    accessorKey: "date",
    header: "Date",
  },
  {
    accessorKey: "type",
    header: "Type",
  },
  {
    accessorKey: "period",
    header: "Period",
  },
  {
    accessorKey: "description",
    header: "Description",
  },
  // {
  //   accessorKey: "amount-paid",
  //   header: "Amount Paid",
  // },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.original.status;

      const statusMap = {
        pending: { color: "warning", label: "Pending" },
        completed: { color: "success", label: "Completed" },
        failed: { color: "error", label: "Failed" },
      };

      const badge = statusMap[status] || {
        color: "neutral",
        label: status,
      };

      return h(
        resolveComponent("UBadge"),
        {
          color: badge.color,
          variant: "solid",
          size: "md",
        },
        () => badge.label,
      );
    },
  },
  // {
  //   accessorKey: "undo-payroll",
  //   header: "Undo Payroll",
  // },
];

const groupSchema = object({
  name: string().required("Name is required"),
  base_amount: number()
    .typeError("Base Amount must be a number")
    .required("Base Amount is required"),

  min_amount: number().typeError("Min Amount must be a number").nullable(),
});

const groupForm = ref({
  id: null,
  name: "",
  base_amount: null,
  min_amount: 0,
});

const groupState = reactive({ ...groupForm.value });

const resetGroupForm = () => {
  Object.assign(groupForm.value, {
    id: null,
    name: "",
    base_amount: null,
    min_amount: 0,
  });

  Object.assign(groupState, groupForm.value);
};

const handleClose = () => {
  resetGroupForm();
};

const onSubmit = async (event) => {
  try {
    isSubmitting.value = true;

    const endpoint = groupForm.value.id
      ? `/api/payroll/groups/${groupForm.value.id}`
      : `/api/payroll/groups`;

    const method = groupForm.value.id ? "PUT" : "POST";
    delete event.data.id;

    const payload = groupForm.value.id
      ? {
          name: event.data.name,
          amount: event.data.base_amount ?? event.data.min_amount,
          base_amount: event.data.base_amount,
          min_amount: event.data.min_amount,
        }
      : {
          name: event.data.name,
          base_amount: event.data.base_amount,
          min_amount: event.data.min_amount,
        };

    const response = await api(endpoint, {
      method: method,
      body: payload,
    });

    if (response?.success) {
      toast.add({
        title: "Success",
        description: response?.message || "Group created successfully",
        color: "success",
        duration: 2000,
      });

      // Reset form state after submission
      resetGroupForm();

      await fetchGroups();
    } else {
      toast.add({
        title: "Failed",
        description:
          response?._data.errors ||
          response?._data.message ||
          "Failed to create group",
        color: "error",
        duration: 2000,
      });
    }
  } catch (error) {
    console.error("Error creating group:", error);
  } finally {
    isSubmitting.value = false;
    newGroup.value = false; // Close the modal
  }
};

const fetchProcessChecks = async (data) => {
  try {
    processChecksLoading.value = true;
    const response = await api(`/api/payroll/process/checks`, {
      method: "POST",
      body: {
        from_date: data?.from_date,
        till_date: data?.till_date,
        description: data?.description,
      },
    });

    if (response?.success) {
      toast.add({
        title: "Success",
        description: response?.message || "Checks processed successfully",
        color: "success",
        duration: 2000,
      });
      processChecksModal.value = false;
      fetchRecentPayroll();
    } else {
      toast.add({
        title: "Failed",
        description:
          response?.message ||
          response?._data.errors ||
          response?._data.message ||
          "Failed to delete group",
        color: "error",
        duration: 2000,
      });
    }
  } catch (err) {
    console.log("🚀 ~ fetchProcessRules ~ err:", err);
  } finally {
    processChecksLoading.value = false;
  }
};

const fetchProcessDeposit = async (data) => {
  try {
    processDepositLoading.value = true;
    const response = await api(`/api/payroll/process/deposit`, {
      method: "POST",
      body: {
        from_date: data?.from_date,
        till_date: data?.till_date,
        description: data?.description,
      },
    });

    if (response?.success) {
      toast.add({
        title: "Success",
        description: response?.message || "Direct deposit processing started",
        color: "success",
        duration: 2000,
      });
      processDepositModal.value = false;
      fetchRecentPayroll();
    } else {
      toast.add({
        title: "Failed",
        description:
          response?.message ||
          response?._data.errors ||
          response?._data.message ||
          "Failed to delete group",
        color: "error",
        duration: 2000,
      });
    }
  } catch (err) {
    console.log("🚀 ~ fetchProcessRules ~ err:", err);
  } finally {
    processDepositLoading.value = false;
  }
};

const fetchGroups = async () => {
  try {
    fetchingGroups.value = true;
    const response = await api(`/api/payroll/groups`, {
      method: "GET",
    });

    if (response?.success) {
      groups.value = response.wages_groups.map((g) => ({
        ...g,
        base_amount: g.amount, // backend uses "amount", UI uses "base_amount"
      }));
    }
  } catch (err) {
    console.log("🚀 ~ fetchGroups ~ err:", err);
  } finally {
    fetchingGroups.value = false;
  }
};

const fetchRecentPayroll = async () => {
  try {
    fetchingPayroll.value = true;
    const response = await api(`/api/payroll`);

    if (response?.success) {
      recentPayroll.value = response?.payrolls;
    }
  } catch (err) {
    console.log("🚀 ~ fetchGroups ~ err:", err);
  } finally {
    fetchingPayroll.value = false;
  }
};

const fetchSettings = async () => {
  try {
    fetchingSettings.value = true;
    const response = await api(`/api/payroll/settings`);

    if (response?.success) {
      settings.value = response?.settings;
    }
  } catch (err) {
    console.log("🚀 ~ fetchGroups ~ err:", err);
  } finally {
    fetchingSettings.value = false;
  }
};

// watch for tab changes
watch(activeTab, (newTab) => {
  if (newTab === "0") {
    fetchRecentPayroll();
  } else if (newTab === "1") {
    fetchGroups();
  } else if (newTab === "2") {
    fetchSettings();
  }
});

onMounted(async () => {
  // Initial fetch when component is mounted
  await fetchRecentPayroll();
});

const editGroup = (group) => {
  // Open modal instantly
  newGroup.value = true;

  // Fill form instantly
  groupForm.value.id = group.id;
  groupState.name = group.name;
  groupState.base_amount = group.amount;
  groupState.min_amount = group.min_amount;
};

const deleteUser = (group) => {
  deleteModal.value = true;

  groupForm.value.id = group.id;
  groupState.name = group.name;
};

const confirmDeleteGroup = async () => {
  try {
    isSubmitting.value = true;

    const response = await api(`/api/payroll/groups/${groupForm.value.id}`, {
      method: "DELETE",
    });

    if (response?.success) {
      toast.add({
        title: "Success",
        description: response?.message || "Group deleted successfully",
        color: "success",
        duration: 2000,
      });

      await fetchGroups();
      // Reset form state after deletion
      resetGroupForm();
    } else {
      toast.add({
        title: "Failed",
        description:
          response?._data.errors ||
          response?._data.message ||
          "Failed to delete group",
        color: "error",
        duration: 2000,
      });
    }
  } catch (error) {
    console.error("Error deleting group:", error);
  } finally {
    isSubmitting.value = false;
    deleteModal.value = false; // Close the modal
  }
};

const rulesOptionsFetch = async () => {
  try {
    const response = await api(`/api/payroll/rules-options`);

    if (response?.success) {
      // Set labels for display
      metricLabels.value = response.metrics.reduce((acc, m) => {
        acc[m.metric] = m.description;
        return acc;
      }, {});
      operaterLabels.value = response.operators.reduce((acc, op) => {
        acc[op.operator] = op.description;
        return acc;
      }, {});
    }
  } catch (error) {
    console.error("An error occurred:", error.message);
  }
};

// watch for datepicker changes
const onDateChange = async (val) => {
  if (!val?.start || !val?.end) return;

  await fetchProcessRules({
    from_date: val.start.toString(),
    till_date: val.end.toString(),
  });
};

// watch for Create Check Datepicker changes
const onProcessCheckFormSubmit = async (val) => {
  if (!val?.from_date || !val?.till_date) {
    toast.add({
      title: "Error",
      description: "Please select a valid date range.",
      color: "error",
    });
  }

  await fetchProcessChecks({
    ...val,
  });
};

// watch for Process Deposit Datepicker changes
const onProcessDepositFormSubmit = async (val) => {
  if (!val?.from_date || !val?.till_date) {
    toast.add({
      title: "Error",
      description: "Please select a valid date range.",
      color: "error",
    });
  }

  await fetchProcessDeposit({
    ...val,
  });
};
</script>

<template>
  <UCard class="rounded-2xl shadow-sm">
    <div class="flex justify-between items-center gap-4">
      <h2 class="text-xl font-bold">
        {{
          activeTab === "0"
            ? "Recent Payroll"
            : activeTab === "1"
              ? "Payroll Groups"
              : "Payroll Settings"
        }}
      </h2>

      <div class="flex flex-wrap gap-2 justify-end">
        <UButton
          @click="isGroupModalOpen"
          icon="la:user-plus"
          label="New Group"
        />
        <UButton
          @click="processAllPayrollBtnClick"
          icon="i-lucide-settings"
          label="Process All Payroll"
        />
        <UButton
          @click="isModalOpen"
          icon="i-lucide-settings"
          label="Process"
        />
        <UButton
          @click="processChecksModal = true"
          icon="i-lucide-check-square"
          label="Process Checks"
        />
        <UButton
          @click="processDepositModal = true"
          icon="i-lucide-wallet"
          label="Process Deposit"
        />
      </div>
    </div>
  </UCard>
  <UTabs v-model="activeTab" :items="tabs" variant="link" class="mt-6" />
  <UCard v-if="activeTab === '0'" class="my-6">
    <UTable
      :columns="recentPayrollColumns"
      :loading="fetchingPayroll"
      :data="recentPayroll"
      class="flex-1 mt-6"
    />
  </UCard>
  <UCard v-if="activeTab === '1'" class="my-6">
    <UTable
      :columns="columns"
      :loading="fetchingGroups"
      :data="groups"
      class="flex-1 mt-6"
    />
  </UCard>
  <PayrollSettings
    v-if="activeTab === '2'"
    :fetchingSettings="fetchingSettings"
    :data="settings"
    @refresh="fetchSettings()"
  />

  <!-- Create Group Modal -->
  <UModal v-model:open="newGroup">
    <!-- Custom Header -->
    <template #header>
      <div class="flex justify-between w-full">
        <h2 class="text-xl font-bold text-primary">
          {{ groupForm.id ? "Update Group" : "Create New Group" }}
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
              handleClose();
              newGroup = false;
            }
          "
        >
        </UButton>
      </div>
    </template>
    <template #body>
      <UForm
        :schema="groupSchema"
        :state="groupState"
        class="space-y-4"
        @submit="onSubmit"
      >
        <UFormField label="Name" name="name">
          <UInput
            v-model="groupState.name"
            placeholder="Enter group name"
            class="w-full"
            size="lg"
          />
        </UFormField>

        <UFormField label="Base Amount" name="base_amount">
          <UInput
            v-model.number="groupState.base_amount"
            type="number"
            placeholder="Enter base amount"
            class="w-full"
            size="lg"
          />
        </UFormField>

        <UFormField label="Min Amount" name="min_amount">
          <UInput
            v-model.number="groupState.min_amount"
            type="number"
            placeholder="Enter min amount"
            min="0"
            class="w-full"
            size="lg"
          />
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
                handleClose();
                newGroup = false;
              }
            "
          />

          <UButton
            type="submit"
            :loading="isSubmitting"
            :disabled="isSubmitting"
            :label="groupForm.id ? 'Update Group' : 'Create Group'"
          />
        </div>
      </UForm>
    </template>
  </UModal>

  <!-- Modal for Processing Rules -->

  <CommonRulesModal
    v-model="showModal"
    title="Processing Rules"
    :rules="processRules"
    :loading="loading"
    :metric-labels="metricLabels"
    :operater-labels="operaterLabels"
    type="process"
    @date-change="onDateChange"
  />

  <!-- Modal for Process Check Rules -->
  <CommonChecksDepositModal
    v-model="processChecksModal"
    title="Process Checks"
    :loading="processChecksLoading"
    type="check"
    @submit="onProcessCheckFormSubmit"
  />

  <!-- Modal for deposit Rules -->
  <CommonChecksDepositModal
    v-model="processDepositModal"
    title="Process Deposit"
    :loading="processDepositLoading"
    type="deposit"
    @submit="onProcessDepositFormSubmit"
  />

  <!-- Modal for Delete Payroll -->
  <UModal
    v-model:open="deleteModal"
    title="Confirm Delete Group"
    :close="{
      color: 'primary',
      variant: 'outline',
      class: 'rounded-full',
    }"
  >
    <template #body>
      <div>
        <p>
          Are you sure you want to delete
          <span v-if="groupState?.name" class="font-bold">
            {{ groupState?.name }}
          </span>
          this group?
        </p>
      </div>
      <div class="flex gap-2 justify-end items-center">
        <UButton
          color="neutral"
          variant="solid"
          class="mt-4"
          label="Cancel"
          @click="
            () => {
              deleteModal = false;
            }
          "
        />
        <UButton
          color="error"
          variant="solid"
          class="mt-4"
          :loading="isSubmitting"
          :disabled="isSubmitting"
          @click="confirmDeleteGroup()"
          label="Delete"
        />
      </div>
    </template>
  </UModal>

  <!-- Process All Payroll Modal -->
  <UModal v-model:open="isProcessAllPayrollModalOpen" fullscreen>
    <template #header>
      <div class="flex justify-between w-full">
        <h2 class="text-xl font-bold text-primary">Process All Payroll</h2>

        <!-- Close Button -->
        <UButton
          size="sm"
          variant="outline"
          color="primary"
          class="rounded-full p-2"
          icon="i-lucide-x"
          @click="isProcessAllPayrollModalOpen = false"
        />
      </div>
    </template>
    <template #body>
      <UTable
        :columns="processAllPayrollColumns"
        :data="processAllPayroll"
        :loading="fetchingAllProcessPayroll"
        class="flex-1 mt-6"
      />
    </template>
  </UModal>
  <!-- Modal for Delete Process All Payroll Confirmation -->
  <UModal
    v-model:open="deleteAllProcessPayrollConfirmModal"
    title="Confirm Delete Payroll"
    :close="{
      color: 'primary',
      variant: 'outline',
      class: 'rounded-full',
    }"
  >
    <template #body>
      <div>
        <p>
          Are you sure you want to delete this
          <span v-if="selectedPayroll?.type" class="font-bold">
            {{ selectedPayroll?.type }}?
          </span>
        </p>
      </div>
      <div class="flex gap-2 justify-end items-center">
        <UButton
          color="neutral"
          variant="solid"
          class="mt-4"
          label="Cancel"
          @click="
            () => {
              deleteAllProcessPayrollConfirmModal = false;
            }
          "
        />
        <UButton
          color="error"
          variant="solid"
          class="mt-4"
          label="Delete"
          :loading="isDeletingProcessAllPayroll"
          :disabled="isDeletingProcessAllPayroll"
          @click="confirmDeleteProcessAllPayroll()"
        />
      </div>
    </template>
  </UModal>
</template>

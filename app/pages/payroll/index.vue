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
// const df = new DateFormatter("en-US", {
//   year: "numeric",
//   month: "2-digit",
//   day: "2-digit",
// });
const df = new DateFormatter("en-US", {
  dateStyle: "medium",
});
// Get today's date
const todayDate = today(getLocalTimeZone());

// Get date 10 days ago
const fromDate = todayDate.subtract({ days: 10 });

const calendarRange = ref({
  start: fromDate,
  end: todayDate,
});
const checkscalendarRange = ref({
  start: fromDate,
  end: todayDate,
});
const depositcalendarRange = ref({
  start: fromDate,
  end: todayDate,
});

const api = useApi();
const loading = ref(false);
const showModal = ref(false);
const open = ref(false);
const processRules = ref([]);
const processChecksLoading = ref(false);
const processDepositLoading = ref(false);
const newGroup = ref(false);
const isSubmitting = ref(false);
const toast = useToast();
const groups = ref([]);
const deleteModal = ref(false);
const fetchingGroups = ref(false);
const processCheckMessage = ref("");
const processDespositMessage = ref("");
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
        () => badge.label
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
          }
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
      // Reset form state after deletion
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

    // console.log(fetch);
    if (response?.success) {
      processAllPayroll.value = response?.payrolls;
      console.log("processAllPayroll", processAllPayroll.value);
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

    // console.log(fetch);
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
        row.original.name
      ),
  },
  { accessorKey: "amount", header: "Amount Name" },
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
          }
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
          }
        ),
      ]),
  },
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

const fetchProcessChecks = async (date) => {
  try {
    processChecksLoading.value = true;
    const response = await api(`/api/payroll/process/checks`, {
      method: "POST",
      params: {
        from_date: date?.from_date,
        till_date: date?.till_date,
      },
    });

    if (response?.success) {
      processCheckMessage.value = response?.message;
    }
    console.log("createChecks", processCheckMessage.value);
  } catch (err) {
    console.log("🚀 ~ fetchProcessRules ~ err:", err);
  } finally {
    processChecksLoading.value = false;
  }
};
const isChecksModalOpen = async () => {
  processChecksModal.value = true;
  await fetchProcessChecks({
    from_date: checkscalendarRange.value.start?.toString(),
    till_date: checkscalendarRange.value.end?.toString(),
  });
};
const fetchProcessDeposit = async (date) => {
  try {
    processDepositLoading.value = true;

    const response = await api(`/api/payroll/process/deposit`, {
      method: "POST",
      params: {
        from_date: date?.from_date,
        till_date: date?.till_date,
      },
    });
    console.log("🚀 ~ fetchProcessDeposit ~ response:", response);

    if (response) {
      processDespositMessage.value = response?.message;
    }
    console.log("createChecks", processDespositMessage.value);
  } catch (err) {
    console.log("🚀 ~ fetchProcessRules ~ err:", err);
  } finally {
    processDepositLoading.value = false;
  }
};
const isDepositModalOpen = async () => {
  processDepositModal.value = true;
  await fetchProcessDeposit({
    from_date: depositcalendarRange.value.start?.toString(),
    till_date: depositcalendarRange.value.end?.toString(),
  });
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
      // You can store the fetched groups in a reactive variable if needed
    }
  } catch (err) {
    console.log("🚀 ~ fetchGroups ~ err:", err);
  } finally {
    fetchingGroups.value = false;
  }
};

onMounted(async () => {
  // Initial fetch when component is mounted
  await fetchGroups();
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
const onCheckDateChange = async (val) => {
  if (!val?.start || !val?.end) return;

  await fetchProcessChecks({
    from_date: val.start.toString(),
    till_date: val.end.toString(),
  });
};

// watch for Process Deposit Datepicker changes
const onDepositDateChange = async (val) => {
  if (!val?.start || !val?.end) return;

  await fetchProcessDeposit({
    from_date: val.start.toString(),
    till_date: val.end.toString(),
  });
};
</script>

<template>
  <UCard class="rounded-2xl shadow-sm">
    <div class="flex justify-between items-center gap-4">
      <h2 class="text-xl font-bold">Payroll Groups</h2>
      <div class="flex flex-wrap gap-2 justify-end">
        <UButton
          @click="isGroupModalOpen"
          icon="la:user-plus"
          label="New Group"
        >
        </UButton>

        <UButton
          @click="processAllPayrollBtnClick"
          icon="i-lucide-settings"
          label="Process All Payroll"
        />
        <UButton @click="isModalOpen" icon="i-lucide-settings" label="Process">
        </UButton>
        <UButton
          @click="isChecksModalOpen"
          icon="i-lucide-check-square"
          label="Process Checks"
        >
        </UButton>

        <UButton
          @click="isDepositModalOpen"
          icon="i-lucide-wallet"
          label="Process Deposit"
        >
        </UButton>
      </div>
    </div>
  </UCard>
  <UCard class="my-6">
    <UTable
      :columns="columns"
      :loading="fetchingGroups"
      :data="groups"
      class="flex-1 mt-6"
    />
  </UCard>

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
          />
        </UFormField>

        <UFormField label="Base Amount" name="base_amount">
          <UInput
            v-model.number="groupState.base_amount"
            type="number"
            placeholder="Enter base amount"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Min Amount" name="min_amount">
          <UInput
            v-model.number="groupState.min_amount"
            type="number"
            placeholder="Enter min amount"
            min="0"
            class="w-full"
          />
        </UFormField>

        <div
          class="flex justify-end items-center gap-2 mt-4 border-t border-gray-200 pt-4"
        >
          <UButton
            color="neutral"
            variant="solid"
            @click="
              () => {
                handleClose();
                newGroup = false;
              }
            "
          >
            Cancel
          </UButton>
          <UButton
            type="submit"
            :loading="isSubmitting"
            :disabled="isSubmitting"
          >
            {{ groupForm.id ? "Update Group" : "Create Group" }}
          </UButton>
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
  <CommonRulesModal
    v-model="processChecksModal"
    title="Process Checks"
    :loading="processChecksLoading"
    :message="processCheckMessage"
    type="check"
    @date-change="onCheckDateChange"
  />

  <!-- Modal for deposit Rules -->
  <CommonRulesModal
    v-model="processDepositModal"
    title="Process Deposit"
    :loading="processDepositLoading"
    :message="processDespositMessage"
    type="deposit"
    @date-change="onDepositDateChange"
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
          @click="
            () => {
              deleteModal = false;
            }
          "
        >
          Cancel
        </UButton>
        <UButton
          color="error"
          variant="solid"
          class="mt-4"
          :loading="isSubmitting"
          :disabled="isSubmitting"
          @click="confirmDeleteGroup()"
        >
          Delete
        </UButton>
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
        >
        </UButton>
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
          @click="
            () => {
              deleteAllProcessPayrollConfirmModal = false;
            }
          "
        >
          Cancel
        </UButton>
        <UButton
          color="error"
          variant="solid"
          class="mt-4"
          :loading="isDeletingProcessAllPayroll"
          :disabled="isDeletingProcessAllPayroll"
          @click="confirmDeleteProcessAllPayroll()"
        >
          Delete
        </UButton>
      </div>
    </template>
  </UModal>
</template>

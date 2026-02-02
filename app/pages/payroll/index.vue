<script setup>
import { today, getLocalTimeZone } from "@internationalized/date";
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
const route = useRoute();
const router = useRouter();
const loading = ref(false);
const showModal = ref(false);
const processRulesResponse = ref(null);
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
const isDeletingProcessAllPayroll = ref(false);
const deleteAllProcessPayrollConfirmModal = ref(false);
const selectedPayroll = ref(null);
const activeTab = ref(route?.query?.tab || "0");

const fetchingPayroll = ref(false);
const fetchingSettings = ref(false);
const recentPayroll = ref([]);

const settings = ref(null);

// All Students state
const allStudentsData = ref([]);
const fetchingAllStudents = ref(false);
const selectedStudentForAction = ref(null);
const singleStudentCheckModal = ref(false);
const singleStudentDepositModal = ref(false);
const processCheckSingleStudentLoading = ref(false);
const processDepositSingleStudentLoading = ref(false);
const studentPreviewModal = ref(false);
const fetchingStudentPreview = ref(false);
const studentPreviewData = ref([]);

const tabs = [
  { label: "Recent Payroll", key: "recent-payroll" },
  { label: "Groups", key: "groups" },
  { label: "All Students", key: "all-students" },
  { label: "Settings", key: "setting" },
];

const isGroupModalOpen = async () => {
  newGroup.value = true;
  resetGroupForm();
};

const onConfirmDeleteProcess = async (payroll) => {
  deleteAllProcessPayrollConfirmModal.value = true;
  selectedPayroll.value = payroll;
};

const confirmDeleteProcessAllPayroll = async () => {
  try {
    isDeletingProcessAllPayroll.value = true;

    if (!selectedPayroll.value) {
      toast.add({
        title: "Error",
        description: "No payroll selected for deletion",
        color: "error",
      });
    }
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
      deleteAllProcessPayrollConfirmModal.value = false;
      selectedPayroll.value = null;
      await fetchRecentPayroll();
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
    const response = await api(`/api/payroll/preview`, {
      method: "GET",
      params: {
        from_date: date?.from_date,
        till_date: date?.till_date,
      },
    });

    if (response?.success) {
      processRulesResponse.value = response;
      console.log(
        "🚀 ~ fetchProcessRules ~ processRulesResponse.value:",
        processRulesResponse.value,
      );
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
          to: `/payroll/${row.original.id}?tab=${route.query.tab}`, // dynamic route to user detail page
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
    accessorKey: "description",
    header: "Description",
  },
  {
    accessorKey: "date",
    header: "Date",
  },
  {
    accessorKey: "period",
    header: "Period",
  },

  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.original.status;

      const statusMap = {
        pending: { color: "warning", label: "Pending" },
        completed: { color: "success", label: "Completed" },
        failed: { color: "error", label: "Failed" },
        unknown: { color: "primary", label: "Unknown" },
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
  {
    accessorKey: "total",
    header: "Total",
    cell: ({ row }) => {
      const val = row.original.total;
      return `$${val}`;
    },
  },
  {
    accessorKey: "type",
    header: "Type",
  },
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

const allStudentsColumns = [
  {
    accessorKey: "first_name",
    header: "Full Name",
    cell: ({ row }) =>
      `${row.original.first_yiddish_name} ${row.original.last_yiddish_name}`,
  },

  {
    accessorKey: "groups",
    header: "Groups",
    cell: ({ row }) => {
      const groups = row.original.groups;

      // Handle if groups is an object with group names as values
      let groupList = [];
      if (typeof groups === "object" && groups !== null) {
        // If it's an array
        if (Array.isArray(groups)) {
          groupList = groups.map((g) =>
            typeof g === "string" ? g : g.name || g,
          );
        } else {
          // If it's an object, get the values
          groupList = Object.values(groups).map((g) =>
            typeof g === "string" ? g : g.name || g,
          );
        }
      }

      return h(
        "div",
        { class: "flex flex-wrap gap-1" },
        groupList.map((group) =>
          h(
            resolveComponent("UBadge"),
            {
              color: "info",
              variant: "soft",
              size: "sm",
            },
            () => group,
          ),
        ),
      );
    },
  },
  {
    header: "Quick Actions",
    cell: ({ row }) =>
      h("div", { class: "flex gap-2 items-center" }, [
        // Preview Student Button
        h(
          resolveComponent("UTooltip"),
          { text: "Preview Student" },
          {
            default: () =>
              h(resolveComponent("UButton"), {
                icon: "i-lucide-user-check",
                size: "md",
                color: "success",
                variant: "soft",
                onClick: () => handleMainPagePreviewStudentClick(row.original),
              }),
          },
        ),

        // Process Check Button
        h(
          resolveComponent("UTooltip"),
          { text: "Process Check" },
          {
            default: () =>
              h(resolveComponent("UButton"), {
                icon: "i-lucide-check-square",
                size: "md",
                color: "info",
                variant: "soft",
                onClick: () => handleMainPageCheckStudentClick(row.original),
              }),
          },
        ),

        // Process Deposit Button
        h(
          resolveComponent("UTooltip"),
          { text: "Process Deposit" },
          {
            default: () =>
              h(resolveComponent("UButton"), {
                icon: "i-lucide-wallet",
                size: "md",
                color: "warning",
                variant: "soft",
                onClick: () => handleMainPageDepositStudentClick(row.original),
              }),
          },
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
        description:
          response?.message || groupForm.value.id
            ? "Group updated successfully"
            : "Group created successfully",
        color: "success",
        duration: 2000,
      });

      // Reset form state after submission
      resetGroupForm();
      newGroup.value = false; // Close the modal
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
  }
};

const fetchProcessChecks = async (data) => {
  try {
    processChecksLoading.value = true;
    const response = await api(`/api/payroll/process/check`, {
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
          "Failed to process checks",
        color: "error",
        duration: 2000,
      });
    }
  } catch (err) {
    console.log("🚀 ~ fetchProcessChecks ~ err:", err);
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
          "Failed to process direct deposit",
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

      deleteModal.value = false; // Close the modal
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

// Fetch all students with groups
const fetchAllStudents = async () => {
  try {
    fetchingAllStudents.value = true;
    const response = await api(`/api/students/groups`);

    if (response?.success) {
      const students = response?.students || [];

      // If students is an object, convert it to an array
      let studentsArray = [];
      if (typeof students === "object" && !Array.isArray(students)) {
        studentsArray = Object.values(students);
      } else if (Array.isArray(students)) {
        studentsArray = students;
      }

      allStudentsData.value = studentsArray;
    }
  } catch (err) {
    console.error("🚀 ~ fetchAllStudents ~ err:", err);
    allStudentsData.value = [];
  } finally {
    fetchingAllStudents.value = false;
  }
};

// Handler for preview student on main page
const handleMainPagePreviewStudentClick = async (student) => {
  selectedStudentForAction.value = student;
  studentPreviewModal.value = true;
  await fetchMainPageStudentPreview({
    from_date: calendarRange.value.start?.toString(),
    till_date: calendarRange.value.end?.toString(),
  });
};

// Fetch student preview data across all groups
const fetchMainPageStudentPreview = async (data) => {
  try {
    if (selectedStudentForAction.value) {
      fetchingStudentPreview.value = true;
      const response = await api(
        `/api/payroll/students/${selectedStudentForAction.value.id}/preview`,
        {
          method: "GET",
          params: {
            from_date: data?.from_date,
            till_date: data?.till_date,
          },
        },
      );

      if (response?.success) {
        // Handle if response is an array or object
        let previewArray = [];
        if (
          typeof response.data === "object" &&
          !Array.isArray(response.data)
        ) {
          previewArray = Object.values(response.data).flatMap((item) =>
            Array.isArray(item) ? item : Object.values(item || {}),
          );
        } else if (Array.isArray(response.data)) {
          previewArray = response.data;
        }
        studentPreviewData.value = previewArray;
      } else {
        toast.add({
          title: "Failed",
          description: response?.message || "Failed to fetch student preview",
          color: "error",
          duration: 2000,
        });
      }
    }
  } catch (error) {
    console.error("Error fetching student preview:", error);
    toast.add({
      title: "Error",
      description: "An error occurred while fetching preview",
      color: "error",
      duration: 2000,
    });
  } finally {
    fetchingStudentPreview.value = false;
  }
};

// Date change handler for student preview
const onMainPageStudentPreviewDateChange = async (val) => {
  if (!val?.start || !val?.end) return;

  await fetchMainPageStudentPreview({
    from_date: val.start.toString(),
    till_date: val.end.toString(),
  });
};

// Handler for process check on main page
const handleMainPageCheckStudentClick = async (student) => {
  selectedStudentForAction.value = student;
  singleStudentCheckModal.value = true;
};

// Handler for process deposit on main page
const handleMainPageDepositStudentClick = async (student) => {
  selectedStudentForAction.value = student;
  singleStudentDepositModal.value = true;
};

// Process check for student across groups
const fetchMainPageStudentCheck = async (data) => {
  try {
    if (selectedStudentForAction.value) {
      processCheckSingleStudentLoading.value = true;

      // Process check for student across all their groups
      const response = await api(
        `/api/payroll/students/${selectedStudentForAction.value.id}/process/check`,
        {
          method: "POST",
          body: {
            from_date: data?.from_date,
            till_date: data?.till_date,
          },
        },
      );

      if (response?.success) {
        toast.add({
          title: "Success",
          description:
            response?.message || "Student checks processed successfully",
          color: "success",
          duration: 2000,
        });
        singleStudentCheckModal.value = false;
      } else {
        toast.add({
          title: "Failed",
          description:
            response?.message ||
            response?._data?.errors ||
            response?._data?.message ||
            "Failed to process checks",
          color: "error",
          duration: 2000,
        });
      }
    }
  } catch (error) {
    console.error("Error processing checks:", error);
    toast.add({
      title: "Error",
      description: "An error occurred while processing checks",
      color: "error",
      duration: 2000,
    });
  } finally {
    processCheckSingleStudentLoading.value = false;
  }
};

// Process deposit for student across groups
const fetchMainPageStudentDeposit = async (data) => {
  try {
    if (selectedStudentForAction.value) {
      processDepositSingleStudentLoading.value = true;

      // Process deposit for student across all their groups
      const response = await api(
        `/api/payroll/students/${selectedStudentForAction.value.id}/process/deposit`,
        {
          method: "POST",
          body: {
            from_date: data?.from_date,
            till_date: data?.till_date,
          },
        },
      );

      if (response?.success) {
        toast.add({
          title: "Success",
          description:
            response?.message || "Student deposit processed successfully",
          color: "success",
          duration: 2000,
        });
        singleStudentDepositModal.value = false;
      } else {
        toast.add({
          title: "Failed",
          description:
            response?.message ||
            response?._data?.errors ||
            response?._data?.message ||
            "Failed to process deposit",
          color: "error",
          duration: 2000,
        });
      }
    }
  } catch (error) {
    console.error("Error processing deposit:", error);
    toast.add({
      title: "Error",
      description: "An error occurred while processing deposit",
      color: "error",
      duration: 2000,
    });
  } finally {
    processDepositSingleStudentLoading.value = false;
  }
};

// Date change handlers for student modals
const onMainPageStudentCheckDateChange = async (val) => {
  if (!val?.from_date || !val?.till_date) {
    toast.add({
      title: "Error",
      description: "Please select a valid date range.",
      color: "error",
    });
    return;
  }

  await fetchMainPageStudentCheck({
    from_date: val.from_date,
    till_date: val.till_date,
  });
};

const onMainPageStudentDepositDateChange = async (val) => {
  if (!val?.from_date || !val?.till_date) {
    toast.add({
      title: "Error",
      description: "Please select a valid date range.",
      color: "error",
    });
    return;
  }

  await fetchMainPageStudentDeposit({
    from_date: val.from_date,
    till_date: val.till_date,
  });
};

const handleTabUpdate = (newValue) => {
  router.replace({
    query: {
      ...route.query,
      tab: newValue,
    },
  });
};

watch(
  activeTab,
  (newTab) => {
    if (newTab === "0") {
      fetchRecentPayroll();
    } else if (newTab === "1") {
      fetchGroups();
    } else if (newTab === "2") {
      fetchAllStudents();
    } else if (newTab === "3") {
      fetchSettings();
    }
  },
  { immediate: true },
);
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
              : activeTab === "2"
                ? "All Students"
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

  <!-- Tabs -->
  <UTabs
    v-model="activeTab"
    :items="tabs"
    variant="link"
    class="mt-6"
    @update:model-value="handleTabUpdate"
  />

  <!-- Recent Payroll Tab 1 -->
  <UCard v-if="activeTab === '0'" class="my-6">
    <UTable
      :columns="recentPayrollColumns"
      :loading="fetchingPayroll"
      :data="recentPayroll"
      class="flex-1 mt-6"
    />
  </UCard>

  <!-- Fetch Group Tab 2 -->
  <UCard v-if="activeTab === '1'" class="my-6">
    <UTable
      :columns="columns"
      :loading="fetchingGroups"
      :data="groups"
      class="flex-1 mt-6"
    />
  </UCard>

  <!-- All Students Tab 3 -->
  <UCard v-if="activeTab === '2'" class="my-6">
    <UTable
      :columns="allStudentsColumns"
      :loading="fetchingAllStudents"
      :data="allStudentsData"
      class="flex-1 mt-6"
    />
  </UCard>

  <!-- Fetch Settings Tab 4 -->
  <PayrollSettings
    v-if="activeTab === '3'"
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
    :rules="[]"
    :message="processRulesResponse"
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
      <div
        class="flex gap-2 justify-end items-center border-t border-gray-200 mt-4"
      >
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
      <div
        class="flex gap-2 justify-end items-center border-t border-gray-200 mt-4"
      >
        <UButton
          color="neutral"
          variant="solid"
          class="mt-4"
          label="Cancel"
          @click="deleteAllProcessPayrollConfirmModal = false"
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

  <!-- Single Student Processing Check Modal (Main Page) -->
  <CommonChecksDepositModal
    v-model="singleStudentCheckModal"
    :title="
      selectedStudentForAction
        ? `${selectedStudentForAction.first_yiddish_name} ${selectedStudentForAction.last_yiddish_name} : Process Checks`
        : 'Process Checks'
    "
    :loading="processCheckSingleStudentLoading"
    type="check"
    isStudent
    @submit="onMainPageStudentCheckDateChange"
  />

  <!-- Single Student Processing Deposit Modal (Main Page) -->
  <CommonChecksDepositModal
    v-model="singleStudentDepositModal"
    :title="
      selectedStudentForAction
        ? `${selectedStudentForAction.first_yiddish_name} ${selectedStudentForAction.last_yiddish_name} : Process Deposit`
        : 'Process Deposit'
    "
    :loading="processDepositSingleStudentLoading"
    type="deposit"
    isStudent
    @submit="onMainPageStudentDepositDateChange"
  />

  <!-- Student Preview Modal (Main Page) -->
  <CommonRulesModal
    v-model="studentPreviewModal"
    :title="
      selectedStudentForAction
        ? `${selectedStudentForAction.first_yiddish_name} ${selectedStudentForAction.last_yiddish_name} : All Groups Preview`
        : 'Student Preview'
    "
    :rules="studentPreviewData"
    :loading="fetchingStudentPreview"
    :metric-labels="{}"
    :operater-labels="{}"
    type="process"
    @date-change="onMainPageStudentPreviewDateChange"
  />
</template>

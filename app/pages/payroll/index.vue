<script setup>
import { today, getLocalTimeZone } from "@internationalized/date";
import { object, string, number } from "yup";
import { base64ToPdfUrl } from "~/common/common";

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
const processChecksLoading = ref(false);
const processDepositLoading = ref(false);
const newGroup = ref(false);
const isSubmitting = ref(false);
const toast = useToast();
const jobTracker = useJobTracker();
const groups = ref([]);
const rules = ref([]);
const deleteModal = ref(false);
const fetchingGroups = ref(false);
const fetchingRules = ref(false);
const processChecksModal = ref(false);
const processDepositModal = ref(false);
const operaterLabels = ref({});
const metricLabels = ref({});
const isDeletingProcessAllPayroll = ref(false);
const deleteAllProcessPayrollConfirmModal = ref(false);
const selectedPayroll = ref(null);
const activeTab = ref(route?.query?.tab || "0");

const fetchingPayroll = ref(false);
const fetchingSettings = ref(false);
const recentPayroll = ref([]);
const pendingRequestsCount = ref(0);

const settings = ref(null);

// All Students state
const allStudentsData = ref([]);
const fetchingAllStudents = ref(false);
const selectedStudentForAction = ref(null);
const studentProcessModal = ref(false);

const pdfCheckModal = ref(false);
const pdfChecks = ref([]);
const assigningRuleIds = ref([]);
const selectedRuleByGroup = reactive({});
const rulesModalOpen = ref(false);
const rulesDeleteModal = ref(false);
const operatorOptions = ref([]);
const metricOptions = ref([]);
const fetchingRulesOptions = ref(false);
const isRuleSubmitting = ref(false);

// Auto Group Moves tab
const transitionRules = ref([]);
const fetchingTransitionRules = ref(false);
const transitionLogs = ref([]);
const fetchingTransitionLogs = ref(false);
const editingTransitionRule = ref(null);
const transitionRuleModalOpen = ref(false);
const isTransitionRuleSubmitting = ref(false);
const transitionRuleDeleteModal = ref(false);
const deleteTransitionRuleId = ref(null);
const runningAutoMoveNow = ref(false);

const tabs = [
  { label: "Recent Payroll", key: "recent-payroll" },
  { label: "Groups", key: "groups" },
  { label: "All Students", key: "all-students" },
  { label: "Settings", key: "setting" },
  { label: "Rules", key: "rules" },
  { label: "Auto Group Moves", key: "group-transitions" },
];

// The create/edit form itself lives in CommonPayRuleFormModal; this page just
// tracks which rule (if any) is being edited/deleted and fetches shared options.
const editingRule = ref(null);
const deleteRuleId = ref(null);

// Questions for the "answered_question" metric
const scheduleQuestions = ref([]);

async function fetchScheduleQuestions() {
  try {
    const response = await api("/api/schedules/questions");

    if (response?.success) {
      scheduleQuestions.value = response?.questions || [];
    }
  } catch (err) {
    console.log("Error fetching questions:", err);
    toast.add({
      title: "Error",
      description: "Failed to load schedule questions",
      color: "error",
    });
  }
}

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
    toast.add({
      description: "Error deleting payroll. Please try again later.",
      color: "error",
      timeout: 3000,
    });
  } finally {
    isDeletingProcessAllPayroll.value = false;
  }
};

const isModalOpen = async () => {
  resetGroupForm();
  showModal.value = true;
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
      toast.add({
        title: "Success",
        description:
          response?.message ||
          "Export processing started. File will be available shortly.",
        color: "success",
        duration: 2000,
      });
      jobTracker.track(response?.job_id, "Exporting Processed Rules");
      showModal.value = false;
    } else {
      toast.add({
        title: "Failed",
        description:
          response?.message ||
          response?._data.errors ||
          response?._data.message ||
          "Failed to process rules. Please try again later.",
        color: "error",
        duration: 2000,
      });
    }
  } catch (err) {
    console.log("🚀 ~ fetchProcessRules ~ err:", err);
    toast.add({
      description: "Error fetching payroll preview. Please try again later.",
      color: "error",
      timeout: 3000,
    });
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
          { text: "Edit Group" },
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
          { text: "Delete Group" },
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
              color: "primary",
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
        // Process Button
        h(
          resolveComponent("UTooltip"),
          { text: "Process" },
          {
            default: () =>
              h(resolveComponent("UButton"), {
                icon: "i-lucide-play",
                size: "md",
                color: "info",
                variant: "soft",
                onClick: () => handleMainPageProcessStudentClick(row.original),
              }),
          },
        ),
      ]),
  },
];

const normalizeGroupIds = (groupIds = []) =>
  Array.isArray(groupIds)
    ? groupIds.map((group) =>
        typeof group === "object" ? group.value : Number(group),
      )
    : [];

const getRuleSummary = (rule) => {
  const label = rule.reference_number ? `#${rule.reference_number} - ` : "";
  return `${label}${rule.description || conditionsSummary(rule)}`;
};

const effectiveStatus = (rule) => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const from = rule.effective_from?.slice(0, 10);
  const until = rule.effective_until?.slice(0, 10);

  if (!from && !until) return { label: "Always Active", color: "info" };

  const range = `${from || "..."} → ${until || "..."}`;

  if (until && until < todayStr) return { label: `Expired ${range}`, color: "error" };
  if (from && from > todayStr) return { label: `Starts ${range}`, color: "warning" };
  return { label: `Active ${range}`, color: "info" };
};

// Metric descriptions use a literal "X" placeholder for the comparison/value
// the user picked, e.g. "Came in X minutes relative to session start"
const conditionText = (condition) => {
  const metricLabel = metricLabels.value[condition.metric] || condition.metric || "";

  if (condition.metric === "answered_question") {
    return metricLabel;
  }

  const operatorLabel =
    operaterLabels.value[condition.x_operator] || condition.x_operator || "";
  const comparisonPhrase = `${operatorLabel} ${condition.x_value ?? ""}`.trim();

  if (/\bX\b/.test(metricLabel)) {
    return metricLabel.replace(/\bX\b/, comparisonPhrase);
  }

  return `${metricLabel} ${comparisonPhrase}`.trim();
};

const conditionsSummary = (rule) => {
  const conditions = rule.conditions || [];
  if (!conditions.length) return "—";

  const joiner = rule.match_mode === "any" ? " OR " : " AND ";
  return conditions.map(conditionText).join(joiner);
};

const paymentSummary = (rule) => {
  const kind = Number(rule.is_deduction) ? "Deduction" : "Bonus";
  const amountText =
    rule.amount_type === "fixed" ? `$${rule.amount}` : `${rule.amount}%`;
  const cadence = Number(rule.apply_once) ? "once" : "each time";
  return `${kind} ${amountText} (${cadence})`;
};

// Fixed widths (adding to 100%) so the table stays within the screen width
// and wraps long text instead of forcing a horizontal scrollbar
const ruleColumns = [
  {
    header: "Ref #",
    cell: ({ row }) => row.original.reference_number || "—",
    meta: { class: { th: "w-[7%]", td: "whitespace-normal break-words align-top" } },
  },
  {
    accessorKey: "description",
    header: "Description",
    meta: { class: { th: "w-[18%]", td: "whitespace-normal break-words align-top" } },
  },
  {
    header: "Trigger",
    cell: ({ row }) => conditionsSummary(row.original),
    meta: { class: { th: "w-[24%]", td: "whitespace-normal break-words align-top" } },
  },
  {
    header: "Payment",
    cell: ({ row }) => paymentSummary(row.original),
    meta: { class: { th: "w-[14%]", td: "whitespace-normal break-words align-top" } },
  },
  {
    header: "Groups",
    cell: ({ row }) => {
      const groupIds = normalizeGroupIds(row.original.group_ids);

      if (!groupIds.length) {
        return h("span", { class: "text-gray-400 text-sm" }, "Unassigned");
      }

      return h(
        "div",
        { class: "flex flex-wrap gap-1" },
        groupIds.map((gid) =>
          h(
            resolveComponent("UBadge"),
            { key: gid, color: "primary", variant: "soft", size: "sm" },
            () => groups.value.find((group) => group.id === gid)?.name || `Group ${gid}`,
          ),
        ),
      );
    },
    meta: { class: { th: "w-[13%]", td: "whitespace-normal break-words align-top" } },
  },
  {
    header: "Status",
    cell: ({ row }) => {
      const status = effectiveStatus(row.original);
      return h(
        resolveComponent("UBadge"),
        { color: status.color, variant: "soft", size: "sm" },
        () => status.label,
      );
    },
    meta: { class: { th: "w-[10%]", td: "whitespace-normal break-words align-top" } },
  },
  {
    header: "Actions",
    cell: ({ row }) =>
      h("div", { class: "flex gap-2 items-center justify-end" }, [
        h(
          resolveComponent("UTooltip"),
          { text: "View Rule Details" },
          {
            default: () =>
              h(resolveComponent("UButton"), {
                icon: "i-lucide-eye",
                size: "md",
                color: "neutral",
                variant: "soft",
                onClick: () => viewRule(row.original),
              }),
          },
        ),
        h(
          resolveComponent("UTooltip"),
          { text: "Edit Rule" },
          {
            default: () =>
              h(resolveComponent("UButton"), {
                icon: "i-lucide-square-pen",
                size: "md",
                color: "success",
                variant: "soft",
                onClick: () => editRule(row.original),
              }),
          },
        ),
        h(
          resolveComponent("UTooltip"),
          { text: "Delete Rule" },
          {
            default: () =>
              h(resolveComponent("UButton"), {
                icon: "i-lucide-trash-2",
                size: "md",
                color: "error",
                variant: "soft",
                onClick: () => askDeleteRule(row.original),
              }),
          },
        ),
      ]),
    meta: { class: { th: "w-[14%]", td: "align-top" } },
  },
];

const getAssignedRulesForGroup = (group) =>
  rules.value.filter((rule) => normalizeGroupIds(rule.group_ids).includes(group.id));

const getAvailableRulesForGroup = (group) =>
  rules.value.filter(
    (rule) => !normalizeGroupIds(rule.group_ids).includes(group.id),
  );

const getAvailableRuleOptionsForGroup = (group) =>
  getAvailableRulesForGroup(group).map((rule) => ({
    label: getRuleSummary(rule),
    value: rule.id,
  }));

const isAssigningRule = (ruleId, groupId) =>
  assigningRuleIds.value.includes(`${ruleId}-${groupId}`);

const getSelectedRuleId = (groupId) => {
  const selected = selectedRuleByGroup[groupId];
  return typeof selected === "object" ? selected?.value : selected;
};

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

const openCreateRuleModal = async () => {
  editingRule.value = null;
  rulesModalOpen.value = true;
  await rulesOptionsFetch();
  await fetchGroups();
  await fetchScheduleQuestions();
};

const editRule = async (rule) => {
  await rulesOptionsFetch();
  await fetchGroups();
  await fetchScheduleQuestions();
  editingRule.value = rule;
  rulesModalOpen.value = true;
};

const viewingRule = ref(null);
const ruleDetailModalOpen = ref(false);

const viewRule = async (rule) => {
  viewingRule.value = rule;
  ruleDetailModalOpen.value = true;
  await rulesOptionsFetch();
  await fetchGroups();
  await fetchScheduleQuestions();
};

const handleEditFromDetail = (rule) => {
  ruleDetailModalOpen.value = false;
  editRule(rule);
};

const askDeleteRule = (rule) => {
  deleteRuleId.value = rule.id;
  rulesDeleteModal.value = true;
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
          response?.message ||
          (groupForm.value.id
            ? "Group updated successfully"
            : "Group created successfully"),
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
    toast.add({
      title: "Error",
      description: "An unexpected error occurred during student add to group.",
      color: "error",
    });
  } finally {
    isSubmitting.value = false;
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
        check_date: data?.check_date,
      },
    });

    if (response?.success) {
      toast.add({
        title: "Success",
        description: response?.message || "Checks processed successfully",
        color: "success",
        duration: 2000,
      });
      jobTracker.track(response?.job_id, "Processing Payroll Checks");
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
    toast.add({
      description: "An unexpected error occurred. Please try again later.",
      color: "error",
      timeout: 3000,
    });
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
      jobTracker.track(response?.job_id, "Processing Direct Deposit");
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
    toast.add({
      description: "An unexpected error occurred. Please try again later.",
      color: "error",
      timeout: 3000,
    });
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
    toast.add({
      description: "Error fetching payroll groups. Please try again later.",
      color: "error",
      timeout: 3000,
    });
  } finally {
    fetchingGroups.value = false;
  }
};

const fetchRules = async () => {
  try {
    fetchingRules.value = true;
    const response = await api(`/api/payroll/rules`, {
      method: "GET",
    });

    if (response?.success) {
      rules.value = response?.pay_rules || [];
    }
  } catch (err) {
    console.log("🚀 ~ fetchRules ~ err:", err);
    toast.add({
      description: "Error fetching payroll rules. Please try again later.",
      color: "error",
      timeout: 3000,
    });
  } finally {
    fetchingRules.value = false;
  }
};

const fetchPendingRequestsCount = async () => {
  try {
    const response = await api(`/api/requests/count`, {
      method: "GET",
    });

    if (response?.success) {
      pendingRequestsCount.value = response?.request_amount || 0;
    }
  } catch (err) {
    console.log("🚀 ~ fetchPendingRequestsCount ~ err:", err);
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
    toast.add({
      description: "Error fetching payroll. Please try again later.",
      color: "error",
      timeout: 3000,
    });
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
    toast.add({
      description: "Error fetching payroll settings. Please try again later.",
      color: "error",
      timeout: 3000,
    });
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
    toast.add({
      description: "Error deleting payroll groups. Please try again later.",
      color: "error",
      timeout: 3000,
    });
  } finally {
    isSubmitting.value = false;
  }
};

const rulesOptionsFetch = async () => {
  try {
    fetchingRulesOptions.value = true;
    const response = await api(`/api/payroll/rules-options`);

    if (response?.success) {
      metricOptions.value = response.metrics.map((m) => ({
        label: m.description,
        value: m.metric,
      }));
      operatorOptions.value = response.operators.map((op) => ({
        label: op.description,
        value: op.operator,
      }));

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
    toast.add({
      description:
        "Error fetching payroll rules options. Please try again later.",
      color: "error",
      timeout: 3000,
    });
  } finally {
    fetchingRulesOptions.value = false;
  }
};

const updateRuleAssignments = async (rule, groupIds, successMessage) => {
  const targetGroupId = groupIds[0] || rule.group_ids?.[0] || groups.value[0]?.id;

  if (!targetGroupId) {
    throw new Error("No group available to update this rule.");
  }

  const payload = {
    description: rule.description,
    match_mode: rule.match_mode || "all",
    conditions: (rule.conditions || []).map((condition) => ({
      metric: condition.metric,
      x_operator: condition.x_operator,
      x_value: condition.x_value,
      session: condition.session,
      days_of_week: condition.days_of_week?.length ? condition.days_of_week : null,
      reference_id: condition.reference_id,
    })),
    is_deduction: Boolean(Number(rule.is_deduction)),
    amount_type: rule.amount_type,
    amount: rule.amount,
    apply_once: Boolean(Number(rule.apply_once)),
    is_weekly: Boolean(Number(rule.is_weekly)),
    y_operator: rule.y_operator,
    y_value: rule.y_value,
    effective_from: rule.effective_from || null,
    effective_until: rule.effective_until || null,
    group_ids: groupIds,
  };

  const response = await api(`/api/payroll/group/${targetGroupId}/rules/${rule.id}`, {
    method: "PUT",
    body: payload,
  });

  if (!response?.success) {
    throw new Error(
      response?._data?.errors ||
        response?._data?.message ||
        response?.message ||
        "Failed to update rule assignments",
    );
  }

  rule.group_ids = groupIds;

  toast.add({
    title: "Success",
    description: successMessage,
    color: "success",
    duration: 2000,
  });
};

const onRuleSubmit = async (payload) => {
  try {
    isRuleSubmitting.value = true;

    const ruleId = editingRule.value?.id;
    const groupIds = payload.group_ids;
    const targetGroupId = groupIds[0] || groups.value[0]?.id || 0;
    const endpoint = ruleId
      ? `/api/payroll/group/${targetGroupId}/rules/${ruleId}`
      : `/api/payroll/group/${targetGroupId}/rules`;

    const response = await api(endpoint, {
      method: ruleId ? "PUT" : "POST",
      body: payload,
    });

    if (response?.success) {
      toast.add({
        title: "Success",
        description:
          response?.message ||
          (ruleId
            ? "Pay rule updated successfully"
            : "Pay rule created successfully"),
        color: "success",
        duration: 2000,
      });

      rulesModalOpen.value = false;
      editingRule.value = null;
      await fetchRules();
    } else {
      toast.add({
        title: "Failed",
        description:
          response?._data?.errors ||
          response?._data?.message ||
          "Failed to save rule",
        color: "error",
        duration: 2000,
      });
    }
  } catch (error) {
    console.error("Error saving rule:", error);
    toast.add({
      title: "Error",
      description: "An unexpected error occurred while saving the rule.",
      color: "error",
      duration: 2000,
    });
  } finally {
    isRuleSubmitting.value = false;
  }
};

const confirmDeleteRule = async () => {
  try {
    isRuleSubmitting.value = true;
    const targetGroupId =
      rules.value.find((rule) => rule.id === deleteRuleId.value)?.group_ids?.[0] ||
      groups.value[0]?.id ||
      0;

    const response = await api(
      `/api/payroll/group/${targetGroupId}/rules/${deleteRuleId.value}`,
      {
        method: "DELETE",
      },
    );

    if (response?.success) {
      toast.add({
        title: "Success",
        description: response?.message || "Pay rule deleted successfully",
        color: "success",
        duration: 2000,
      });
      rulesDeleteModal.value = false;
      deleteRuleId.value = null;
      await fetchRules();
    } else {
      toast.add({
        title: "Failed",
        description:
          response?._data?.errors ||
          response?._data?.message ||
          "Failed to delete rule",
        color: "error",
        duration: 2000,
      });
    }
  } catch (error) {
    console.error("Error deleting rule:", error);
    toast.add({
      title: "Error",
      description: "An unexpected error occurred while deleting the rule.",
      color: "error",
      duration: 2000,
    });
  } finally {
    isRuleSubmitting.value = false;
  }
};

const fetchTransitionRules = async () => {
  try {
    fetchingTransitionRules.value = true;
    const response = await api(`/api/payroll/group-transition-rules`);

    if (response?.success) {
      transitionRules.value = response?.rules || [];
    }
  } catch (err) {
    console.log("🚀 ~ fetchTransitionRules ~ err:", err);
    toast.add({
      description: "Error fetching auto-move rules. Please try again later.",
      color: "error",
      timeout: 3000,
    });
  } finally {
    fetchingTransitionRules.value = false;
  }
};

const fetchTransitionLogs = async () => {
  try {
    fetchingTransitionLogs.value = true;
    const response = await api(`/api/payroll/group-transition-rules/logs`);

    if (response?.success) {
      transitionLogs.value = response?.logs?.data || [];
    }
  } catch (err) {
    console.log("🚀 ~ fetchTransitionLogs ~ err:", err);
    toast.add({
      description: "Error fetching auto-move history. Please try again later.",
      color: "error",
      timeout: 3000,
    });
  } finally {
    fetchingTransitionLogs.value = false;
  }
};

const openCreateTransitionRuleModal = async () => {
  editingTransitionRule.value = null;
  await fetchGroups();
  transitionRuleModalOpen.value = true;
};

const editTransitionRule = async (rule) => {
  await fetchGroups();
  editingTransitionRule.value = rule;
  transitionRuleModalOpen.value = true;
};

const onTransitionRuleSubmit = async (payload) => {
  try {
    isTransitionRuleSubmitting.value = true;

    const ruleId = editingTransitionRule.value?.id;
    const endpoint = ruleId
      ? `/api/payroll/group-transition-rules/${ruleId}`
      : `/api/payroll/group-transition-rules`;

    const response = await api(endpoint, {
      method: ruleId ? "PUT" : "POST",
      body: payload,
    });

    if (response?.success) {
      toast.add({
        title: "Success",
        description:
          response?.message ||
          (ruleId
            ? "Auto-move rule updated successfully"
            : "Auto-move rule created successfully"),
        color: "success",
        duration: 2000,
      });

      transitionRuleModalOpen.value = false;
      editingTransitionRule.value = null;
      await fetchTransitionRules();
    } else {
      toast.add({
        title: "Failed",
        description:
          response?._data?.errors ||
          response?._data?.message ||
          "Failed to save auto-move rule",
        color: "error",
        duration: 2000,
      });
    }
  } catch (error) {
    console.error("Error saving auto-move rule:", error);
    toast.add({
      title: "Error",
      description: "An unexpected error occurred while saving the rule.",
      color: "error",
      duration: 2000,
    });
  } finally {
    isTransitionRuleSubmitting.value = false;
  }
};

const askDeleteTransitionRule = (rule) => {
  deleteTransitionRuleId.value = rule.id;
  transitionRuleDeleteModal.value = true;
};

const confirmDeleteTransitionRule = async () => {
  try {
    isTransitionRuleSubmitting.value = true;

    const response = await api(
      `/api/payroll/group-transition-rules/${deleteTransitionRuleId.value}`,
      { method: "DELETE" },
    );

    if (response?.success) {
      toast.add({
        title: "Success",
        description: response?.message || "Auto-move rule deleted successfully",
        color: "success",
        duration: 2000,
      });
      transitionRuleDeleteModal.value = false;
      deleteTransitionRuleId.value = null;
      await fetchTransitionRules();
    } else {
      toast.add({
        title: "Failed",
        description:
          response?._data?.errors ||
          response?._data?.message ||
          "Failed to delete auto-move rule",
        color: "error",
        duration: 2000,
      });
    }
  } catch (error) {
    console.error("Error deleting auto-move rule:", error);
    toast.add({
      title: "Error",
      description: "An unexpected error occurred while deleting the rule.",
      color: "error",
      duration: 2000,
    });
  } finally {
    isTransitionRuleSubmitting.value = false;
  }
};

const runAutoMoveNow = async () => {
  try {
    runningAutoMoveNow.value = true;
    const response = await api(`/api/payroll/group-transition-rules/run-now`, {
      method: "POST",
    });

    if (response?.success) {
      const moved = response?.summary?.students_moved ?? 0;
      toast.add({
        title: "Success",
        description: `Auto-move check complete — ${moved} student(s) moved`,
        color: "success",
        duration: 3000,
      });
      await fetchTransitionLogs();
    } else {
      toast.add({
        title: "Failed",
        description: response?.message || "Failed to run auto-move check",
        color: "error",
      });
    }
  } catch (error) {
    console.error("Error running auto-move check:", error);
    toast.add({
      title: "Error",
      description: "An unexpected error occurred while running the auto-move check.",
      color: "error",
    });
  } finally {
    runningAutoMoveNow.value = false;
  }
};

const transitionRuleColumns = [
  {
    header: "From Group",
    cell: ({ row }) => row.original.from_group_name || "Any",
  },
  {
    header: "To Group",
    cell: ({ row }) => row.original.to_group_name,
  },
  {
    header: "After",
    cell: ({ row }) => `${row.original.months_in_group} month(s)`,
  },
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ row }) => row.original.description || "—",
  },
  {
    header: "Status",
    cell: ({ row }) =>
      h(
        resolveComponent("UBadge"),
        {
          color: row.original.active ? "success" : "neutral",
          variant: "soft",
          size: "sm",
        },
        () => (row.original.active ? "Active" : "Inactive"),
      ),
  },
  {
    header: "Actions",
    cell: ({ row }) =>
      h("div", { class: "flex gap-2 items-center justify-end" }, [
        h(
          resolveComponent("UTooltip"),
          { text: "Edit Rule" },
          {
            default: () =>
              h(resolveComponent("UButton"), {
                icon: "i-lucide-square-pen",
                size: "md",
                color: "success",
                variant: "soft",
                onClick: () => editTransitionRule(row.original),
              }),
          },
        ),
        h(
          resolveComponent("UTooltip"),
          { text: "Delete Rule" },
          {
            default: () =>
              h(resolveComponent("UButton"), {
                icon: "i-lucide-trash-2",
                size: "md",
                color: "error",
                variant: "soft",
                onClick: () => askDeleteTransitionRule(row.original),
              }),
          },
        ),
      ]),
  },
];

const transitionLogColumns = [
  {
    header: "Student",
    cell: ({ row }) =>
      `${row.original.first_yiddish_name} ${row.original.last_yiddish_name}`,
  },
  {
    header: "From Group",
    cell: ({ row }) => row.original.from_group_name || "—",
  },
  {
    header: "To Group",
    cell: ({ row }) => row.original.to_group_name || "—",
  },
  {
    header: "Months in Group",
    cell: ({ row }) => row.original.months_in_group_at_move ?? "—",
  },
  {
    header: "Moved At",
    cell: ({ row }) => new Date(row.original.moved_at).toLocaleString(),
  },
];

const handleAssignRuleToGroup = async (group, rule) => {
  const existingGroupIds = normalizeGroupIds(rule.group_ids);

  if (existingGroupIds.includes(group.id)) {
    return;
  }

  const loadingKey = `${rule.id}-${group.id}`;

  try {
    assigningRuleIds.value.push(loadingKey);
    await updateRuleAssignments(
      rule,
      [...existingGroupIds, group.id],
      `Rule added to ${group.name}`,
    );
  } catch (error) {
    console.error("Error assigning rule:", error);
    toast.add({
      title: "Error",
      description: error.message || "Failed to add rule to group.",
      color: "error",
      duration: 2000,
    });
  } finally {
    assigningRuleIds.value = assigningRuleIds.value.filter(
      (key) => key !== loadingKey,
    );
  }
};

const handleRemoveRuleFromGroup = async (group, rule) => {
  const existingGroupIds = normalizeGroupIds(rule.group_ids);

  if (!existingGroupIds.includes(group.id)) {
    return;
  }

  const loadingKey = `${rule.id}-${group.id}`;

  try {
    assigningRuleIds.value.push(loadingKey);
    await updateRuleAssignments(
      rule,
      existingGroupIds.filter((id) => id !== group.id),
      `Rule removed from ${group.name}`,
    );
  } catch (error) {
    console.error("Error removing rule:", error);
    toast.add({
      title: "Error",
      description: error.message || "Failed to remove rule from group.",
      color: "error",
      duration: 2000,
    });
  } finally {
    assigningRuleIds.value = assigningRuleIds.value.filter(
      (key) => key !== loadingKey,
    );
  }
};

const handleAddSelectedRuleToGroup = async (group) => {
  const selectedRuleId = getSelectedRuleId(group.id);

  if (!selectedRuleId) {
    toast.add({
      title: "Error",
      description: "Please select a rule to add.",
      color: "error",
      duration: 2000,
    });
    return;
  }

  const rule = rules.value.find((item) => Number(item.id) === Number(selectedRuleId));

  if (!rule) {
    toast.add({
      title: "Error",
      description: "Selected rule not found.",
      color: "error",
      duration: 2000,
    });
    return;
  }

  await handleAssignRuleToGroup(group, rule);
  selectedRuleByGroup[group.id] = null;
};

// watch for datepicker changes
const onDateChange = async (val) => {
  if (!val?.from_date || !val?.till_date) {
    toast.add({
      title: "Error",
      description: "Please select a valid date range.",
      color: "error",
    });
    return;
  }

  await fetchProcessRules({
    ...val,
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
    return;
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
    return;
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
    toast.add({
      description: "Error fetching group students. Please try again later.",
      color: "error",
      timeout: 3000,
    });
    allStudentsData.value = [];
  } finally {
    fetchingAllStudents.value = false;
  }
};

// Handler for the single "Process" button on main page
const handleMainPageProcessStudentClick = (student) => {
  selectedStudentForAction.value = student;
  studentProcessModal.value = true;
};

// Fired by StudentProcessModal once it has successfully created a real
// Check/Deposit (including any manual adjustment rows the admin added).
const onMainPageStudentProcessed = ({ outputType, response }) => {
  if (outputType === "check") {
    pdfChecks.value = Object.entries(response?.data || {}).map(
      ([id, base64]) => ({
        id,
        url: base64ToPdfUrl(base64),
      }),
    );
    pdfCheckModal.value = true;
  } else {
    toast.add({
      title: "Success",
      description: response?.message || "Deposit processed successfully",
      color: "success",
      duration: 2000,
    });
  }
};

const handleTabUpdate = (newValue) => {
  router.replace({
    query: {
      ...route.query,
      tab: newValue,
    },
  });
};

onMounted(async () => {
  await fetchPendingRequestsCount();
});

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
    } else if (newTab === "4") {
      fetchGroups();
      fetchRules();
      rulesOptionsFetch();
    } else if (newTab === "5") {
      fetchGroups();
      fetchTransitionRules();
      fetchTransitionLogs();
    }
  },
  { immediate: true },
);
</script>

<template>
  <UCard class="rounded-2xl shadow-sm">
    <div
      class="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"
    >
      <h2 class="text-lg sm:text-xl font-bold">
        {{
          activeTab === "0"
            ? "Recent Payroll"
            : activeTab === "1"
              ? "Payroll Groups"
              : activeTab === "2"
                ? "All Students"
                : activeTab === "3"
                  ? "Payroll Settings"
                  : activeTab === "4"
                    ? "Rules"
                    : "Auto Group Moves"
        }}
      </h2>

      <div class="flex flex-wrap gap-2 sm:gap-2 sm:justify-end">
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
        <UChip
          :show="pendingRequestsCount > 0"
          :text="pendingRequestsCount"
          color="error"
          :ui="{ base: 'h-5 min-w-5 px-1 text-[11px] font-bold ring-2' }"
        >
          <UButton
            to="/clockings/requests"
            icon="i-lucide-list-checks"
            label="Requests"
            variant="outline"
          />
        </UChip>
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
  <UCard v-if="activeTab === '0'" class="rounded-2xl shadow-sm my-6">
    <div
      class="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-0"
    >
      <h2 class="md:text-lg text-base font-bold">
        View and manage recent payrolls
      </h2>
    </div>
    <UTable
      :columns="recentPayrollColumns"
      :loading="fetchingPayroll"
      :data="recentPayroll"
      class="flex-1 md:mt-6 mt-2"
    />
  </UCard>

  <!-- Fetch Group Tab 2 -->
  <UCard v-if="activeTab === '1'" class="rounded-2xl shadow-sm my-6">
    <div
      class="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-0"
    >
      <h2 class="md:text-lg text-base font-bold">
        View and manage payroll groups
      </h2>
    </div>
    <UTable
      :columns="columns"
      :loading="fetchingGroups"
      :data="groups"
      class="flex-1 md:mt-6 mt-2"
    />
  </UCard>

  <!-- All Students Tab 3 -->
  <UCard v-if="activeTab === '2'" class="rounded-2xl shadow-sm my-6">
    <div
      class="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-0"
    >
      <h2 class="md:text-lg text-base font-bold">
        View and manage all students
      </h2>
    </div>
    <UTable
      :columns="allStudentsColumns"
      :loading="fetchingAllStudents"
      :data="allStudentsData"
      class="flex-1 md:mt-6 mt-2"
    />
  </UCard>

  <!-- Fetch Settings Tab 4 -->
  <PayrollSettings
    v-if="activeTab === '3'"
    :fetchingSettings="fetchingSettings"
    :data="settings"
    @refresh="fetchSettings()"
  />

  <UCard v-if="activeTab === '4'" class="rounded-2xl shadow-sm my-6">
    <div
      class="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6"
    >
      <h2 class="md:text-lg text-base font-bold">
        View and manage payroll rules
      </h2>
      <UButton
        icon="i-lucide-plus"
        label="Create Rule"
        color="primary"
        @click="openCreateRuleModal"
      />
    </div>

    <div
      v-if="fetchingRules"
      class="flex items-center justify-center py-10 w-full"
    >
      <BaseSpinner :show-loader="fetchingRules" size="md" />
    </div>

    <UTable
      v-else-if="rules.length"
      :columns="ruleColumns"
      :data="rules"
      class="flex-1"
      :ui="{ base: 'table-fixed min-w-full' }"
    />
    <div v-else class="text-center text-gray-500 mt-10">
      No rules found. Click <strong>Create Rule</strong> to add one.
    </div>
  </UCard>

  <!-- Auto Group Moves Tab 6 -->
  <UCard v-if="activeTab === '5'" class="rounded-2xl shadow-sm my-6">
    <div
      class="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6"
    >
      <h2 class="md:text-lg text-base font-bold">
        Automatically move students between groups by tenure
      </h2>
      <div class="flex flex-wrap gap-2">
        <UButton
          icon="i-lucide-play"
          label="Run Now"
          color="neutral"
          variant="outline"
          :loading="runningAutoMoveNow"
          @click="runAutoMoveNow"
        />
        <UButton
          icon="i-lucide-plus"
          label="Create Rule"
          color="primary"
          @click="openCreateTransitionRuleModal"
        />
      </div>
    </div>

    <div
      v-if="fetchingTransitionRules"
      class="flex items-center justify-center py-10 w-full"
    >
      <BaseSpinner :show-loader="fetchingTransitionRules" size="md" />
    </div>
    <UTable
      v-else-if="transitionRules.length"
      :columns="transitionRuleColumns"
      :data="transitionRules"
      class="flex-1"
    />
    <div v-else class="text-center text-gray-500 mt-10">
      No auto-move rules found. Click <strong>Create Rule</strong> to add one.
    </div>

    <h3 class="md:text-base text-sm font-bold mt-8 mb-4">Recent Auto-Moves</h3>
    <div
      v-if="fetchingTransitionLogs"
      class="flex items-center justify-center py-10 w-full"
    >
      <BaseSpinner :show-loader="fetchingTransitionLogs" size="md" />
    </div>
    <UTable
      v-else
      :columns="transitionLogColumns"
      :data="transitionLogs"
      class="flex-1"
    />
  </UCard>

  <CommonGroupTransitionRuleFormModal
    v-model="transitionRuleModalOpen"
    :rule="editingTransitionRule"
    :all-groups="groups"
    :submitting="isTransitionRuleSubmitting"
    @submit="onTransitionRuleSubmit"
  />

  <UModal
    v-model:open="transitionRuleDeleteModal"
    title="Confirm Delete Rule"
    :close="{
      color: 'primary',
      variant: 'outline',
      class: 'rounded-full',
    }"
  >
    <template #body>
      <p>Are you sure you want to delete this auto-move rule?</p>
      <div
        class="flex gap-2 justify-end items-center border-t border-gray-200 mt-4 pt-4"
      >
        <UButton
          color="neutral"
          variant="solid"
          label="Cancel"
          @click="transitionRuleDeleteModal = false"
        />
        <UButton
          color="error"
          variant="solid"
          label="Delete"
          :loading="isTransitionRuleSubmitting"
          :disabled="isTransitionRuleSubmitting"
          @click="confirmDeleteTransitionRule()"
        />
      </div>
    </template>
  </UModal>

  <CommonPayRuleFormModal
    v-model="rulesModalOpen"
    :rule="editingRule"
    :all-groups="groups"
    :metric-options="metricOptions"
    :operator-options="operatorOptions"
    :metric-labels="metricLabels"
    :operater-labels="operaterLabels"
    :schedule-questions="scheduleQuestions"
    :loading-options="fetchingRulesOptions"
    :submitting="isRuleSubmitting"
    @submit="onRuleSubmit"
  />

  <CommonPayRuleDetailModal
    v-model="ruleDetailModalOpen"
    :rule="viewingRule"
    :all-groups="groups"
    :metric-labels="metricLabels"
    :operater-labels="operaterLabels"
    :schedule-questions="scheduleQuestions"
    :loading-options="fetchingRulesOptions"
    @edit="handleEditFromDetail"
  />

  <UModal
    v-model:open="rulesDeleteModal"
    title="Confirm Delete Rule"
    :close="{
      color: 'primary',
      variant: 'outline',
      class: 'rounded-full',
    }"
  >
    <template #body>
      <div>
        <p>Are you sure you want to delete this rule?</p>
      </div>
      <div
        class="flex gap-2 justify-end items-center border-t border-gray-200 mt-4"
      >
        <UButton
          color="neutral"
          variant="solid"
          class="mt-4"
          label="Cancel"
          @click="rulesDeleteModal = false"
        />
        <UButton
          color="error"
          variant="solid"
          class="mt-4"
          :loading="isRuleSubmitting"
          :disabled="isRuleSubmitting"
          @click="confirmDeleteRule"
          label="Delete"
        />
      </div>
    </template>
  </UModal>

  <!-- Create Group Modal -->
  <UModal v-model:open="newGroup" :dismissible="false">
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
        <UFormField label="Name" name="name" required>
          <UInput
            v-model="groupState.name"
            placeholder="Enter group name"
            class="w-full"
            size="lg"
          />
        </UFormField>

        <UFormField label="Base Amount" name="base_amount" required>
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
  <CommonProcessCheckDepositModal
    v-model="showModal"
    title="Process Rules"
    :loading="loading"
    type="process"
    isDescriptionRequired
    @submit="onDateChange"
  />

  <!-- Modal for Process Check Rules -->
  <CommonProcessCheckDepositModal
    v-model="processChecksModal"
    title="Process Checks"
    :loading="processChecksLoading"
    type="check"
    @submit="onProcessCheckFormSubmit"
  />

  <!-- Modal for deposit Rules -->
  <CommonProcessCheckDepositModal
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

  <!-- Single Student Process Modal (Main Page) -->
  <PayrollStudentProcessModal
    v-model="studentProcessModal"
    :student="selectedStudentForAction"
    :groups="selectedStudentForAction?.groups || []"
    @processed="onMainPageStudentProcessed"
  />

  <!-- Check pdf preview modal -->
  <CommonPdfPreviewModal v-model="pdfCheckModal" :data="pdfChecks" />
</template>

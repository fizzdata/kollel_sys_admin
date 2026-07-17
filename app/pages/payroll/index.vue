<script setup>
import { today, getLocalTimeZone } from "@internationalized/date";
import { object, string, number, array } from "yup";
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

const deductionItems = ref([
  { label: "Deduction", value: true },
  { label: "Bonus", value: false },
]);
const amountTypeItems = ref([
  { label: "Fixed", value: "fixed" },
  { label: "Percentage", value: "percentage" },
]);
const matchModeItems = ref([
  { label: "ALL metrics must match", value: "all" },
  { label: "ANY metric can match", value: "any" },
]);
const applyOnceItems = ref(["Apply Once", "Each Time"]);

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

const tabs = [
  { label: "Recent Payroll", key: "recent-payroll" },
  { label: "Groups", key: "groups" },
  { label: "All Students", key: "all-students" },
  { label: "Settings", key: "setting" },
  { label: "Rules", key: "rules" },
];

const conditionSchema = object({
  metric: string().required("Metric is required"),
  x_operator: string().required("X Operator is required"),
  x_value: string().required("X Value is required"),
  y_operator: string().nullable(),
  y_value: string().nullable(),
  reference_id: string().nullable(),
  session: array()
    .of(number())
    .min(1, "Session is required")
    .required("Session is required"),
});

const rulesSchema = object({
  description: string().required("Description is required"),
  match_mode: string().required("Match mode is required"),
  conditions: array()
    .of(conditionSchema)
    .min(1, "At least one metric is required"),
  is_deduction: string().required("Is Deduction is required"),
  amount_type: string().required("Amount Type is required"),
  amount: number()
    .typeError("Amount must be a number")
    .required("Amount is required")
    .min(0, "Amount cannot be negative"),
  apply_once: string().required("Apply Rules is required"),
  y_operator: string().nullable(),
  y_value: string().nullable(),
});

const blankCondition = () => ({
  metric: "",
  x_operator: "",
  x_value: "",
  y_operator: "",
  y_value: "",
  reference_id: "",
  session: [],
});

const ruleForm = ref({ id: null });

const ruleState = reactive({
  description: "",
  match_mode: "all",
  conditions: [blankCondition()],
  is_deduction: "",
  amount_type: "",
  amount: "",
  apply_once: "Apply Once",
  y_operator: "",
  y_value: "",
  group_ids: [],
});

const addCondition = () => {
  ruleState.conditions.push(blankCondition());
};

const removeCondition = (index) => {
  if (ruleState.conditions.length > 1) {
    ruleState.conditions.splice(index, 1);
  }
};

const sessionOptions = [
  { label: "Session 1", value: 1 },
  { label: "Session 2", value: 2 },
];

// Backend stores a single integer where 0 means "all sessions"
const sessionsToBackend = (sessions = []) =>
  sessions.length === 1 ? Number(sessions[0]) : 0;

const sessionsFromBackend = (session) =>
  session == null || Number(session) === 0 ? [1, 2] : [Number(session)];

// Questions for the "answered_question" metric
const scheduleQuestions = ref([]);

const questionOptions = computed(() =>
  scheduleQuestions.value.map((question) => ({
    label: question.question_text,
    value: question.id,
  })),
);

const answerOptionsFor = (condition) => {
  const question = scheduleQuestions.value.find(
    (q) => q.id === condition.reference_id,
  );

  if (!question) return [];

  return [1, 2, 3]
    .filter((n) => question[`button_text_${n}`])
    .map((n) => ({
      label: question[`button_text_${n}`],
      value: n,
    }));
};

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

// Operator/value have no meaning for answered_question; keep validation happy
watch(
  () => ruleState.conditions.map((condition) => condition.metric),
  () => {
    ruleState.conditions.forEach((condition) => {
      if (
        condition.metric === "answered_question" &&
        condition.x_operator !== "="
      ) {
        condition.x_operator = "=";
      }
    });
  },
);

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

const normalizeGroupIds = (groupIds = []) =>
  Array.isArray(groupIds)
    ? groupIds.map((group) =>
        typeof group === "object" ? group.value : Number(group),
      )
    : [];

const getRuleSummary = (rule) => {
  const conditions = rule.conditions || [];
  const first = conditions[0] || {};
  const metricLabel = metricLabels.value[first.metric] || first.metric || "";
  const operatorLabel =
    operaterLabels.value[first.x_operator] || first.x_operator || "";
  const joiner = rule.match_mode === "any" ? " OR " : " AND ";

  const extraText = conditions
    .slice(1)
    .map((condition) => `${joiner}${metricLabels.value[condition.metric] || condition.metric}`)
    .join("");

  return `#${rule.id} - ${rule.description || `If ${metricLabel}${extraText} is ${operatorLabel} ${first.x_value}`}`;
};

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

const resetRuleForm = () => {
  ruleForm.value.id = null;

  Object.assign(ruleState, {
    description: "",
    match_mode: "all",
    conditions: [blankCondition()],
    is_deduction: "",
    amount_type: "",
    amount: "",
    apply_once: "Apply Once",
    y_operator: "",
    y_value: "",
    group_ids: [],
  });
};

const openCreateRuleModal = async () => {
  resetRuleForm();
  rulesModalOpen.value = true;
  await rulesOptionsFetch();
  await fetchGroups();
  await fetchScheduleQuestions();
};

const editRule = async (rule) => {
  await rulesOptionsFetch();
  await fetchGroups();
  await fetchScheduleQuestions();
  rulesModalOpen.value = true;
  ruleForm.value.id = rule.id;
  ruleState.description = rule.description;
  ruleState.match_mode = rule.match_mode || "all";
  ruleState.conditions = (rule.conditions || []).map((condition) => ({
    metric: condition.metric,
    x_operator: condition.x_operator,
    x_value:
      condition.metric === "answered_question"
        ? Number(condition.x_value)
        : condition.x_value,
    y_operator: condition.y_operator ?? "",
    y_value: condition.y_value ?? "",
    reference_id: condition.reference_id ?? "",
    session: sessionsFromBackend(condition.session),
  }));

  if (!ruleState.conditions.length) {
    ruleState.conditions = [blankCondition()];
  }

  ruleState.is_deduction = rule.is_deduction === 1 ? true : false;
  ruleState.amount_type = rule.amount_type;
  ruleState.amount = rule.amount;
  ruleState.apply_once = rule.apply_once === 1 ? "Apply Once" : "Each Time";
  ruleState.y_operator = rule.y_operator ?? "";
  ruleState.y_value = rule.y_value ?? "";
  ruleState.group_ids = normalizeGroupIds(rule.group_ids);
};

const askDeleteRule = (rule) => {
  ruleForm.value.id = rule.id;
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
      y_operator: condition.y_operator,
      y_value: condition.y_value,
      session: condition.session,
      reference_id: condition.reference_id,
    })),
    is_deduction: Boolean(Number(rule.is_deduction)),
    amount_type: rule.amount_type,
    amount: rule.amount,
    apply_once: Boolean(Number(rule.apply_once)),
    y_operator: rule.y_operator,
    y_value: rule.y_value,
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

const onRuleSubmit = async (event) => {
  try {
    isRuleSubmitting.value = true;

    const groupIds = normalizeGroupIds(event.data.group_ids);
    const targetGroupId = groupIds[0] || groups.value[0]?.id || 0;
    const endpoint = ruleForm.value.id
      ? `/api/payroll/group/${targetGroupId}/rules/${ruleForm.value.id}`
      : `/api/payroll/group/${targetGroupId}/rules`;

    const applyOnce = event.data.apply_once === "Apply Once";

    const payload = {
      description: event.data.description,
      match_mode:
        event.data.conditions.length > 1 ? event.data.match_mode || "all" : "all",
      conditions: event.data.conditions.map((condition) => ({
        metric: condition.metric,
        x_operator: condition.x_operator,
        x_value: condition.x_value,
        y_operator: condition.y_operator || null,
        y_value: condition.y_value || null,
        session: sessionsToBackend(condition.session),
        reference_id:
          condition.metric === "answered_question"
            ? condition.reference_id || null
            : null,
      })),
      is_deduction:
        event.data.is_deduction === true || event.data.is_deduction === "true",
      amount_type: event.data.amount_type,
      amount: event.data.amount,
      apply_once: applyOnce,
      y_operator: applyOnce ? event.data.y_operator || null : null,
      y_value: applyOnce ? event.data.y_value || null : null,
      group_ids: groupIds,
    };

    const response = await api(endpoint, {
      method: ruleForm.value.id ? "PUT" : "POST",
      body: payload,
    });

    if (response?.success) {
      toast.add({
        title: "Success",
        description:
          response?.message ||
          (ruleForm.value.id
            ? "Pay rule updated successfully"
            : "Pay rule created successfully"),
        color: "success",
        duration: 2000,
      });

      rulesModalOpen.value = false;
      resetRuleForm();
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
      rules.value.find((rule) => rule.id === ruleForm.value.id)?.group_ids?.[0] ||
      groups.value[0]?.id ||
      0;

    const response = await api(
      `/api/payroll/group/${targetGroupId}/rules/${ruleForm.value.id}`,
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
      resetRuleForm();
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
  if (!val?.start || !val?.end) {
    toast.add({
      title: "Error",
      description: "Please select a valid date range.",
      color: "error",
    });
    return;
  }

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
            check_date: data?.check_date,
          },
        },
      );

      if (response?.success) {
        // Map API response
        pdfChecks.value = Object.entries(response.data).map(([id, base64]) => ({
          id,
          url: base64ToPdfUrl(base64),
        }));

        pdfCheckModal.value = true;
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
      description:
        "An error occurred while processing checks. Please try again later.",
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
    check_date: val.check_date,
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
    } else if (newTab === "4") {
      fetchGroups();
      fetchRules();
      rulesOptionsFetch();
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
                  : "Rules"
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

    <div
      v-else-if="rules.length"
      class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
    >
      <UCard
        v-for="rule in rules"
        :key="rule.id"
        class="rounded-2xl shadow hover:shadow-xl transition-shadow duration-300"
      >
        <div>
          <label>{{ getRuleSummary(rule) }}</label>
        </div>
        <div
          class="flex justify-between items-baseline text-end gap-6 text-gray-500 mt-3"
        >
          <div>
            <p class="text-xs">{{ rule.description }}</p>
            <div class="flex flex-wrap gap-1 mt-2">
              <UBadge
                v-for="gid in rule.group_ids || []"
                :key="`${rule.id}-${gid}`"
                color="primary"
                variant="soft"
                size="sm"
              >
                {{ groups.find((group) => group.id === gid)?.name || `Group ${gid}` }}
              </UBadge>
            </div>
          </div>
          <div class="flex gap-2 items-center">
            <UButton
              icon="i-lucide-square-pen"
              size="md"
              color="success"
              variant="soft"
              @click="editRule(rule)"
            />
            <UButton
              icon="i-lucide-trash-2"
              size="md"
              color="error"
              variant="soft"
              @click="askDeleteRule(rule)"
            />
          </div>
        </div>
      </UCard>
    </div>
    <div v-else class="text-center text-gray-500 mt-10">
      No rules found. Click <strong>Create Rule</strong> to add one.
    </div>
  </UCard>

  <UModal v-model:open="rulesModalOpen">
    <template #header>
      <div class="flex justify-between w-full">
        <h2 class="text-xl font-bold text-primary">
          {{ ruleForm.id ? "Edit Rule" : "Create New Rule" }}
        </h2>
        <UButton
          size="sm"
          variant="outline"
          color="primary"
          class="rounded-full p-2"
          icon="i-lucide-x"
          @click="
            () => {
              rulesModalOpen = false;
              resetRuleForm();
            }
          "
        />
      </div>
    </template>
    <template #body>
      <div
        v-if="fetchingRulesOptions"
        class="flex items-center justify-center pt-10 w-full"
      >
        <BaseSpinner :show-loader="fetchingRulesOptions" size="md" />
      </div>

      <UForm
        v-else
        :state="ruleState"
        :schema="rulesSchema"
        @submit="onRuleSubmit"
      >
        <div class="space-y-6">
          <UFormField label="Description" name="description" required>
            <UInput
              v-model="ruleState.description"
              placeholder="Enter description"
              class="w-full"
              size="lg"
            />
          </UFormField>

          <!-- Metric conditions -->
          <div
            v-for="(condition, index) in ruleState.conditions"
            :key="index"
            class="border border-gray-200 dark:border-gray-800 rounded-xl p-4"
          >
            <div class="flex items-center justify-between mb-4">
              <span class="font-semibold">Metric {{ index + 1 }}</span>
              <UButton
                v-if="ruleState.conditions.length > 1"
                size="xs"
                color="error"
                variant="ghost"
                icon="i-lucide-trash-2"
                @click="removeCondition(index)"
              />
            </div>
            <div class="grid grid-cols-2 gap-4">
              <UFormField
                label="Metric"
                :name="`conditions[${index}].metric`"
                required
                class="col-span-2"
              >
                <USelect
                  v-model="condition.metric"
                  :items="metricOptions"
                  placeholder="Please Select"
                  class="w-full"
                  size="lg"
                />
              </UFormField>
              <template v-if="condition.metric === 'answered_question'">
                <UFormField
                  label="Question"
                  :name="`conditions[${index}].reference_id`"
                  required
                >
                  <USelect
                    v-model="condition.reference_id"
                    :items="questionOptions"
                    placeholder="Select question"
                    class="w-full"
                    size="lg"
                  />
                </UFormField>
                <UFormField
                  label="Answer"
                  :name="`conditions[${index}].x_value`"
                  required
                >
                  <USelect
                    v-model="condition.x_value"
                    :items="answerOptionsFor(condition)"
                    :disabled="!condition.reference_id"
                    placeholder="Select answer"
                    class="w-full"
                    size="lg"
                  />
                </UFormField>
              </template>
              <template v-else>
                <UFormField
                  label="X Operator"
                  :name="`conditions[${index}].x_operator`"
                  required
                >
                  <USelect
                    v-model="condition.x_operator"
                    :items="operatorOptions"
                    placeholder="Please Select"
                    class="w-full"
                    size="lg"
                  />
                </UFormField>
                <UFormField
                  label="X Value"
                  :name="`conditions[${index}].x_value`"
                  required
                >
                  <UInput
                    v-model="condition.x_value"
                    placeholder="Enter value"
                    class="w-full"
                    type="number"
                    size="lg"
                  />
                </UFormField>
                <UFormField
                  label="Y Operator"
                  :name="`conditions[${index}].y_operator`"
                >
                  <USelect
                    v-model="condition.y_operator"
                    :items="operatorOptions"
                    placeholder="Please Select"
                    class="w-full"
                    size="lg"
                  />
                </UFormField>
                <UFormField
                  label="Y Value"
                  :name="`conditions[${index}].y_value`"
                >
                  <UInput
                    v-model="condition.y_value"
                    placeholder="Enter Y value"
                    class="w-full"
                    type="number"
                    size="lg"
                  />
                </UFormField>
              </template>
              <UFormField
                label="Sessions"
                :name="`conditions[${index}].session`"
                required
                class="col-span-2"
              >
                <USelect
                  v-model="condition.session"
                  :items="sessionOptions"
                  multiple
                  placeholder="Select sessions"
                  class="w-full"
                  size="lg"
                />
              </UFormField>
            </div>
          </div>

          <div class="flex items-end justify-between gap-4">
            <UButton
              icon="i-lucide-plus"
              variant="outline"
              label="Add Metric"
              @click="addCondition"
            />
            <UFormField
              v-if="ruleState.conditions.length > 1"
              label="Match"
              name="match_mode"
              required
              class="w-64"
            >
              <USelect
                v-model="ruleState.match_mode"
                :items="matchModeItems"
                class="w-full"
                size="lg"
              />
            </UFormField>
          </div>

          <!-- Payment -->
          <div
            class="border-t border-gray-200 dark:border-gray-800 pt-4 grid grid-cols-2 gap-4"
          >
            <UFormField label="Amount Type" name="amount_type" required>
              <USelect
                v-model="ruleState.amount_type"
                :items="amountTypeItems"
                placeholder="Please Select"
                class="w-full"
                size="lg"
              />
            </UFormField>
            <UFormField label="Amount" name="amount" required>
              <UInput
                v-model="ruleState.amount"
                placeholder="Enter amount"
                class="w-full"
                type="number"
                size="lg"
              />
            </UFormField>
            <UFormField label="Is Deduction" name="is_deduction" required>
              <USelect
                v-model="ruleState.is_deduction"
                :items="deductionItems"
                placeholder="Please Select"
                class="w-full"
                size="lg"
              />
            </UFormField>
            <UFormField label="Apply Rules" name="apply_once" required>
              <URadioGroup
                v-model="ruleState.apply_once"
                :items="applyOnceItems"
              />
            </UFormField>
            <template v-if="ruleState.apply_once === 'Apply Once'">
              <UFormField label="Apply Once When Count" name="y_operator">
                <USelect
                  v-model="ruleState.y_operator"
                  :items="operatorOptions"
                  placeholder="Matched at least once"
                  class="w-full"
                  size="lg"
                />
              </UFormField>
              <UFormField label="Threshold Value" name="y_value">
                <UInput
                  v-model="ruleState.y_value"
                  placeholder="Enter threshold"
                  class="w-full"
                  type="number"
                  size="lg"
                />
              </UFormField>
            </template>
            <UFormField label="Groups" name="group_ids" class="col-span-2">
              <USelectMenu
                v-model="ruleState.group_ids"
                :items="
                  groups.map((group) => ({
                    label: group.name,
                    value: group.id,
                  }))
                "
                placeholder="Select groups"
                class="w-full"
                size="lg"
                multiple
              />
            </UFormField>
          </div>
        </div>
        <div class="mt-8 flex gap-2 justify-end">
          <UButton
            @click="rulesModalOpen = false"
            color="neutral"
            label="Cancel"
          />
          <UButton
            type="submit"
            :loading="isRuleSubmitting"
            :disabled="isRuleSubmitting"
            :label="ruleForm.id ? 'Update' : 'Submit'"
          />
        </div>
      </UForm>
    </template>
  </UModal>

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

  <!-- Single Student Processing Check Modal (Main Page) -->
  <CommonProcessCheckDepositModal
    v-model="singleStudentCheckModal"
    :title="
      selectedStudentForAction
        ? `${selectedStudentForAction.first_yiddish_name} ${selectedStudentForAction.last_yiddish_name} : Process Checks`
        : 'Process Checks'
    "
    :loading="processCheckSingleStudentLoading"
    type="check"
    isDescriptionRequired
    @submit="onMainPageStudentCheckDateChange"
  />

  <!-- Single Student Processing Deposit Modal (Main Page) -->
  <CommonProcessCheckDepositModal
    v-model="singleStudentDepositModal"
    :title="
      selectedStudentForAction
        ? `${selectedStudentForAction.first_yiddish_name} ${selectedStudentForAction.last_yiddish_name} : Process Deposit`
        : 'Process Deposit'
    "
    :loading="processDepositSingleStudentLoading"
    type="deposit"
    isDescriptionRequired
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

  <!-- Check pdf preview modal -->
  <CommonPdfPreviewModal v-model="pdfCheckModal" :data="pdfChecks" />
</template>

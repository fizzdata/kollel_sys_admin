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

// Get date 7 days ago
const fromDate = todayDate.subtract({ days: 7 });

const calendarRange = ref({
  start: fromDate,
  end: todayDate,
});

const deductionItems = ref([
  {
    label: "Deduction",
    value: true,
  },
  {
    label: "Bonus",
    value: false,
  },
]);
const amountTypeItems = ref([
  {
    label: "Fixed",
    value: "fixed",
  },
  {
    label: "Percentage",
    value: "percentage",
  },
]);
const matchModeItems = ref([
  { label: "ALL metrics must match", value: "all" },
  { label: "ANY metric can match", value: "any" },
]);
const route = useRoute();
const api = useApi();
const toast = useToast();

const applyOnceItems = ref(["Apply Once", "Each Time"]);
const activeTab = ref("0");
const operaterLabels = ref({});
const metricLabels = ref({});

const groupId = route.params.id;
const loading = ref(false);
const processRulesLoading = ref(false);
const processChecksLoading = ref(false);
const processDepositLoading = ref(false);
const rules = ref([]);
const processRules = ref([]);
const rulesModalOpen = ref(false);
const operatorOptions = ref([]);
const metricOptions = ref([]);
const isSubmitting = ref(false);
const fetchingRulesOptions = ref(false);
const fetchingGroupDetails = ref(null);
const deleteModal = ref(false);
const showModal = ref(false);
const processChecksModal = ref(false);
const processDepositModal = ref(false);

const fetchingGroupStudents = ref(false);
const fetchingRules = ref(false);

// All Groups state for rule assignment
const allGroups = ref([]);
const fetchingGroups = ref(false);
const assigningRuleIds = ref([]);
const selectedRuleToAdd = ref(null);

// Student states
const groupStudents = ref([]);
const allStudents = ref([]);
const addStudentModal = ref(false);
const isStudentFormSubmiting = ref(false);
const studentFetching = ref(false);

const fetchingSingleStudentPreview = ref(false);

const processGroupStudentModal = ref(false);
const processGroupRules = ref([]);
const singleStudentCheckModal = ref(false);
const processCheckSingleStudentLoading = ref(false);
const singleStudentDepositModal = ref(false);
const processDepositSingleStudentLoading = ref(false);
const selectedStudent = ref(null);

const pdfCheckModal = ref(false);
const pdfChecks = ref([]);

const items = computed(() => [
  {
    label: "Rules",
    key: "rules",
  },
  {
    label: "Group Students",
    key: "students",
  },
]);

const isProcessModalOpen = async () => {
  showModal.value = true;
  await fetchProcessRules({
    from_date: calendarRange.value.start?.toString(),
    till_date: calendarRange.value.end?.toString(),
  });
};

// Form State and Schema
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

const schema = object({
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

const rulesform = ref({ id: null });

const rulesState = reactive({
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
  rulesState.conditions.push(blankCondition());
};

const removeCondition = (index) => {
  if (rulesState.conditions.length > 1) {
    rulesState.conditions.splice(index, 1);
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
  () => rulesState.conditions.map((condition) => condition.metric),
  () => {
    rulesState.conditions.forEach((condition) => {
      if (
        condition.metric === "answered_question" &&
        condition.x_operator !== "="
      ) {
        condition.x_operator = "=";
      }
    });
  },
);

const resetRulesForm = () => {
  rulesform.value.id = null;

  Object.assign(rulesState, {
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

const normalizeGroupIds = (groupIds = []) =>
  Array.isArray(groupIds)
    ? groupIds.map((group) =>
        typeof group === "object" ? group.value : Number(group),
      )
    : [];

const sortedGroups = computed(() => {
  return [...allGroups.value].sort((a, b) => {
    if (String(a.id) === String(groupId)) return -1;
    if (String(b.id) === String(groupId)) return 1;
    return a.name.localeCompare(b.name);
  });
});

const getRuleSummary = (rule) => {
  const conditions = rule.conditions || [];
  const first = conditions[0] || {};
  const metricLabel = metricLabels.value[first.metric] || first.metric || "";
  const operatorLabel =
    operaterLabels.value[first.x_operator] || first.x_operator || "";
  const amountUnit = rule.amount_type === "fixed" ? "dollars" : "percent";
  const cadence = Number(rule.apply_once) ? "once" : "each time";
  const joiner = rule.match_mode === "any" ? " OR " : " AND ";

  const extraText = conditions
    .slice(1)
    .map((condition) => `${joiner}${metricLabels.value[condition.metric] || condition.metric}`)
    .join("");

  return `If ${metricLabel}${extraText} is ${operatorLabel} ${first.x_value}, ${Number(rule.is_deduction) ? "Deduction" : "Bonus"} is ${rule.amount_type} ${rule.amount} ${amountUnit}, ${cadence}`;
};

const currentGroupRules = computed(() =>
  allGroups.value.filter((rule) =>
    normalizeGroupIds(rule.group_ids).includes(Number(groupId)),
  ),
);
const availableRulesForCurrentGroup = computed(() =>
  allGroups.value.filter((rule) => !normalizeGroupIds(rule.group_ids).includes(Number(groupId))),
);

const availableRuleOptions = computed(() =>
  availableRulesForCurrentGroup.value.map((rule) => ({
    label: `#${rule.id} - ${rule.description || getRuleSummary(rule)}`,
    value: rule.id,
  })),
);

const getAssignedRulesForGroup = (group) =>
  rules.value.filter((rule) => normalizeGroupIds(rule.group_ids).includes(group.id));

const getAvailableRulesForGroup = (group) =>
  rules.value.filter(
    (rule) => !normalizeGroupIds(rule.group_ids).includes(group.id),
  );

const isAssigningRule = (ruleId, groupId) =>
  assigningRuleIds.value.includes(`${ruleId}-${groupId}`);

const updateRuleAssignments = async (rule, groupIds, successMessage) => {
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

  const response = await api(`/api/payroll/group/${groupId}/rules/${rule.id}`, {
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

const handleAddRuleToCurrentGroup = async () => {
  const selectedRuleId =
    typeof selectedRuleToAdd.value === "object"
      ? selectedRuleToAdd.value?.value
      : selectedRuleToAdd.value;

  if (!selectedRuleId) {
    toast.add({
      title: "Error",
      description: "Please select a rule to add.",
      color: "error",
      duration: 2000,
    });
    return;
  }

  const rule = allGroups.value.find((item) => Number(item.id) === Number(selectedRuleId));

  if (!rule) {
    toast.add({
      title: "Error",
      description: "Selected rule not found.",
      color: "error",
      duration: 2000,
    });
    return;
  }

  await handleAssignRuleToGroup(
    { id: Number(groupId), name: fetchingGroupDetails.value?.name || "group" },
    rule,
  );
  selectedRuleToAdd.value = null;
  await fetchAllGroups();
};

// MM/dd/yyyy
const fetchProcessRules = async (date) => {
  processRulesLoading.value = true;
  await rulesOptionsFetch(); // Ensure labels are loaded
  try {
    const response = await api(`/api/payroll/group/${groupId}/process`, {
      method: "GET",
      params: {
        from_date: date?.from_date,
        till_date: date?.till_date,
      },
    });

    if (response?.success) {
      processRules.value = Array.isArray(response?.data)
        ? response.data
        : Object.values(response?.data || {});
    }
  } catch (err) {
    console.log("🚀 ~ fetchProcessRules ~ err:", err);
    toast.add({
      description: "Error fetching payroll process. Please try again later.",
      color: "error",
      timeout: 3000,
    });
  } finally {
    processRulesLoading.value = false;
  }
};

const fetchProcessChecks = async (data) => {
  try {
    processChecksLoading.value = true;
    const response = await api(`/api/payroll/group/${groupId}/process/checks`, {
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
        description: response?.message || "Direct deposit processing started",
        color: "success",
        duration: 2000,
      });
      processChecksModal.value = false;
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
    toast.add({
      title: "Error",
      description:
        "An error occurred while deposit checks. Please try again later.",
      color: "error",
      duration: 2000,
    });
  } finally {
    processChecksLoading.value = false;
  }
};

const fetchProcessDeposit = async (data) => {
  try {
    processDepositLoading.value = true;
    const response = await api(
      `/api/payroll/group/${groupId}/process/deposit`,
      {
        method: "POST",
        body: {
          from_date: data?.from_date,
          till_date: data?.till_date,
          description: data?.description,
        },
      },
    );

    if (response?.success) {
      toast.add({
        title: "Success",
        description: response?.message || "Direct deposit processing started",
        color: "success",
        duration: 2000,
      });
      processDepositModal.value = false;
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
    toast.add({
      title: "Error",
      description:
        "An error occurred while deposit checks. Please try again later.",
      color: "error",
      duration: 2000,
    });
  } finally {
    processDepositLoading.value = false;
  }
};

const editRules = (rules) => {
  rulesOptionsFetch();
  fetchScheduleQuestions();

  // Open modal instantly
  rulesModalOpen.value = true;

  // Fill form instantly
  rulesform.value.id = rules.id;
  rulesState.description = rules.description;
  rulesState.match_mode = rules.match_mode || "all";
  rulesState.conditions = (rules.conditions || []).map((condition) => ({
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

  if (!rulesState.conditions.length) {
    rulesState.conditions = [blankCondition()];
  }

  rulesState.is_deduction = rules.is_deduction === 1 ? true : false;
  rulesState.amount_type = rules.amount_type;
  rulesState.amount = rules.amount;
  rulesState.apply_once = rules.apply_once === 1 ? "Apply Once" : "Each Time";
  rulesState.y_operator = rules.y_operator ?? "";
  rulesState.y_value = rules.y_value ?? "";

  // Set group_ids if they exist
  if (rules.group_ids && Array.isArray(rules.group_ids)) {
    rulesState.group_ids = normalizeGroupIds(rules.group_ids);
  }
};

const confirmDeleteRules = async () => {
  try {
    isSubmitting.value = true;

    const response = await api(
      `/api/payroll/group/${groupId}/rules/${rulesform.value.id}`,
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
      deleteModal.value = false; // Close the modal
      await fetchRules(true);
      // Reset form state after deletion
      resetRulesForm();
    } else {
      toast.add({
        title: "Failed",
        description:
          response?._data.errors ||
          response?._data.message ||
          "Failed to delete Rules",
        color: "error",
        duration: 2000,
      });
    }
  } catch (error) {
    console.error("Error deleting Rules:", error);
    toast.add({
      title: "Error",
      description:
        "An error occurred while deleting group rules. Please try again later.",
      color: "error",
      duration: 2000,
    });
  } finally {
    isSubmitting.value = false;
  }
};

const onSubmit = async (event) => {
  try {
    isSubmitting.value = true;

    // Convert group_ids from objects to IDs if needed
    const groupIds = normalizeGroupIds(event.data.group_ids);

    const endpoint = rulesform.value.id
      ? `/api/payroll/group/${groupId}/rules/${rulesform.value.id}`
      : `/api/payroll/group/${groupId}/rules`;

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
      method: rulesform.value.id ? "PUT" : "POST",
      body: payload,
    });

    if (response?.success) {
      toast.add({
        title: "Success",
        description:
          response?.message ||
          (rulesform.value.id
            ? "Pay rule updated successfully"
            : "Pay rule created successfully"),
        color: "success",
        duration: 2000,
      });

      rulesModalOpen.value = false; // Close the modal

      await fetchRules(true);
      // Reset form state after submission
      resetRulesForm();
    } else {
      toast.add({
        title: "Failed",
        description:
          response?._data.errors ||
          response?._data.message ||
          "Failed to create New Rules",
        color: "error",
        duration: 2000,
      });
    }
  } catch (error) {
    console.error("Error creating Rules:", error);
    toast.add({
      title: "Error",
      description: "An unexpected error occurred. Please try again later.",
      color: "error",
      duration: 2000,
    });
  } finally {
    isSubmitting.value = false;
  }
};

const fetchGroupDetail = async () => {
  try {
    const response = await api(`/api/payroll/groups/${groupId}`);

    if (response?.success) {
      fetchingGroupDetails.value = response?.group;
    }
  } catch (err) {
    console.log("🚀 ~ fetchStudents ~ err:", err);
    toast.add({
      title: "Error",
      description:
        "An unexpected while fetching payroll groups. Please try again later.",
      color: "error",
      duration: 2000,
    });
  }
};

const rulesOptionsFetch = async () => {
  try {
    fetchingRulesOptions.value = true;
    const response = await api(`/api/payroll/rules-options`);

    if (response?.success) {
      // Metrics dropdown
      metricOptions.value = response.metrics.map((m) => ({
        label: m.description, // human-friendly label
        value: m.metric, // internal value
      }));

      // Operators dropdown
      operatorOptions.value = response.operators.map((op) => ({
        label: op.description, // human-friendly label
        value: op.operator, // internal value
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
      title: "Error",
      description:
        "An unexpected while fetching payroll rules options. Please try again later.",
      color: "error",
      duration: 2000,
    });
  } finally {
    fetchingRulesOptions.value = false;
  }
};

const fetchRules = async (refresh = false) => {
  try {
    if (refresh) {
      fetchingRules.value = true;
    }

    const response = await api(`/api/payroll/group/${groupId}/rules`);

    if (response?.success) {
      rules.value = response.pay_rules;
    }
  } catch (err) {
    console.log("🚀 ~ fetchGroups ~ err:", err);
    toast.add({
      title: "Error",
      description:
        "An unexpected while fetching group rules. Please try again later.",
      color: "error",
      duration: 2000,
    });
  } finally {
    fetchingRules.value = false;
  }
};

const isCreateRuleModalOpen = async () => {
  rulesModalOpen.value = true;
  await rulesOptionsFetch();
  await fetchScheduleQuestions();
};

const deleteRule = (rule) => {
  deleteModal.value = true;

  rulesform.value.id = rule.id;
};

const fetchGroupStudents = async () => {
  try {
    fetchingGroupStudents.value = true;
    const response = await api(`/api/payroll/students/group/${groupId}`);

    if (response?.success) {
      groupStudents.value = response?.students;
      studentState.student_ids = response?.students?.map((item) => ({
        label: item?.first_yiddish_name + " " + item?.last_yiddish_name,
        value: item?.id,
      }));
    }
  } catch (err) {
    console.log("🚀 ~ fetchGroups ~ err:", err);
    toast.add({
      title: "Error",
      description:
        "An unexpected while fetching group students. Please try again later.",
      color: "error",
      duration: 2000,
    });
  } finally {
    fetchingGroupStudents.value = false;
  }
};

const handleAddStudent = () => {
  addStudentModal.value = true;
  fetchAllStudents();
};

const fetchAllStudents = async () => {
  try {
    studentFetching.value = true;
    const response = await api(`/api/students`);

    if (response?.success) {
      allStudents.value =
        response?.students?.map((item) => ({
          label: item?.first_yiddish_name + " " + item?.last_yiddish_name,
          value: item?.id,
        })) || [];
    }
  } catch (err) {
    console.log("🚀 ~ fetchAllStudents ~ err:", err);
    toast.add({
      title: "Error",
      description:
        "An unexpected error occurred during fetching students. Please try again later.",
      color: "error",
    });
  } finally {
    studentFetching.value = false;
  }
};

const fetchAllGroups = async () => {
  try {
    fetchingGroups.value = true;
    const response = await api(`/api/payroll/rules`);

    if (response?.success) {
      allGroups.value = response?.pay_rules || [];
    }
  } catch (err) {
    console.log("Error fetching rules:", err);
    toast.add({
      title: "Error",
      description:
        "An unexpected error occurred while fetching rules. Please try again later.",
      color: "error",
    });
  } finally {
    fetchingGroups.value = false;
  }
};

const studentState = reactive({
  student_ids: [],
});

const onAddStudentSubmit = async (event) => {
  isStudentFormSubmiting.value = true;
  try {
    const payload = {
      student_ids: event.data.student_ids.map((item) => item.value),
    };

    const response = await api(`/api/payroll/students/group/${groupId}`, {
      method: "POST",
      body: payload,
    });

    if (response?.success) {
      toast.add({
        title: "Success",
        description:
          response?.message || "Students added to group successfully",
        color: "success",
        duration: 2000,
      });
      addStudentModal.value = false; // Close the modal
      await fetchGroupStudents();
      // Reset form state after submission
      studentState.student_ids = [];
    } else {
      toast.add({
        title: "Failed",
        description:
          response?.message ||
          response?._data.errors ||
          response?._data.message ||
          "Failed to create New Rules",
        color: "error",
        duration: 2000,
      });
    }
  } catch (error) {
    console.error("Error creating Rules:", error);
    toast.add({
      title: "Error",
      description:
        "An unexpected error occurred during student add to group. Please try again later.",
      color: "error",
    });
  } finally {
    isStudentFormSubmiting.value = false;
  }
};

const handlePreviewSingleStudentClick = async (student) => {
  selectedStudent.value = student;
  processGroupStudentModal.value = true;
  await fetchSingleStudentPreview({
    from_date: calendarRange.value.start?.toString(),
    till_date: calendarRange.value.end?.toString(),
  });
};

const handleSingleStudentCheckClick = async (student) => {
  selectedStudent.value = student;
  singleStudentCheckModal.value = true;
};

const handleSingleStudentDepositClick = async (student) => {
  selectedStudent.value = student;
  singleStudentDepositModal.value = true;
};

const fetchSingleStudentPreview = async (data) => {
  try {
    if (selectedStudent.value) {
      fetchingSingleStudentPreview.value = true;
      const response = await api(
        `/api/payroll/group/${groupId}/student/${selectedStudent.value.id}/preview`,
        {
          method: "GET",
          params: {
            from_date: data?.from_date,
            till_date: data?.till_date,
          },
        },
      );

      if (response?.success) {
        // Handle the preview data - can be array or object
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

        processGroupRules.value = previewArray;
        processGroupStudentModal.value = true;
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
      description:
        "An error occurred while fetching preview. Please try again later.",
      color: "error",
      duration: 2000,
    });
  } finally {
    fetchingSingleStudentPreview.value = false;
  }
};

// single student check
const fetchSingleStudentCheck = async (data) => {
  try {
    if (selectedStudent.value) {
      processCheckSingleStudentLoading.value = true;
      const response = await api(
        `/api/payroll/group/${groupId}/student/${selectedStudent.value.id}/process/checks`,
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

        pdfChecks.value = Object.entries(response?.data).map(
          ([id, base64]) => ({
            id,
            url: base64ToPdfUrl(base64),
          }),
        );

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

const fetchSingleStudentDeposit = async (data) => {
  try {
    if (selectedStudent.value) {
      processDepositSingleStudentLoading.value = true;
      const response = await api(
        `/api/payroll/group/${groupId}/student/${selectedStudent.value.id}/process/deposit`,
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
          description: response?.message || "Deposit processed successfully",
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
      description:
        "An error occurred while processing deposit. Please try again later.",
      color: "error",
      duration: 2000,
    });
  } finally {
    processDepositSingleStudentLoading.value = false;
  }
};

// single student check date change
const onSingleGroupCheckDateChange = async (val) => {
  if (!val?.from_date || !val?.till_date) {
    toast.add({
      title: "Error",
      description: "Please select a valid date range.",
      color: "error",
    });
    return;
  }

  await fetchSingleStudentCheck({
    ...val,
  });
};

// single student deposit date change
const onSingleGroupDepositDateChange = async (val) => {
  if (!val?.from_date || !val?.till_date) {
    toast.add({
      title: "Error",
      description: "Please select a valid date range.",
      color: "error",
    });
    return;
  }

  await fetchSingleStudentDeposit({
    ...val,
  });
};

onMounted(async () => {
  loading.value = true;
  await fetchGroupDetail();
  loading.value = false;
  await rulesOptionsFetch();
  await fetchAllGroups();
  rules.value = allGroups.value.filter((rule) =>
    normalizeGroupIds(rule.group_ids).includes(Number(groupId)),
  );
});

const onDateChange = async (val) => {
  if (!val?.start || !val?.end) {
    toast.add({
      title: "Error",
      description: "Please select a valid date range.",
      color: "error",
    });
    return;
  }

  await fetchProcessRules({
    from_date: val.start.toString(),
    till_date: val.end.toString(),
  });
};

const onSingleStudentPreviewDateChange = async (val) => {
  if (!val?.start || !val?.end) {
    toast.add({
      title: "Error",
      description: "Please select a valid date range.",
      color: "error",
    });
    return;
  }

  await fetchSingleStudentPreview({
    from_date: val.start.toString(),
    till_date: val.end.toString(),
  });
};

const onCheckFormSubmit = async (val) => {
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

const onDepositFormSubmit = async (val) => {
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

// watch for tab changes
watch(activeTab, (newTab) => {
  if (newTab === "0") {
    fetchAllGroups().then(() => {
      rules.value = allGroups.value.filter((rule) =>
        normalizeGroupIds(rule.group_ids).includes(Number(groupId)),
      );
    });
  } else if (newTab === "1") {
    fetchGroupStudents();
  }
});
</script>

<template>
  <div>
    <UButton
      variant="outline"
      color="primary"
      :to="`/payroll?tab=${route?.query?.tab}`"
      icon="i-lucide-arrow-left"
      label="Back to Payroll List"
    />

    <div v-if="loading" class="flex items-center justify-center pt-10 w-full">
      <BaseSpinner :show-loader="loading" size="md" />
    </div>

    <div v-else>
      <UCard class="rounded-2xl shadow-sm mt-6">
        <div class="flex flex-col gap-6">
          <!-- Header -->
          <div
            class="grid grid-cols-1 gap-4 md:grid-cols-2 flex-wrap justify-between items-start"
          >
            <!-- Group Info -->
            <div class="space-y-1">
              <h2 class="text-xl font-semibold">
                {{ fetchingGroupDetails?.name || "N/a" }}
              </h2>
              <p class="font-medium text-sm">
                Group Amount:
                <span class="font-normal">
                  ${{ fetchingGroupDetails?.amount || "N/a" }}
                </span>
              </p>
              <p class="text-sm font-medium">
                Min Amount:
                <span class="font-normal">
                  ${{ fetchingGroupDetails?.min_amount || "N/a" }}
                </span>
              </p>
            </div>

            <!-- Actions -->
            <div class="flex flex-wrap gap-2 sm:gap-2 sm:justify-end">
              <!-- TAB 0 ACTIONS -->
              <template v-if="activeTab === '0'">
                <UButton
                  icon="i-lucide-settings"
                  label="Processing Rules"
                  variant="solid"
                  color="primary"
                  @click="isProcessModalOpen"
                />
                <UButton
                  icon="i-lucide-check-square"
                  label="Process Checks"
                  variant="solid"
                  color="primary"
                  @click="processChecksModal = true"
                />
                <UButton
                  icon="i-lucide-wallet"
                  label="Process Deposit"
                  variant="solid"
                  color="primary"
                  @click="processDepositModal = true"
                />
              </template>

              <!-- TAB 1 ACTION -->
              <template v-if="activeTab === '1'">
                <UButton
                  icon="i-lucide-user-plus"
                  label="Add Student"
                  variant="solid"
                  color="primary"
                  @click="handleAddStudent"
                />
              </template>
            </div>
          </div>
        </div>
      </UCard>

      <UTabs
        v-model="activeTab"
        color="neutral"
        variant="link"
        :items="items"
        class="w-full my-4"
      />
    </div>
  </div>
  <template v-if="activeTab === '0'">
    <div>
      <div
        v-if="fetchingRules"
        class="flex items-center justify-center pt-10 w-full"
      >
        <BaseSpinner :show-loader="fetchingRules" size="md" />
      </div>

      <div v-else>
        <div v-if="currentGroupRules?.length > 0">
          <div
            class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-6"
          >
            <UCard
              v-for="rule in currentGroupRules"
              :key="rule.id"
              class="rounded-2xl shadow hover:shadow-xl transition-shadow duration-300"
            >
              <div>
                <label>{{ getRuleSummary(rule) }}</label>
              </div>
              <div
                class="flex justify-between items-baseline text-end gap-6 text-gray-500"
              >
                <p class="text-xs mt-2">
                  {{ rule.description }}
                </p>
                <UButton
                  icon="i-lucide-x"
                  size="md"
                  color="error"
                  variant="soft"
                  :loading="isAssigningRule(rule.id, Number(groupId))"
                  :disabled="isAssigningRule(rule.id, Number(groupId))"
                  @click="
                    handleRemoveRuleFromGroup(
                      { id: Number(groupId), name: fetchingGroupDetails?.name || 'group' },
                      rule,
                    )
                  "
                />
              </div>
            </UCard>
          </div>
        </div>
        <div v-else class="text-center text-gray-500 mt-10">
          No rules in this group yet.
        </div>

        <UCard class="rounded-2xl shadow-sm mt-6">
          <div class="flex flex-col md:flex-row md:items-end gap-3">
            <UFormField
              label="Add Existing Rule"
              name="selected_rule_to_add"
              class="flex-1"
            >
              <USelectMenu
                v-model="selectedRuleToAdd"
                :items="availableRuleOptions"
                placeholder="Select rule by id and description"
                class="w-full"
                size="lg"
              />
            </UFormField>
            <UButton
              color="primary"
              label="Add Rule"
              :disabled="!availableRuleOptions.length"
              @click="handleAddRuleToCurrentGroup"
            />
          </div>
        </UCard>
      </div>
    </div>
  </template>
  <template v-if="activeTab === '1'">
    <!-- Students Tab -->
    <UCard class="rounded-2xl shadow-sm mt-6">
      <div
        class="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-0"
      >
        <h2 class="md:text-lg text-base font-bold">
          View and manage group students
        </h2>
      </div>

      <PayrollStudents
        :students="groupStudents"
        :fetchingGroupStudents="fetchingGroupStudents"
        :metric-labels="metricLabels"
        :operater-labels="operaterLabels"
        @refresh="fetchGroupStudents"
        @preview="handlePreviewSingleStudentClick"
        @check="handleSingleStudentCheckClick"
        @deposit="handleSingleStudentDepositClick"
      />
    </UCard>
  </template>

  <!-- Rules Create/Edit Modal -->
  <UModal v-model:open="rulesModalOpen">
    <!-- Custom Header -->
    <template #header>
      <div class="flex justify-between w-full">
        <h2 class="text-xl font-bold text-primary">
          {{ rulesform.id ? "Edit Rule" : " Create New Rule" }}
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
              rulesModalOpen = false;
              resetRulesForm();
            }
          "
        >
        </UButton>
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
        :state="rulesState"
        :schema="schema"
        class=""
        @submit="onSubmit"
      >
        <div class="space-y-6">
          <UFormField label="Description" name="description" required>
            <UInput
              v-model="rulesState.description"
              placeholder="Please enter description"
              class="w-full"
              size="lg"
            />
          </UFormField>

          <!-- Metric conditions -->
          <div
            v-for="(condition, index) in rulesState.conditions"
            :key="index"
            class="border border-gray-200 dark:border-gray-800 rounded-xl p-4"
          >
            <div class="flex items-center justify-between mb-4">
              <span class="font-semibold">Metric {{ index + 1 }}</span>
              <UButton
                v-if="rulesState.conditions.length > 1"
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
                    placeholder="Enter your value"
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
              v-if="rulesState.conditions.length > 1"
              label="Match"
              name="match_mode"
              required
              class="w-64"
            >
              <USelect
                v-model="rulesState.match_mode"
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
                v-model="rulesState.amount_type"
                :items="amountTypeItems"
                placeholder="Please Select"
                class="w-full"
                size="lg"
              />
            </UFormField>
            <UFormField label="Amount" name="amount" required>
              <UInput
                v-model="rulesState.amount"
                placeholder="Enter your amount"
                class="w-full"
                type="number"
                size="lg"
              />
            </UFormField>
            <UFormField label="Is Deduction" name="is_deduction" required>
              <USelect
                v-model="rulesState.is_deduction"
                :items="deductionItems"
                placeholder="Please Select"
                class="w-full"
                size="lg"
              />
            </UFormField>
            <UFormField label="Apply Rules" name="apply_once" required>
              <URadioGroup
                v-model="rulesState.apply_once"
                :items="applyOnceItems"
              />
            </UFormField>
            <template v-if="rulesState.apply_once === 'Apply Once'">
              <UFormField label="Apply Once When Count" name="y_operator">
                <USelect
                  v-model="rulesState.y_operator"
                  :items="operatorOptions"
                  placeholder="Matched at least once"
                  class="w-full"
                  size="lg"
                />
              </UFormField>
              <UFormField label="Threshold Value" name="y_value">
                <UInput
                  v-model="rulesState.y_value"
                  placeholder="Enter threshold"
                  class="w-full"
                  type="number"
                  size="lg"
                />
              </UFormField>
            </template>
            <div
              class="col-span-2 rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600"
            >
              Save the rule here. Group assignment is managed from the main
              payroll Rules tab.
            </div>
          </div>
        </div>
        <div class="mt-8 flex gap-2 justify-end">
          <UButton
            @click="rulesModalOpen = false"
            color="neutral"
            class="justify-center"
            label="Cancel"
          />

          <UButton
            type="submit"
            :loading="isSubmitting"
            :disabled="isSubmitting"
            class="justify-center"
            :label="rulesform.id ? 'Update' : 'Submit'"
          />
        </div>
      </UForm>
    </template>
  </UModal>

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
          @click="confirmDeleteRules()"
          label="Delete"
        />
      </div>
    </template>
  </UModal>

  <!-- Modal for Processing Rules -->
  <CommonRulesModal
    v-model="showModal"
    title="Processing Rules"
    :rules="processRules"
    :loading="processRulesLoading"
    :metric-labels="metricLabels"
    :operater-labels="operaterLabels"
    type="process"
    @date-change="onDateChange"
  />

  <!-- Modal for Process Checks Rules -->
  <CommonProcessCheckDepositModal
    v-model="processChecksModal"
    title="Process Checks"
    :loading="processChecksLoading"
    type="check"
    @submit="onCheckFormSubmit"
  />

  <!-- Modal for Deposit Checks -->
  <CommonProcessCheckDepositModal
    v-model="processDepositModal"
    title="Process Deposit"
    :loading="processDepositLoading"
    type="deposit"
    @submit="onDepositFormSubmit"
  />

  <!-- Add Student in group -->
  <UModal
    v-model:open="addStudentModal"
    title="Add Student in Group"
    :close="{
      color: 'primary',
      variant: 'outline',
      class: 'rounded-full',
    }"
  >
    <template #body>
      <div
        v-if="studentFetching"
        class="flex items-center justify-center pt-10 w-full"
      >
        <BaseSpinner :show-loader="studentFetching" size="md" />
      </div>

      <UForm v-else :state="studentState" @submit="onAddStudentSubmit">
        <div class="">
          <UFormField
            label="Select Student to add in Group"
            name="studentState"
          >
            <USelectMenu
              v-model="studentState.student_ids"
              :items="allStudents"
              placeholder="Please Select"
              class="w-full"
              size="lg"
              multiple
              required
            />
          </UFormField>
        </div>
        <div class="mt-8 flex gap-2 justify-end">
          <UButton
            @click="addStudentModal = false"
            color="neutral"
            class="justify-center"
            label="Cancel"
          />
          <UButton
            type="submit"
            :loading="isStudentFormSubmiting"
            :disabled="isStudentFormSubmiting"
            class="justify-center"
            label="Submit"
          />
        </div>
      </UForm>
    </template>
  </UModal>

  <!-- Single Student Processing Check Modal -->
  <CommonProcessCheckDepositModal
    v-model="singleStudentCheckModal"
    :title="
      selectedStudent
        ? `${selectedStudent.first_yiddish_name} ${selectedStudent.last_yiddish_name} : Single Student Process Checks`
        : 'Single Student Process Checks'
    "
    :loading="processCheckSingleStudentLoading"
    type="check"
    isDescriptionRequired
    @submit="onSingleGroupCheckDateChange"
  />

  <!-- Single Student Processing Deposit Modal -->
  <CommonProcessCheckDepositModal
    v-model="singleStudentDepositModal"
    :title="
      selectedStudent
        ? `${selectedStudent.first_yiddish_name} ${selectedStudent.last_yiddish_name} : Single  Student Process Deposit`
        : 'Single  Student Process Deposit'
    "
    :loading="processDepositSingleStudentLoading"
    type="deposit"
    isDescriptionRequired
    @submit="onSingleGroupDepositDateChange"
  />

  <!-- Single Student Processing Rules Modal -->
  <CommonRulesModal
    v-model="processGroupStudentModal"
    :title="
      selectedStudent
        ? `${selectedStudent.first_yiddish_name} ${selectedStudent.last_yiddish_name} : Group Student Preview`
        : 'Group Student Preview'
    "
    :rules="processGroupRules"
    :loading="fetchingSingleStudentPreview"
    :metric-labels="metricLabels"
    :operater-labels="operaterLabels"
    type="process"
    @date-change="onSingleStudentPreviewDateChange"
  />

  <!-- Check pdf preview modal -->
  <CommonPdfPreviewModal v-model="pdfCheckModal" :data="pdfChecks" />
</template>

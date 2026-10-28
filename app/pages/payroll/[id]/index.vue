<script setup>
import { today, getLocalTimeZone } from "@internationalized/date";
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

const route = useRoute();
const api = useApi();
const toast = useToast();
const jobTracker = useJobTracker();

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

const studentProcessModal = ref(false);
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

const getRuleSummary = (rule) => {
  const conditions = rule.conditions || [];
  const joiner = rule.match_mode === "any" ? " OR " : " AND ";
  const conditionsText = conditions.length
    ? conditions.map(conditionText).join(joiner)
    : "—";
  const amountUnit = rule.amount_type === "fixed" ? "dollars" : "percent";
  const cadence = Number(rule.apply_once) ? "once" : "each time";
  const refLabel = rule.reference_number ? `#${rule.reference_number} — ` : "";

  return `${refLabel}If ${conditionsText}, ${Number(rule.is_deduction) ? "Deduction" : "Bonus"} is ${rule.amount_type} ${rule.amount} ${amountUnit}, ${cadence}`;
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
const groupRuleColumns = [
  {
    header: "Ref #",
    cell: ({ row }) => row.original.reference_number || "—",
    meta: { class: { th: "w-[8%]", td: "whitespace-normal break-words align-top" } },
  },
  {
    accessorKey: "description",
    header: "Description",
    meta: { class: { th: "w-[20%]", td: "whitespace-normal break-words align-top" } },
  },
  {
    header: "Trigger",
    cell: ({ row }) => conditionsSummary(row.original),
    meta: { class: { th: "w-[30%]", td: "whitespace-normal break-words align-top" } },
  },
  {
    header: "Payment",
    cell: ({ row }) => paymentSummary(row.original),
    meta: { class: { th: "w-[16%]", td: "whitespace-normal break-words align-top" } },
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
    meta: { class: { th: "w-[16%]", td: "whitespace-normal break-words align-top" } },
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
          { text: "Remove from this group" },
          {
            default: () =>
              h(resolveComponent("UButton"), {
                icon: "i-lucide-x",
                size: "md",
                color: "error",
                variant: "soft",
                loading: isAssigningRule(row.original.id, Number(groupId)),
                disabled: isAssigningRule(row.original.id, Number(groupId)),
                onClick: () =>
                  handleRemoveRuleFromGroup(
                    { id: Number(groupId), name: fetchingGroupDetails.value?.name || "group" },
                    row.original,
                  ),
              }),
          },
        ),
      ]),
    meta: { class: { th: "w-[12%]", td: "align-top" } },
  },
];

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
    label: `${rule.reference_number ? `#${rule.reference_number} - ` : ""}${rule.description || conditionsSummary(rule)}`,
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
      jobTracker.track(response?.job_id, "Processing Direct Deposit");
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

  editingRule.value = rules;
  rulesModalOpen.value = true;
};

const viewingRule = ref(null);
const ruleDetailModalOpen = ref(false);

const viewRule = (rule) => {
  rulesOptionsFetch();
  fetchScheduleQuestions();

  viewingRule.value = rule;
  ruleDetailModalOpen.value = true;
};

const handleEditFromDetail = (rule) => {
  ruleDetailModalOpen.value = false;
  editRules(rule);
};

const confirmDeleteRules = async () => {
  try {
    isSubmitting.value = true;

    const response = await api(
      `/api/payroll/group/${groupId}/rules/${deleteRuleId.value}`,
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
      deleteRuleId.value = null;
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

const handleRuleSubmit = async (payload) => {
  try {
    isSubmitting.value = true;

    const ruleId = editingRule.value?.id;
    const endpoint = ruleId
      ? `/api/payroll/group/${groupId}/rules/${ruleId}`
      : `/api/payroll/group/${groupId}/rules`;

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

      rulesModalOpen.value = false; // Close the modal
      editingRule.value = null;

      await fetchRules(true);
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
  editingRule.value = null;
  rulesModalOpen.value = true;
  await rulesOptionsFetch();
  await fetchScheduleQuestions();
};

const deleteRule = (rule) => {
  deleteModal.value = true;

  deleteRuleId.value = rule.id;
};

const fetchGroupStudents = async () => {
  try {
    fetchingGroupStudents.value = true;
    const response = await api(`/api/payroll/students/group/${groupId}`);

    if (response?.success) {
      groupStudents.value = response?.students;
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

const studentSearch = ref("");
const studentRowSelection = ref({});

const studentPickerColumns = [
  {
    id: "select",
    header: ({ table }) =>
      h(resolveComponent("UCheckbox"), {
        modelValue: table.getIsAllRowsSelected()
          ? true
          : table.getIsSomeRowsSelected()
            ? "indeterminate"
            : false,
        "onUpdate:modelValue": (value) => table.toggleAllRowsSelected(!!value),
      }),
    cell: ({ row }) =>
      h(resolveComponent("UCheckbox"), {
        modelValue: row.getIsSelected(),
        "onUpdate:modelValue": (value) => row.toggleSelected(!!value),
      }),
  },
  {
    accessorKey: "label",
    header: "Name",
  },
];

// allStudents minus whoever is already in this group — re-adding them is
// pointless (and just clutters the list at scale)
const pickableStudents = computed(() => {
  const memberIds = new Set((groupStudents.value || []).map((s) => s.id));
  return allStudents.value.filter((s) => !memberIds.has(s.value));
});

const filteredStudents = computed(() => {
  const search = studentSearch.value.trim().toLowerCase();
  if (!search) return pickableStudents.value;
  return pickableStudents.value.filter((s) =>
    s.label.toLowerCase().includes(search),
  );
});

watch(studentRowSelection, (selection) => {
  studentState.student_ids = Object.keys(selection)
    .filter((id) => selection[id])
    .map(Number);
});

const handleAddStudent = () => {
  studentSearch.value = "";
  studentRowSelection.value = {};
  studentState.student_ids = [];
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
      student_ids: event.data.student_ids,
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
      studentRowSelection.value = {};
      studentSearch.value = "";
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

const handleSingleStudentProcessClick = (student) => {
  selectedStudent.value = student;
  studentProcessModal.value = true;
};

// Fired by StudentProcessModal once it has successfully created a real
// Check/Deposit (including any manual adjustment rows the admin added).
const onStudentProcessed = ({ outputType, response }) => {
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
        <UTable
          v-if="currentGroupRules?.length > 0"
          :columns="groupRuleColumns"
          :data="currentGroupRules"
          class="flex-1 mt-6"
          :ui="{ base: 'table-fixed min-w-full' }"
        />
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
                placeholder="Search by reference # or description"
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
        @process="handleSingleStudentProcessClick"
      />
    </UCard>
  </template>

  <!-- Rules Create/Edit Modal -->
  <CommonPayRuleFormModal
    v-model="rulesModalOpen"
    :rule="editingRule"
    :group-id="groupId"
    :metric-options="metricOptions"
    :operator-options="operatorOptions"
    :metric-labels="metricLabels"
    :operater-labels="operaterLabels"
    :schedule-questions="scheduleQuestions"
    :loading-options="fetchingRulesOptions"
    :submitting="isSubmitting"
    @submit="handleRuleSubmit"
  />

  <CommonPayRuleDetailModal
    v-model="ruleDetailModalOpen"
    :rule="viewingRule"
    :metric-labels="metricLabels"
    :operater-labels="operaterLabels"
    :schedule-questions="scheduleQuestions"
    :loading-options="fetchingRulesOptions"
    @edit="handleEditFromDetail"
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
    :dismissible="false"
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
            label="Select Students to add to Group"
            name="student_ids"
          >
            <div class="flex items-center justify-between gap-4 mb-2">
              <UInput
                v-model="studentSearch"
                placeholder="Search students…"
                icon="i-lucide-search"
                class="flex-1"
              />
              <span class="text-sm text-gray-500 whitespace-nowrap">
                {{ studentState.student_ids.length }} selected
              </span>
            </div>
            <div class="max-h-96 overflow-y-auto border rounded-lg">
              <UTable
                v-model:row-selection="studentRowSelection"
                :data="filteredStudents"
                :columns="studentPickerColumns"
                :get-row-id="(row) => String(row.value)"
                :ui="{ tr: 'data-[selected=true]:bg-primary/10' }"
              >
                <template #empty>
                  <div class="text-center text-gray-500 py-6">
                    No students found.
                  </div>
                </template>
              </UTable>
            </div>
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

  <!-- Single Student Process Modal -->
  <PayrollStudentProcessModal
    v-model="studentProcessModal"
    :student="selectedStudent"
    :group-id="groupId"
    @processed="onStudentProcessed"
  />

  <!-- Check pdf preview modal -->
  <CommonPdfPreviewModal v-model="pdfCheckModal" :data="pdfChecks" />
</template>

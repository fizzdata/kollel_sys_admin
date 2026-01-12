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
// Get today's date
const todayDate = today(getLocalTimeZone());

// Get date 7 days ago
const fromDate = todayDate.subtract({ days: 7 });

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

const applyOnceItems = ref(["Apply Once", "Each Time"]);
const activeTab = ref("0");
const operaterLabels = ref({});
const metricLabels = ref({});

const route = useRoute();
const groupId = route.params.id;
const loading = ref(false);
const processRulesLoading = ref(false);
const processChecksLoading = ref(false);
const processDepositLoading = ref(false);
const api = useApi();
const open = ref(false);
const checksDatePicker = ref(false);
const depositDatePicker = ref(false);

const rules = ref([]);
const groupStudents = ref([]);
const processRules = ref({});
const processCheckMessage = ref("");
const processDespositMessage = ref("");
const rulesModalOpen = ref(false);
const operatorOptions = ref([]);
const metricOptions = ref([]);
const isSubmitting = ref(false);
const toast = useToast();
const fetchingRulesOptions = ref(false);
const fetchingGroupDetails = ref(null);
const deleteModal = ref(false);
const showModal = ref(false);
const processChecksModal = ref(false);
const processDepositModal = ref(false);
const students = ref([]);
const addStudentModal = ref(false);
const isStudentSubmiting = ref(false);
const fetchingGroupStudents = ref(false);
const fetchingRules = ref(false);
const studentFetching = ref(false);
const selectedStudent = ref(null);
const isStudentDeleting = ref(false);
const studentState = reactive({
  student_ids: [],
});

const items = computed(() => [
  {
    label: `Rules (${rules?.value?.length || 0})`,
    key: "rules",
  },
  {
    label: `Students (${groupStudents?.value?.length || 0})`,
    key: "students",
  },
]);

const onAddStudentSubmit = async (event) => {
  isStudentSubmiting.value = true;
  try {
    const payload = {
      student_ids: event.data.student_ids.map((item) => item.value),
    };

    // return;
    const response = await api(`/api/payroll/group/${groupId}/students/add`, {
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

      await fetchGroupStudents();
      // Reset form state after submission
      studentState.student_ids = [];
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
  } finally {
    isStudentSubmiting.value = false;
    addStudentModal.value = false; // Close the modal
  }
};
const isModalOpen = async () => {
  processRulesLoading.value = true;
  showModal.value = true;
  await fetchProcessRules({
    from_date: calendarRange.value.start?.toString(),
    till_date: calendarRange.value.end?.toString(),
  });
  processRulesLoading.value = false;
};

// Form State and Schema
const schema = object({
  metric: string().required("Metric is required"),
  operator: string().required("Operator is required"),
  value: string().required("Value is required"),
  second_value: string().nullable(),
  is_deduction: string().required("Is Deduction is required"),
  amount_type: string().required("Amount Type is required"),
  amount: number()
    .typeError("Amount must be a number")
    .required("Amount is required")
    .min(0, "Amount cannot be negative"),
  apply_once: string().required("Apply Rules is required"),
  description: string(),
});

const rulesform = ref({
  id: null,
  metric: "",
  operator: "",
  value: "",
  second_value: "",
  is_deduction: "",
  amount_type: "",
  amount: "",
  apply_once: "Apply Once",
  description: "",
  reference_id: "",
});

const rulesState = reactive({ ...rulesform.value });

const resetRulesForm = () => {
  Object.assign(rulesform.value, {
    id: null,
    metric: "",
    operator: "",
    value: "",
    second_value: "",
    is_deduction: "",
    amount_type: "",
    amount: "",
    apply_once: "Apply Once",
    description: "",
    reference_id: "",
  });
  Object.assign(rulesState, rulesform.value);
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
      processRules.value = Object.values(response?.data || {});
    }
  } catch (err) {
    console.log("🚀 ~ fetchProcessRules ~ err:", err);
  } finally {
    processRulesLoading.value = false;
  }
};
const fetchProcessChecks = async (date) => {
  try {
    processChecksLoading.value = true;
    const response = await api(`/api/payroll/group/${groupId}/process/checks`, {
      method: "GET",
      params: {
        from_date: date?.from_date,
        till_date: date?.till_date,
      },
    });

    if (response?.success) {
      processCheckMessage.value = response?.message;
    }
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
    const response = await api(
      `/api/payroll/group/${groupId}/process/deposit`,
      {
        method: "GET",
        params: {
          from_date: date?.from_date,
          till_date: date?.till_date,
        },
      }
    );

    if (response?.success) {
      processDespositMessage.value = response?.message;
    }
  } catch (err) {
    console.log("🚀 ~ fetchProcessRules ~ err:", err);
  } finally {
    processChecksLoading.value = false;
  }
};
const isDepositModalOpen = async () => {
  processDepositModal.value = true;
  await fetchProcessDeposit({
    from_date: depositcalendarRange.value.start?.toString(),
    till_date: depositcalendarRange.value.end?.toString(),
  });
};

const editRules = (rules) => {
  rulesOptionsFetch();

  // Open modal instantly
  rulesModalOpen.value = true;

  // Fill form instantly
  rulesform.value.id = rules.id;
  rulesState.metric = rules.metric;
  rulesState.operator = rules.operator;
  rulesState.value = rules.value;
  rulesState.second_value = rules.second_value;
  rulesState.is_deduction = rules.is_deduction === 1 ? true : false;
  rulesState.amount_type = rules.amount_type;
  rulesState.amount = rules.amount;
  rulesState.apply_once = rules.apply_once === 1 ? "Apply Once" : "Each Time";
  rulesState.description = rules.description;
  rulesState.reference_id = rules.reference_id;
  rulesState.session = rules.session;
  rulesState.session = rules.session;
};

const confirmDeleteRules = async () => {
  try {
    isSubmitting.value = true;

    const response = await api(
      `/api/payroll/group/${groupId}/rules/${rulesform.value.id}`,
      {
        method: "DELETE",
      }
    );

    if (response?.success) {
      toast.add({
        title: "Success",
        description: response?.message || "Rules deleted successfully",
        color: "success",
        duration: 2000,
      });

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
  } finally {
    isSubmitting.value = false;
    deleteModal.value = false; // Close the modal
  }
};

const onSubmit = async (event) => {
  try {
    isSubmitting.value = true;

    const endpoint = rulesform.value.id
      ? `/api/payroll/group/${groupId}/rules/${rulesform.value.id}`
      : `/api/payroll/group/${groupId}/rules`;

    const payload = {
      ...event.data,
      is_deduction: event.data.is_deduction === "true" ? true : false,
      apply_once: event.data.apply_once === "Apply Once" ? true : false,
    };

    delete payload.id;
    const response = await api(endpoint, {
      method: rulesform.value.id ? "PUT" : "POST",
      body: payload,
    });

    if (response?.success) {
      toast.add({
        title: "Success",
        description: response?.message || "New Rules created successfully",
        color: "success",
        duration: 2000,
      });

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
  } finally {
    isSubmitting.value = false;
    rulesModalOpen.value = false; // Close the modal
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
  } finally {
    fetchingRules.value = false;
  }
};

const fetchGroupStudents = async () => {
  try {
    fetchingGroupStudents.value = true;
    const response = await api(`/api/payroll/group/${groupId}/students`);

    if (response?.success) {
      groupStudents.value = response?.students;
      studentState.student_ids = response?.students?.map((item) => ({
        label: item?.first_yiddish_name + " " + item?.last_yiddish_name,
        value: item?.id,
      }));
    }
  } catch (err) {
    console.log("🚀 ~ fetchGroups ~ err:", err);
  } finally {
    fetchingGroupStudents.value = false;
  }
};

const ismodalOpen = async () => {
  rulesModalOpen.value = true;
  await rulesOptionsFetch();
};

const deleteRule = (rule) => {
  deleteModal.value = true;

  rulesform.value.id = rule.id;
};

const fetchStudents = async () => {
  try {
    studentFetching.value = true;
    const response = await api(`/api/students?active_only=true`);

    if (response?.success) {
      students.value = response?.Students.map((item) => ({
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

const handleAddStudent = () => {
  addStudentModal.value = true;
  fetchStudents();
};

const studentColumns = [
  { accessorKey: "first_yiddish_name", header: "First Yiddish Name" },
  { accessorKey: "last_yiddish_name", header: "Last Yiddish Name" },
  {
    header: "Quick Actions",
    cell: ({ row }) =>
      h("div", { class: "flex gap-2 items-center" }, [
        // Edit Student Button
        h(
          resolveComponent("UTooltip"),
          { text: "Process Student" },
          {
            default: () =>
              h(resolveComponent("UButton"), {
                icon: "i-lucide-play-circle",
                size: "md",
                color: "success",
                variant: "soft",
                onClick: () => handleProcessStudent(row.original),
              }),
          }
        ),

        // Edit Student Button
        h(
          resolveComponent("UTooltip"),
          { text: "Remove Student" },
          {
            default: () =>
              h(resolveComponent("UButton"), {
                icon: "i-lucide-trash-2",
                size: "md",
                color: "error",
                variant: "soft",
                loading:
                  isStudentDeleting.value &&
                  selectedStudent.value === row.original.id,
                disabled: isStudentDeleting.value,
                onClick: () => handleRemoveStudent(row.original),
              }),
          }
        ),
      ]),
  },
];

const handleProcessStudent = async (student) => {
  try {
    // isStudentDeleting.value = true;
    const response = await api(
      `/api/payroll/group/${groupId}/students/${student.id}/process`,
      {
        method: "POST",
      }
    );

    if (response?.success) {
      toast.add({
        title: "Success",
        description:
          response?.message || "Student removed from group successfully",
        color: "success",
        duration: 2000,
      });

      await fetchGroupStudents(true);
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
  } finally {
    // isStudentDeleting.value = false;
  }
};

const handleRemoveStudent = async (student) => {
  try {
    isStudentDeleting.value = true;
    const response = await api(
      `/api/payroll/group/${groupId}/students/${student.id}/remove`,
      {
        method: "POST",
      }
    );

    if (response?.success) {
      toast.add({
        title: "Success",
        description:
          response?.message || "Student removed from group successfully",
        color: "success",
        duration: 2000,
      });

      await fetchGroupStudents(true);
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
  } finally {
    isStudentDeleting.value = false;
  }
};
onMounted(async () => {
  loading.value = true;
  // fetchingRules.value = true;
  await fetchGroupDetail();
  loading.value = false;
  await fetchRules(false);
  // fetchingRules.value = false;
});

// watch for datepicker changes
watch(
  () => calendarRange.value,
  async (val) => {
    if (!val?.start || !val?.end) return;

    // close popover
    open.value = false;

    // call API
    await fetchProcessRules({
      from_date: val.start.toString(),
      till_date: val.end.toString(),
    });
  },
  { deep: true }
);
// watch for Create Check Datepicker changes
watch(
  () => checkscalendarRange.value,
  async (val) => {
    if (!val?.start || !val?.end) return;

    // close popover
    checksDatePicker.value = false;

    // call API
    await fetchProcessChecks({
      from_date: val.start.toString(),
      till_date: val.end.toString(),
    });
  },
  { deep: true }
);
// watch for Process Deposit Datepicker changes
watch(
  () => depositcalendarRange.value,
  async (val) => {
    if (!val?.start || !val?.end) return;

    // close popover
    depositDatePicker.value = false;

    // call API
    await fetchProcessDeposit({
      from_date: val.start.toString(),
      till_date: val.end.toString(),
    });
  },
  { deep: true }
);
// watch for tab changes
watch(activeTab, (newTab) => {
  if (newTab === "0") {
    fetchRules(true);
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
      to="/payroll"
      icon="i-lucide-arrow-left"
    >
      Back to Payroll List
    </UButton>

    <div v-if="loading" class="flex items-center justify-center pt-10 w-full">
      <BaseSpinner :show-loader="loading" size="md" />
    </div>

    <div v-else>
      <UCard class="rounded-2xl shadow-sm mt-6">
        <div class="flex flex-col gap-6">
          <!-- Header -->
          <div
            class="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
          >
            <!-- Group Info -->
            <div class="space-y-1">
              <h2 class="text-xl font-semibold">
                {{ fetchingGroupDetails?.name }}
              </h2>
              <p class="font-medium text-sm">
                Group Amount:
                <span class="font-normal">
                  {{ fetchingGroupDetails?.amount }}
                </span>
              </p>
              <p class="text-sm font-medium">
                Min Amount:
                <span class="font-normal">
                  {{ fetchingGroupDetails?.min_amount }}
                </span>
              </p>
            </div>

            <!-- Actions -->
            <div class="flex flex-wrap gap-2 justify-end">
              <!-- TAB 0 ACTIONS -->
              <template v-if="activeTab === '0'">
                <UButton
                  icon="i-lucide-settings"
                  label="Processing Rules"
                  variant="solid"
                  color="primary"
                  @click="isModalOpen"
                />
                <UButton
                  icon="i-lucide-plus"
                  label="Create Rule"
                  variant="solid"
                  color="primary"
                  @click="ismodalOpen"
                />
                <UButton
                  icon="i-lucide-check-square"
                  label="Process Checks"
                  variant="solid"
                  color="primary"
                  @click="isChecksModalOpen"
                />
                <UButton
                  icon="i-lucide-wallet"
                  label="Process Deposit"
                  variant="solid"
                  color="primary"
                  disabled
                  @click="isDepositModalOpen"
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
        <div v-if="rules?.length > 0">
          <div
            class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6"
          >
            <UCard
              v-for="rule in rules"
              :key="rule.id"
              class="rounded-2xl shadow hover:shadow-xl transition-shadow duration-300"
            >
              <div>
                <label>
                  If {{ metricLabels[rule.metric] }} is
                  {{ operaterLabels[rule.operator] }} {{ rule.value }},
                  {{ rule.is_deduction ? "Deduction" : "Bonus" }} is
                  {{ rule.amount_type }}
                  {{ rule.amount }}
                  {{ rule.amount_type === "fixed" ? "dollars" : "percent" }},
                  {{ rule.apply_once ? "once" : "each time" }}
                </label>
              </div>
              <div
                class="flex justify-between items-baseline text-end gap-6 text-gray-500"
              >
                <p class="text-xs mt-2">
                  {{ rule.description }}
                </p>
                <div class="flex gap-2 items-center">
                  <UButton
                    icon="i-lucide-square-pen"
                    size="md"
                    color="success"
                    variant="soft"
                    @click="editRules(rule)"
                  />

                  <UButton
                    icon="i-lucide-trash-2"
                    size="md"
                    color="error"
                    variant="soft"
                    @click="deleteRule(rule)"
                  />
                </div>
              </div>
            </UCard>
          </div>
        </div>
        <div v-else class="text-center text-gray-500 mt-10">
          No Rules found. Please add some rules.
        </div>
      </div>
    </div>
  </template>
  <template v-if="activeTab === '1'">
    <!-- Students Table -->
    <UCard>
      <UTable
        :columns="studentColumns"
        :loading="fetchingGroupStudents"
        :data="groupStudents"
        class="flex-1 mt-6"
      />
    </UCard>
  </template>

  <UModal v-model:open="rulesModalOpen">
    <!-- Custom Header -->
    <template #header>
      <div class="flex justify-between w-full">
        <h2 class="text-xl font-bold text-primary">
          {{ rulesform.id ? "Edit Rules" : " Create New Rules" }}
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
        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Metric" name="metric">
            <USelect
              v-model="rulesState.metric"
              :items="metricOptions"
              placeholder="Please Select"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Operator" name="operator">
            <USelect
              v-model="rulesState.operator"
              :items="operatorOptions"
              placeholder="Please Select"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Value" name="value">
            <UInput
              v-model="rulesState.value"
              placeholder="Enter your value"
              class="w-full"
              type="number"
            />
          </UFormField>
          <UFormField label="Second Operator" name="second_operator">
            <USelect
              v-model="rulesState.second_operator"
              :items="operatorOptions"
              placeholder="Please Select"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Second Value" name="second_value">
            <UInput
              v-model="rulesState.second_value"
              placeholder="Enter second value"
              class="w-full"
              type="number"
            />
          </UFormField>
          <UFormField label="Session Number" name="session">
            <UInput
              v-model="rulesState.session"
              placeholder="Enter session number"
              class="w-full"
              type="number"
            />
          </UFormField>
          <UFormField label="Is Deduction" name="is_deduction">
            <USelect
              v-model="rulesState.is_deduction"
              :items="deductionItems"
              placeholder="Please Select"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Amount Type" name="amount_type">
            <USelect
              v-model="rulesState.amount_type"
              :items="amountTypeItems"
              placeholder="Please Select"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Amount" name="amount">
            <UInput
              v-model="rulesState.amount"
              placeholder="Enter your amount"
              class="w-full"
              type="number"
            />
          </UFormField>
          <UFormField label="Apply Rules" name="apply_once">
            <URadioGroup
              v-model="rulesState.apply_once"
              :items="applyOnceItems"
            />
          </UFormField>
          <UFormField label="Description" name="description">
            <UInput
              v-model="rulesState.description"
              placeholder="Please enter description"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Reference" name="reference_id">
            <UInput
              v-model.number="rulesState.reference_id"
              placeholder="Enter your reference id"
              class="w-full"
              type="number"
            />
          </UFormField>
        </div>
        <div class="mt-8 flex gap-2 justify-end">
          <UButton
            @click="rulesModalOpen = false"
            color="neutral"
            class="justify-center"
          >
            Cancel
          </UButton>
          <UButton
            type="submit"
            :loading="isSubmitting"
            :disabled="isSubmitting"
            class="justify-center"
          >
            {{ rulesform.id ? "Update" : "Submit" }}
          </UButton>
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
        <p>
          Are you sure you want to delete
          <!-- <span v-if="rulesform?.name" class="font-bold">
            {{ rulesform?.name }}
          </span> -->
          these Rules?
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
          @click="confirmDeleteRules()"
        >
          Delete
        </UButton>
      </div>
    </template>
  </UModal>

  <!-- Modal for Processing Rules -->
  <UModal v-model:open="showModal" fullscreen>
    <template #header>
      <div class="flex justify-between w-full">
        <h2 class="text-xl font-bold text-primary">Processing Rules</h2>

        <!-- Close Button -->
        <UButton
          size="sm"
          variant="outline"
          color="primary"
          class="rounded-full p-2"
          icon="i-lucide-x"
          @click="
            () => {
              showModal = false;
            }
          "
        >
        </UButton>
      </div>
    </template>
    <template #body>
      <UFormField label="Select Date Range" class="text-lg font-bold mb-4">
        <UPopover v-model:open="open">
          <UButton
            color="neutral"
            variant="subtle"
            icon="i-lucide-calendar"
            size="lg"
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
      </UFormField>
      <div
        v-if="processRulesLoading"
        class="flex items-center justify-center pt-10 w-full"
      >
        <BaseSpinner
          :show-loader="processRulesLoading"
          size="md"
          class="my-10 mx-auto"
        />
      </div>
      <div
        v-else-if="processRules?.length"
        class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 mt-6"
      >
        <UCard
          v-for="processRule in processRules"
          :key="processRule.name"
          class="rounded-2xl shadow hover:shadow-xl transition-shadow duration-300"
        >
          <div>
            <h1>Name: {{ processRule.name }}</h1>
            <p>Base Price: {{ processRule.base_price }}</p>
            <p>Net Value: {{ processRule.net_value }}</p>
          </div>

          <span>Rules:</span>
          <ul class="space-y-1">
            <li
              v-for="(ruleItem, index) in processRule.rules"
              :key="index"
              class="text-sm flex justify-between border-l-4 pl-2 py-1 border-gray-200 hover:border-indigo-500 transition-colors"
            >
              <div>
                <label>
                  If {{ metricLabels[ruleItem.rule.metric] }} is
                  {{ operaterLabels[ruleItem.rule.operator] }}
                  {{ ruleItem.rule.value }},
                  {{ ruleItem.rule.is_deduction ? "Deduction" : "Bonus" }} is
                  {{ ruleItem.rule.amount_type }}
                  {{ ruleItem.rule.amount }}
                  {{
                    ruleItem.rule.amount_type === "fixed"
                      ? "dollars"
                      : "percent"
                  }},
                  {{ ruleItem.rule.apply_once ? "once" : "each time" }}
                </label>
              </div>

              <!-- <span class="truncate">{{ ruleItem.rule.description }}</span>
              <span
                :class="
                  ruleItem.applies.sign === '+'
                    ? 'text-green-500'
                    : 'text-red-500'
                "
                class="font-semibold"
              >
                {{ ruleItem.applies.sign }}
                {{
                  ruleItem.applies.percent
                    ? ruleItem.applies.net_value + "%"
                    : "$" + ruleItem.applies.net_value
                }}
              </span> -->
            </li>
          </ul>
        </UCard>
      </div>
      <div v-else class="text-center text-gray-500 mt-10">
        No Rules found. Please add some rules.
      </div>
    </template>
  </UModal>

  <!-- Modal for Process Deposit Rules -->
  <UModal v-model:open="processChecksModal" fullscreen>
    <template #header>
      <div class="flex justify-between w-full">
        <h2 class="text-xl font-bold text-primary">Create Checks</h2>

        <!-- Close Button -->
        <UButton
          size="sm"
          variant="outline"
          color="primary"
          class="rounded-full p-2"
          icon="i-lucide-x"
          @click="
            () => {
              processChecksModal = false;
            }
          "
        >
        </UButton>
      </div>
    </template>
    <template #body>
      <UFormField label="Select Date Range" class="text-lg font-bold mb-4">
        <UPopover v-model:open="checksDatePicker">
          <UButton
            color="neutral"
            variant="subtle"
            icon="i-lucide-calendar"
            size="lg"
          >
            <template v-if="checkscalendarRange.start">
              <template v-if="checkscalendarRange.end">
                {{
                  df.format(
                    checkscalendarRange.start.toDate(getLocalTimeZone())
                  )
                }}
                -
                {{
                  df.format(checkscalendarRange.end.toDate(getLocalTimeZone()))
                }}
              </template>
              <template v-else>
                {{
                  df.format(
                    checkscalendarRange.start.toDate(getLocalTimeZone())
                  )
                }}
              </template>
            </template>
            <template v-else> Pick a date </template>
          </UButton>

          <template #content>
            <UCalendar
              v-model="checkscalendarRange"
              range
              :number-of-months="2"
              class="p-2"
            />
          </template>
        </UPopover>
      </UFormField>
      <div
        v-if="processChecksLoading"
        class="flex items-center justify-center pt-10 w-full"
      >
        <BaseSpinner
          :show-loader="processChecksLoading"
          size="md"
          class="my-10 mx-auto"
        />
      </div>
      <div
        v-else-if="processCheckMessage"
        class="text-center text-gray-500 mt-10"
      >
        {{ processCheckMessage }}
      </div>
      <div
        v-else
        class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 mt-6"
      >
        No Checks found. Please add some Checks.
      </div>
    </template>
  </UModal>
  <!-- Modal for Create Rules -->
  <UModal v-model:open="processDepositModal" fullscreen>
    <template #header>
      <div class="flex justify-between w-full">
        <h2 class="text-xl font-bold text-primary">Process Deposit</h2>

        <!-- Close Button -->
        <UButton
          size="sm"
          variant="outline"
          color="primary"
          class="rounded-full p-2"
          icon="i-lucide-x"
          @click="
            () => {
              processDepositModal = false;
            }
          "
        >
        </UButton>
      </div>
    </template>
    <template #body>
      <UFormField label="Select Date Range" class="text-lg font-bold mb-4">
        <UPopover v-model:open="depositDatePicker">
          <UButton
            color="neutral"
            variant="subtle"
            icon="i-lucide-calendar"
            size="lg"
          >
            <template v-if="depositcalendarRange.start">
              <template v-if="depositcalendarRange.end">
                {{
                  df.format(
                    depositcalendarRange.start.toDate(getLocalTimeZone())
                  )
                }}
                -
                {{
                  df.format(depositcalendarRange.end.toDate(getLocalTimeZone()))
                }}
              </template>
              <template v-else>
                {{
                  df.format(
                    depositcalendarRange.start.toDate(getLocalTimeZone())
                  )
                }}
              </template>
            </template>
            <template v-else> Pick a date </template>
          </UButton>

          <template #content>
            <UCalendar
              v-model="depositDatePicker"
              range
              :number-of-months="2"
              class="p-2"
            />
          </template>
        </UPopover>
      </UFormField>
      <div
        v-if="processDepositLoading"
        class="flex items-center justify-center pt-10 w-full"
      >
        <BaseSpinner
          :show-loader="processDepositLoading"
          size="md"
          class="my-10 mx-auto"
        />
      </div>
      <div
        v-else-if="processDespositMessage"
        class="text-center text-gray-500 mt-10"
      >
        {{ processDespositMessage }}
      </div>
      <div
        v-else
        class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 mt-6"
      >
        No Checks found. Please add some Checks.
      </div>
    </template>
  </UModal>

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
              :items="students"
              placeholder="Please Select"
              class="w-full"
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
          >
            Cancel
          </UButton>
          <UButton
            type="submit"
            :loading="isStudentSubmiting"
            :disabled="isStudentSubmiting"
            class="justify-center"
          >
            Submit
          </UButton>
        </div>
      </UForm>
    </template>
  </UModal>
</template>

<script setup>
import { today, getLocalTimeZone } from "@internationalized/date";
import { object, string, number } from "yup";

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

// Student states
const groupStudents = ref([]);
const addStudentModal = ref(false);
const isStudentSubmiting = ref(false);
const students = ref([]);
const studentFetching = ref(false);

const items = computed(() => [
  {
    label: "Rules",
    key: "rules",
  },
  {
    label: "Students",
    key: "students",
  },
]);

const isProcessModalOpen = async () => {
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
      processRules.value = Array.isArray(response?.data)
        ? response.data
        : Object.values(response?.data || {});

      // processRules.value = Object.values(response?.data || {});
    }
  } catch (err) {
    console.log("🚀 ~ fetchProcessRules ~ err:", err);
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
  } finally {
    processDepositLoading.value = false;
  }
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
      },
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

const isCreateRuleModalOpen = async () => {
  rulesModalOpen.value = true;
  await rulesOptionsFetch();
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
  } finally {
    fetchingGroupStudents.value = false;
  }
};

const handleAddStudent = () => {
  addStudentModal.value = true;
  fetchStudents();
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

const studentState = reactive({
  student_ids: [],
});

const onAddStudentSubmit = async (event) => {
  isStudentSubmiting.value = true;
  try {
    const payload = {
      student_ids: event.data.student_ids.map((item) => item.value),
    };

    // return;
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

onMounted(async () => {
  loading.value = true;
  // fetchingRules.value = true;
  await fetchGroupDetail();
  loading.value = false;
  await fetchRules(false);
  // fetchingRules.value = false;
});

const onDateChange = async (val) => {
  if (!val?.start || !val?.end) return;

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
  }

  await fetchProcessDeposit({
    ...val,
  });
};

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
                  ${{ fetchingGroupDetails?.amount }}
                </span>
              </p>
              <p class="text-sm font-medium">
                Min Amount:
                <span class="font-normal">
                  ${{ fetchingGroupDetails?.min_amount }}
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
                  @click="isProcessModalOpen"
                />
                <UButton
                  icon="i-lucide-plus"
                  label="Create Rule"
                  variant="solid"
                  color="primary"
                  @click="isCreateRuleModalOpen"
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
    <!-- Students Tab -->
    <PayrollStudents
      :students="groupStudents"
      :fetchingGroupStudents="fetchingGroupStudents"
      :metric-labels="metricLabels"
      :operater-labels="operaterLabels"
      @refresh="fetchGroupStudents"
    />
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
              size="lg"
            />
          </UFormField>
          <UFormField label="Operator" name="operator">
            <USelect
              v-model="rulesState.operator"
              :items="operatorOptions"
              placeholder="Please Select"
              class="w-full"
              size="lg"
            />
          </UFormField>
          <UFormField label="Value" name="value">
            <UInput
              v-model="rulesState.value"
              placeholder="Enter your value"
              class="w-full"
              type="number"
              size="lg"
            />
          </UFormField>
          <UFormField label="Second Operator" name="second_operator">
            <USelect
              v-model="rulesState.second_operator"
              :items="operatorOptions"
              placeholder="Please Select"
              class="w-full"
              size="lg"
            />
          </UFormField>
          <UFormField label="Second Value" name="second_value">
            <UInput
              v-model="rulesState.second_value"
              placeholder="Enter second value"
              class="w-full"
              type="number"
              size="lg"
            />
          </UFormField>
          <UFormField label="Session Number" name="session">
            <UInput
              v-model="rulesState.session"
              placeholder="Enter session number"
              class="w-full"
              type="number"
              size="lg"
            />
          </UFormField>
          <UFormField label="Is Deduction" name="is_deduction">
            <USelect
              v-model="rulesState.is_deduction"
              :items="deductionItems"
              placeholder="Please Select"
              class="w-full"
              size="lg"
            />
          </UFormField>
          <UFormField label="Amount Type" name="amount_type">
            <USelect
              v-model="rulesState.amount_type"
              :items="amountTypeItems"
              placeholder="Please Select"
              class="w-full"
              size="lg"
            />
          </UFormField>
          <UFormField label="Amount" name="amount">
            <UInput
              v-model="rulesState.amount"
              placeholder="Enter your amount"
              class="w-full"
              type="number"
              size="lg"
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
              size="lg"
            />
          </UFormField>
          <UFormField label="Reference" name="reference_id">
            <UInput
              v-model.number="rulesState.reference_id"
              placeholder="Enter your reference id"
              class="w-full"
              type="number"
              size="lg"
            />
          </UFormField>
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
  <CommonChecksDepositModal
    v-model="processChecksModal"
    title="Process Checks"
    :loading="processChecksLoading"
    type="check"
    @submit="onCheckFormSubmit"
  />

  <!-- Modal for Deposit Checks -->
  <CommonChecksDepositModal
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
              :items="students"
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
            :loading="isStudentSubmiting"
            :disabled="isStudentSubmiting"
            class="justify-center"
            label="Submit"
          />
        </div>
      </UForm>
    </template>
  </UModal>
</template>

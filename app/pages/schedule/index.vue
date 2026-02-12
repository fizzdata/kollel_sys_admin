<script setup>
import { convertTo24Hour } from "~/common/common";

definePageMeta({
  layout: "sidebar",
  middleware: ["auth"],
});

// Tabs
const activeTab = ref("0");

const tabs = [
  { label: "Schedule Calendar", key: "schedule-calendar" },
  { label: "Schedule Questions", key: "schedule-questions" },
];

// Schedule Management
const editScheduleModal = ref(false);
const schedules = ref([]);
const loading = ref(false);
const api = useApi();
const date_from = ref(fromMonth());
const date_to = ref(nextMonth());
const isSubmitting = ref(false);
const toast = useToast();

const state = reactive({
  id: null,
  start: undefined,
  end: undefined,
});

// Schedule Questions
const scheduleQuestions = ref([]);
const questionsLoading = ref(false);
const createQuestionModal = ref(false);
const assignQuestionModal = ref(false);
const selectedQuestion = ref(null);
const isSubmittingQuestion = ref(false);
const isSubmittingAssignment = ref(false);
const isDeletingScheduleQuestion = ref(false);
const deleteSchdeduleQuestionModal = ref(false);
const fetchingQuestionDetails = ref(false);
const selectedQuestionID = ref(null);

const questionState = reactive({
  id: null,
  question: "",
  ask_on_in: false,
  ask_on_out: false,
  is_active: true,
  ask_every_time: false,
  require_yes_to_proceed: false,
  button_text_1: "",
  button_text_2: "",
  button_text_3: "",
  ask_only: "",
});

const assignmentState = reactive({
  scheduleId: null,
  questionId: null,
  assignTo: "q_in", // 'q_in', 'q_out', or 'both'
});

async function fetchSchedules() {
  loading.value = true;

  try {
    const response = await api(
      `/api/schedules?date_from=${date_from.value}&date_to=${date_to.value}`,
    );

    if (response?.success) {
      schedules.value = response?.schedules || [];
    }
  } catch (err) {
    console.log("🚀 ~ fetchStudents ~ err:", err);
    toast.add({
      description: "Error fetching schedules. Please try again later.",
      color: "error",
      timeout: 3000,
    });
  } finally {
    loading.value = false;
  }
}

function nextMonth() {
  const today = new Date();
  today.setDate(today.getDate() + 30);
  return today.toISOString().slice(0, 10);
}

function fromMonth() {
  const today = new Date();
  today.setDate(today.getDate() - 30);
  return today.toISOString().slice(0, 10);
}

function handleYearMonth({ from, to }) {
  date_from.value = from;
  date_to.value = to;
  fetchSchedules();
}

function displayModel(payload) {
  editScheduleModal.value = true;
  state.id = payload.id;
  state.start = convertTo24Hour(payload.start);
  state.end = convertTo24Hour(payload.end);
}

const resetEditSchedule = () => {
  state.start = undefined;
  state.end = undefined;
};

// Schedule Questions Functions
async function fetchScheduleQuestions() {
  questionsLoading.value = true;
  try {
    const response = await api("/api/schedules/questions", {
      method: "GET",
    });

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
  } finally {
    questionsLoading.value = false;
  }
}

function resetQuestionForm() {
  questionState.id = null;
  questionState.question = "";
  questionState.ask_on_in = false;
  questionState.ask_on_out = false;
  questionState.is_active = true;
  questionState.ask_every_time = false;
  questionState.require_yes_to_proceed = false;
  questionState.button_text_1 = "";
  questionState.button_text_2 = "";
  questionState.button_text_3 = "";
  questionState.ask_only = "";
}

function openCreateQuestionModal() {
  resetQuestionForm();
  createQuestionModal.value = true;
}

async function handleQuestionSubmit(event) {
  if (!questionState.question.trim()) {
    toast.add({
      title: "Validation Error",
      description: "Question text is required",
      color: "error",
    });
    return;
  }

  const url = selectedQuestionID.value
    ? `/api/schedules/questions/${selectedQuestionID.value}`
    : "/api/schedules/questions";

  const method = selectedQuestionID.value ? "PUT" : "POST";

  let payload = null;

  if (selectedQuestionID.value) {
    payload = {
      id: selectedQuestionID.value,
      ...event.data,
    };
  } else {
    payload = {
      ...event.data,
    };
    delete payload.id; // Ensure ID is not sent for creation
  }

  isSubmittingQuestion.value = true;
  try {
    const response = await api(url, {
      method: method,
      body: payload,
    });

    if (response?.success) {
      toast.add({
        title: "Success",
        description:
          response?.message || selectedQuestionID.value
            ? "Question updated successfully"
            : "Question created successfully",
        color: "success",
        duration: 2000,
      });
      createQuestionModal.value = false;
      selectedQuestionID.value = null;
      resetQuestionForm();
      await fetchScheduleQuestions();
    } else {
      toast.add({
        title: "Failed",
        description:
          response?.message ||
          response?._data?.message ||
          "Failed to create question",
        color: "error",
      });
    }
  } catch (error) {
    console.error("Error creating question:", error);
    toast.add({
      title: "Error",
      description: "An unexpected error occurred",
      color: "error",
    });
  } finally {
    isSubmittingQuestion.value = false;
    selectedQuestion.value = null;
  }
}

function openAssignQuestionModal(question) {
  selectedQuestion.value = question;
  assignmentState.scheduleId = null;
  assignmentState.questionId = question.id;
  assignmentState.assignTo = "q_in";

  // Ensure schedules are available
  if (!schedules.value || schedules.value.length === 0) {
    fetchSchedules();
  }

  assignQuestionModal.value = true;
}

// Computed property for schedule options
const scheduleOptions = computed(() => {
  if (!schedules.value || !Array.isArray(schedules.value)) {
    return [];
  }

  return schedules.value.map((schedule) => ({
    label: `${schedule.start} - ${schedule.end} ${schedule.title ? "(" + schedule.title + ")" : ""}`,
    value: schedule.id,
  }));
});

async function submitAssignment() {
  if (!assignmentState.scheduleId) {
    toast.add({
      title: "Validation Error",
      description: "Please select a schedule",
      color: "error",
    });
    return;
  }

  isSubmittingAssignment.value = true;
  try {
    const assignmentData = {
      scheduleId: assignmentState.scheduleId,
      questionId: assignmentState.questionId,
      assignTo: assignmentState.assignTo,
    };

    const response = await api("/api/schedule-question-assignments", {
      method: "POST",
      body: assignmentData,
    });

    if (response?.success) {
      const assignToText =
        assignmentState.assignTo === "both"
          ? "check-in and check-out"
          : assignmentState.assignTo === "q_in"
            ? "check-in"
            : "check-out";

      toast.add({
        title: "Success",
        description: `Question assigned to schedule for ${assignToText} successfully`,
        color: "success",
        duration: 2000,
      });
      assignQuestionModal.value = false;
      await fetchSchedules(); // Refresh schedules to see updates
    } else {
      toast.add({
        title: "Failed",
        description:
          response?.message ||
          response?._data?.message ||
          "Failed to assign question",
        color: "error",
      });
    }
  } catch (error) {
    console.error("Error assigning question:", error);
    toast.add({
      title: "Error",
      description: "An unexpected error occurred",
      color: "error",
    });
  } finally {
    isSubmittingAssignment.value = false;
  }
}

const editQuestion = async (question) => {
  selectedQuestionID.value = question?.id;

  try {
    fetchingQuestionDetails.value = true;
    const response = await api(`/api/schedules/questions/${question.id}`, {
      method: "GET",
    });

    if (response?.success) {
      const q = response?.question;

      questionState.id = q?.id || null;
      questionState.question = q?.question || "";
      questionState.ask_on_in = q?.ask_on_in === 1 ? true : false;
      questionState.ask_on_out = q?.ask_on_out === 1 ? true : false;
      questionState.is_active = q?.is_active === 1 ? true : false;
      questionState.ask_every_time = q?.ask_every_time === 1 ? true : false;
      questionState.require_yes_to_proceed =
        q?.require_yes_to_proceed === 1 ? true : false;
      questionState.button_text_1 = q?.button_text_1 || "";
      questionState.button_text_2 = q?.button_text_2 || "";
      questionState.button_text_3 = q?.button_text_3 || "";
      questionState.ask_only = q?.ask_only || "";

      createQuestionModal.value = true;
    }
  } catch (err) {
    console.log("Error fetching questions:", err);
    toast.add({
      title: "Error",
      description: "Failed to load schedule questions",
      color: "error",
    });
  } finally {
    fetchingQuestionDetails.value = false;
  }
};

function deleteQuestion(question) {
  selectedQuestion.value = question;
  deleteSchdeduleQuestionModal.value = true;
}

const confirmDeleteScheduleQuestion = async () => {
  try {
    isDeletingScheduleQuestion.value = true;

    const response = await api(
      `/api/schedules/questions/${selectedQuestion.value.id}`,
      {
        method: "DELETE",
      },
    );

    if (response?.success) {
      toast.add({
        title: "Success",
        description: response?.message || "Question Deleted",
        color: "success",
        duration: 2000,
      });
      deleteSchdeduleQuestionModal.value = false; // Close the modal
      await fetchScheduleQuestions(true);

      selectedQuestion.value = null;
    } else {
      toast.add({
        title: "Failed",
        description:
          response?.message ||
          response?._data.errors ||
          response?._data.message ||
          "Failed to delete Question",
        color: "error",
        duration: 2000,
      });
    }
  } catch (error) {
    console.error("Error deleting Rules:", error);
    toast.add({
      description: "Error deleting schedule question. Please try again later.",
      color: "error",
      timeout: 3000,
    });
  } finally {
    isDeletingScheduleQuestion.value = false;
  }
};

const onSubmit = async (event) => {
  isSubmitting.value = true;
  try {
    const response = await api(`/api/schedules/update/${state.id}`, {
      method: "PUT",
      body: {
        start: event.data.start,
        end: event.data.end,
      },
    });

    if (response?.success) {
      toast.add({
        title: "Success",
        description: response?.message
          ? response?.message
          : state.id
            ? "Schedule updated successfully"
            : "Schedule created successfully",
        color: "success",
        duration: 2000,
      });
      state.id = null;
      editScheduleModal.value = false;
      await fetchSchedules();
    } else {
      toast.add({
        title: "Failed",
        description:
          response?.message ||
          response._data.message ||
          "Something went wrong. Please try again.",
        color: "error",
      });
    }
  } catch (error) {
    console.error("Submission error:", error);
    toast.add({
      title: "Error",
      description: "An unexpected error occurred. Please try again later.",
      color: "error",
    });
  } finally {
    isSubmitting.value = false;
    resetEditSchedule();
  }
};

const scheduleColumns = [
  {
    accessorKey: "question",
    header: "Question",
  },

  {
    header: "Quick Actions",
    cell: ({ row }) =>
      h("div", { class: "flex gap-2 items-center" }, [
        // Assign Question Button
        h(
          resolveComponent("UTooltip"),
          { text: "Assign Question" },
          {
            default: () =>
              h(resolveComponent("UButton"), {
                icon: "i-lucide-link",
                size: "md",
                color: "primary",
                variant: "soft",
                onClick: () => openAssignQuestionModal(row.original),
              }),
          },
        ),
        // Edit Schedule Button
        h(
          resolveComponent("UTooltip"),
          { text: "Edit Schedule" },
          {
            default: () =>
              h(resolveComponent("UButton"), {
                icon: "i-lucide-square-pen",
                size: "md",
                color: "success",
                variant: "soft",
                disabled: selectedQuestionID?.value === row.original.id,
                loading: selectedQuestionID?.value === row.original.id,
                onClick: () => editQuestion(row.original),
              }),
          },
        ),
        // Delete Schedule Button
        h(
          resolveComponent("UTooltip"),
          { text: "Delete Schedule" },
          {
            default: () =>
              h(resolveComponent("UButton"), {
                icon: "i-lucide-trash-2",
                size: "md",
                color: "error",
                variant: "soft",
                onClick: () => deleteQuestion(row.original),
              }),
          },
        ),
      ]),
  },
];

// watch for tab changes
watch(
  activeTab,
  (newTab) => {
    if (newTab === "0") {
      fetchSchedules();
    } else if (newTab === "1") {
      fetchScheduleQuestions();
    }
  },
  { immediate: true },
);
</script>

<template>
  <div>
    <!-- Header Card -->
    <UCard class="rounded-2xl shadow-sm mb-4">
      <div
        class="flex flex-col md:flex-row justify-between md:items-center gap-4 md:mb-0"
      >
        <h2 class="text-xl font-bold">Schedules</h2>
        <div class="flex justify-end gap-2">
          <UButton
            v-if="activeTab === '0'"
            to="/schedule/populate"
            trailingIcon="i-lucide-arrow-right"
            label=" Populate default schedule"
          />

          <UButton
            v-if="activeTab === '1'"
            @click="openCreateQuestionModal"
            icon="i-lucide-plus"
            label="Create Question"
            color="primary"
          />
        </div>
      </div>
    </UCard>

    <div class="mb-4">
      <!-- Tabs -->
      <UTabs v-model="activeTab" :items="tabs" variant="link" class="my-4" />
      <!-- Tab 1: Schedule Calendar -->
      <div v-if="activeTab === '0'">
        <ScheduleCalender
          :schedules="schedules"
          @edit_clicked="displayModel"
          @reload="fetchSchedules"
          @year_month="handleYearMonth"
        />
      </div>

      <!-- Tab 2: Schedule Questions -->
      <div v-if="activeTab === '1'" class="space-y-4">
        <!-- Questions Table -->
        <UTable
          :data="scheduleQuestions"
          :columns="scheduleColumns"
          :loading="questionsLoading"
          class="w-full"
        >
          <template #empty>
            <div class="text-center text-sm text-gray-500 py-6">
              <div v-if="questionsLoading">Fetching Schedule Questions</div>
              <div v-else>
                No questions created yet.
                <br />
                Click <strong class="text-primary">Create Question</strong> to
                add one.
              </div>
            </div>
          </template>
        </UTable>
      </div>
    </div>

    <div v-if="loading" class="fixed inset-0 z-50 bg-black/10">
      <div class="flex justify-center items-center h-full text-center inset-0">
        <BaseSpinner :show-loader="loading" />
      </div>
    </div>
  </div>
  <!-- Modal for Edit Schedule -->
  <UModal v-model:open="editScheduleModal">
    <!-- Custom Header -->
    <template #header>
      <div class="flex justify-between w-full">
        <h2 class="text-xl font-bold text-primary">Edit Schedule</h2>

        <!-- Close Button -->
        <UButton
          size="sm"
          variant="outline"
          color="primary"
          class="rounded-full p-2"
          icon="i-lucide-x"
          @click="
            () => {
              editScheduleModal = false;
              resetEditSchedule();
            }
          "
        />
      </div>
    </template>

    <template #body>
      <UForm :state="state" class="space-y-4" @submit="onSubmit">
        <div class="grid grid-cols-2 mb-6 gap-4">
          <UFormField label="Starts" name="start" required>
            <UInput
              v-model="state.start"
              type="time"
              size="lg"
              step="1"
              class="w-full"
              placeholder="Start time"
            />
          </UFormField>

          <UFormField label="Ends" name="end" required>
            <UInput
              v-model="state.end"
              type="time"
              placeholder="End time"
              size="lg"
              step="1"
              class="w-full"
            />
          </UFormField>
        </div>
        <div
          class="flex justify-end items-center gap-2 mt-4 border-t border-gray-200 pt-4"
        >
          <UButton
            color="neutral"
            variant="solid"
            label="Cancel"
            @click="
              () => {
                editScheduleModal = false;
                resetEditSchedule();
              }
            "
          />
          <UButton
            type="submit"
            :loading="isSubmitting"
            :disabled="isSubmitting"
            label="Update Schedule"
          />
        </div>
      </UForm>
    </template>
  </UModal>

  <!-- Modal for Create Question -->
  <UModal v-model:open="createQuestionModal">
    <template #header>
      <div class="flex justify-between w-full">
        <h2 class="text-xl font-bold text-primary">
          {{ questionState.id ? "Edit" : "Create" }} Question
        </h2>
        <UButton
          size="sm"
          variant="outline"
          color="primary"
          class="rounded-full p-2"
          icon="i-lucide-x"
          @click="createQuestionModal = false"
        />
      </div>
    </template>

    <template #body>
      <div
        v-if="fetchingQuestionDetails"
        class="flex items-center justify-center pt-10 w-full"
      >
        <BaseSpinner :show-loader="fetchingQuestionDetails" size="md" />
      </div>
      <UForm
        v-else
        :state="questionState"
        @submit="handleQuestionSubmit"
        class="space-y-4"
      >
        <!-- Question Text -->
        <UFormField label="Question Text" required>
          <UInput
            v-model="questionState.question"
            placeholder="Enter your question"
            type="text"
            class="w-full"
          />
        </UFormField>

        <!-- Ask On Checkin/Checkout -->
        <div class="space-y-2">
          <label class="block text-sm font-medium">When to Ask</label>
          <div class="flex gap-4">
            <UCheckbox
              v-model="questionState.ask_on_in"
              label="Ask on Check-In"
            />
            <UCheckbox
              v-model="questionState.ask_on_out"
              label="Ask on Check-Out"
            />
          </div>
        </div>

        <!-- Additional Options -->
        <div class="space-y-2">
          <UCheckbox v-model="questionState.is_active" label="Active" />
          <UCheckbox
            v-model="questionState.ask_every_time"
            label="Ask Every Time"
          />
          <UCheckbox
            v-model="questionState.require_yes_to_proceed"
            label="Require Yes to Proceed"
          />
        </div>

        <!-- Button Texts -->
        <div class="space-y-2">
          <label class="block text-sm font-medium">Button Labels</label>
          <div class="grid md:grid-cols-2 gap-4">
            <UInput
              v-model="questionState.button_text_1"
              placeholder="Button 1 text (optional)"
              type="text"
            />
            <UInput
              v-model="questionState.button_text_2"
              placeholder="Button 2 text (optional)"
              type="text"
            />
            <UInput
              v-model="questionState.button_text_3"
              placeholder="Button 3 text (optional)"
              type="text"
            />
          </div>
        </div>

        <!-- Ask Only -->
        <UFormField label="Ask Only (optional)">
          <UInput
            v-model="questionState.ask_only"
            placeholder="Specific user or condition"
            type="text"
          />
        </UFormField>

        <!-- Actions -->
        <div class="flex justify-end gap-2 border-t border-gray-200 pt-4">
          <UButton
            color="neutral"
            variant="solid"
            label="Cancel"
            @click="createQuestionModal = false"
          />
          <UButton
            type="submit"
            :loading="isSubmittingQuestion"
            :disabled="isSubmittingQuestion"
            :label="questionState.id ? 'Edit Question' : 'Create Question'"
          />
        </div>
      </UForm>
    </template>
  </UModal>

  <!-- Modal for Assign Question -->
  <UModal v-model:open="assignQuestionModal">
    <template #header>
      <div class="flex justify-between w-full">
        <h2 class="text-xl font-bold text-primary">
          Assign Question to Schedule
        </h2>
        <UButton
          size="sm"
          variant="outline"
          color="primary"
          class="rounded-full p-2"
          icon="i-lucide-x"
          @click="assignQuestionModal = false"
        />
      </div>
    </template>

    <template #body>
      <div class="space-y-4">
        <!-- Selected Question Display -->
        <div class="bg-gray-50 p-4 rounded-lg">
          <p class="text-sm text-gray-600">Selected Question:</p>
          <p class="font-semibold">{{ selectedQuestion?.question }}</p>
        </div>

        <!-- Schedule Selection -->
        <UFormField label="Select Schedule" required>
          <USelect
            v-model="assignmentState.scheduleId"
            :items="scheduleOptions"
            placeholder="Choose a schedule"
          />
        </UFormField>

        <!-- Assignment Type Selection -->
        <UFormField label="Assign Question For" required>
          <URadioGroup
            v-model="assignmentState.assignTo"
            :items="[
              { value: 'q_in', label: 'Check-In Only' },
              { value: 'q_out', label: 'Check-Out Only' },
              { value: 'both', label: 'Both Check-In and Check-Out' },
            ]"
          />
        </UFormField>

        <!-- Actions -->
        <div class="flex justify-end gap-2 border-t border-gray-200 pt-4">
          <UButton
            color="neutral"
            variant="solid"
            label="Cancel"
            @click="assignQuestionModal = false"
          />
          <UButton
            type="submit"
            :loading="isSubmittingAssignment"
            :disabled="isSubmittingAssignment"
            label="Assign Question"
            @click="submitAssignment"
          />
        </div>
      </div>
    </template>
  </UModal>

  <!-- Modal for schedule question  -->
  <UModal
    v-model:open="deleteSchdeduleQuestionModal"
    title="Confirm Delete Schedule Question"
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
          <strong v-if="selectedQuestion">{{
            selectedQuestion?.question
          }}</strong>
          schedule question?
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
              deleteSchdeduleQuestionModal = false;
            }
          "
        />

        <UButton
          color="error"
          variant="solid"
          class="mt-4"
          :loading="isDeletingScheduleQuestion"
          :disabled="isDeletingScheduleQuestion"
          @click="confirmDeleteScheduleQuestion()"
          label="Delete"
        />
      </div>
    </template>
  </UModal>
</template>

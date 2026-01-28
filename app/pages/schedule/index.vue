<script setup>
import { convertTo24Hour } from "~/common/common";
import { ref, reactive, onMounted } from "vue";

definePageMeta({
  layout: "sidebar",
  middleware: ["auth"],
});

// Tabs
const activeTab = ref(0);

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

const questionState = reactive({
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
    const response = await api("/api/schedules/questions");
    console.log("Questions API Response:", response);
    if (response?.success) {
      scheduleQuestions.value = response?.questions || [];
      console.log("Questions loaded:", scheduleQuestions.value);
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

async function submitQuestion() {
  if (!questionState.question.trim()) {
    toast.add({
      title: "Validation Error",
      description: "Question text is required",
      color: "error",
    });
    return;
  }

  if (!questionState.ask_on_in && !questionState.ask_on_out) {
    toast.add({
      title: "Validation Error",
      description: "Question must be asked on checkin or checkout",
      color: "error",
    });
    return;
  }

  isSubmittingQuestion.value = true;
  try {
    const response = await api("/api/schedules/questions", {
      method: "POST",
      body: {
        question: questionState.question,
        ask_on_in: questionState.ask_on_in,
        ask_on_out: questionState.ask_on_out,
        is_active: questionState.is_active,
        ask_every_time: questionState.ask_every_time,
        require_yes_to_proceed: questionState.require_yes_to_proceed,
        button_text_1: questionState.button_text_1 || null,
        button_text_2: questionState.button_text_2 || null,
        button_text_3: questionState.button_text_3 || null,
        ask_only: questionState.ask_only || null,
      },
    });

    if (response?.success) {
      toast.add({
        title: "Success",
        description: "Question created successfully",
        color: "success",
        duration: 2000,
      });
      createQuestionModal.value = false;
      resetQuestionForm();
      await fetchScheduleQuestions();
    } else {
      toast.add({
        title: "Failed",
        description: response?._data?.message || "Failed to create question",
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
  }
}

function openAssignQuestionModal(question) {
  selectedQuestion.value = question;
  assignmentState.scheduleId = null;
  assignmentState.questionId = question.id;
  assignQuestionModal.value = true;
}

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
    const response = await api("/api/schedule-question-assignments", {
      method: "POST",
      body: {
        scheduleId: assignmentState.scheduleId,
        questionId: assignmentState.questionId,
      },
    });

    if (response?.success) {
      toast.add({
        title: "Success",
        description: "Question assigned to schedule successfully",
        color: "success",
        duration: 2000,
      });
      assignQuestionModal.value = false;
      await fetchScheduleQuestions();
    } else {
      toast.add({
        title: "Failed",
        description:
          response?._data?.message || "Failed to assign question",
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

function deleteQuestion(questionId) {
  // TODO: Implement delete functionality
  console.log("Delete question:", questionId);
}

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
      await fetchSchedules();
    } else if (response?._data?.message) {
      toast.add({
        title: "Failed",
        description: response._data.message,
        color: "error",
      });
    } else {
      toast.add({
        title: "Failed",
        description:
          response?.message || "Something went wrong. Please try again.",
        color: "error",
      });
    }
  } catch (error) {
    console.error("Submission error:", error);
    toast.add({
      title: "Error",
      description: "An unexpected error occurred.",
      color: "error",
    });
  } finally {
    editScheduleModal.value = false;
    isSubmitting.value = false;
    resetEditSchedule();
  }
};

onMounted(async () => {
  await fetchSchedules();
  await fetchScheduleQuestions();
});
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
            to="/schedule/populate"
            trailingIcon="i-lucide-arrow-right"
            label=" Populate default schedule"
          />
        </div>
      </div>
    </UCard>

    <!-- Tabs -->
    <div class="mb-4">
      <div class="flex gap-2 border-b border-gray-200 mb-4">
        <button
          @click="activeTab = 0"
          :class="[
            'px-4 py-2 font-medium transition-colors',
            activeTab === 0
              ? 'text-primary border-b-2 border-primary'
              : 'text-gray-600 hover:text-gray-900'
          ]"
        >
          <i class="i-lucide-calendar mr-2"></i>Schedule Calendar
        </button>
        <button
          @click="activeTab = 1"
          :class="[
            'px-4 py-2 font-medium transition-colors',
            activeTab === 1
              ? 'text-primary border-b-2 border-primary'
              : 'text-gray-600 hover:text-gray-900'
          ]"
        >
          <i class="i-lucide-help-circle mr-2"></i>Schedule Questions
        </button>
      </div>

      <!-- Tab 1: Schedule Calendar -->
      <div v-show="activeTab === 0">
        <ScheduleCalender
          :schedules="schedules"
          @edit_clicked="displayModel"
          @reload="fetchSchedules"
          @year_month="handleYearMonth"
        />
      </div>

      <!-- Tab 2: Schedule Questions -->
      <div v-show="activeTab === 1" class="space-y-4">
        <!-- Debug Info -->
        <div class="bg-gray-100 p-2 text-xs">
          <div>Loading: {{ questionsLoading }}</div>
          <div>Questions Count: {{ scheduleQuestions.length }}</div>
          <div>Questions: {{ JSON.stringify(scheduleQuestions) }}</div>
        </div>

        <!-- Add Question Button -->
        <div class="flex justify-end">
          <UButton
            @click="openCreateQuestionModal"
            icon="i-lucide-plus"
            label="Create Question"
            color="primary"
          />
        </div>

        <!-- Questions Table -->
        <div v-if="!questionsLoading && scheduleQuestions.length > 0">
          <UTable
            :rows="scheduleQuestions"
            :columns="[
              { id: 'question', key: 'question', label: 'Question' },
              { id: 'actions', key: 'actions', label: 'Actions' }
            ]"
            class="w-full"
          >
            <template #question-data="{ row }">
              <span class="truncate max-w-sm">{{ row.question }}</span>
            </template>
            <template #actions-data="{ row }">
              <div class="flex gap-2">
                <UButton
                  @click="openAssignQuestionModal(row)"
                  size="sm"
                  color="primary"
                  variant="soft"
                  icon="i-lucide-link"
                  label="Assign"
                />
                <UButton
                  @click="deleteQuestion(row.id)"
                  size="sm"
                  color="red"
                  variant="soft"
                  icon="i-lucide-trash"
                />
              </div>
            </template>
          </UTable>
        </div>

        <!-- Loading State -->
        <div v-else class="flex justify-center py-8">
          <Spinner />
        </div>

        <!-- Empty State -->
        <div
          v-if="!questionsLoading && scheduleQuestions.length === 0"
          class="text-center py-8 text-gray-500"
        >
          <p>No questions created yet. Click "Create Question" to add one.</p>
        </div>
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
        <div class="grid grid-cols-2 my-6 place-items-center">
          <UFormField label="Starts" class="flex gap-4 items-center">
            <input
              v-model="state.start"
              type="time"
              name="start"
              id="start"
              step="1"
              class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary focus:border-primary p-2.5"
              required
            />
          </UFormField>

          <UFormField label="Ends" class="flex gap-4 items-center">
            <input
              v-model="state.end"
              type="time"
              name="end"
              id="end"
              step="1"
              class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary focus:border-primary p-2.5"
              required
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
        <h2 class="text-xl font-bold text-primary">Create Question</h2>
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
      <div class="space-y-4">
        <!-- Question Text -->
        <UFormField label="Question Text" required>
          <UInput
            v-model="questionState.question"
            placeholder="Enter your question"
            type="text"
          />
        </UFormField>

        <!-- Ask On Checkin/Checkout -->
        <div class="space-y-2">
          <label class="block text-sm font-medium">When to Ask</label>
          <div class="flex gap-4">
            <label class="flex items-center gap-2">
              <input
                v-model="questionState.ask_on_in"
                type="checkbox"
                class="rounded"
              />
              <span class="text-sm">Ask on Check-In</span>
            </label>
            <label class="flex items-center gap-2">
              <input
                v-model="questionState.ask_on_out"
                type="checkbox"
                class="rounded"
              />
              <span class="text-sm">Ask on Check-Out</span>
            </label>
          </div>
        </div>

        <!-- Additional Options -->
        <div class="space-y-2">
          <label class="flex items-center gap-2">
            <input
              v-model="questionState.is_active"
              type="checkbox"
              class="rounded"
            />
            <span class="text-sm">Active</span>
          </label>
          <label class="flex items-center gap-2">
            <input
              v-model="questionState.ask_every_time"
              type="checkbox"
              class="rounded"
            />
            <span class="text-sm">Ask Every Time</span>
          </label>
          <label class="flex items-center gap-2">
            <input
              v-model="questionState.require_yes_to_proceed"
              type="checkbox"
              class="rounded"
            />
            <span class="text-sm">Require Yes to Proceed</span>
          </label>
        </div>

        <!-- Button Texts -->
        <div class="space-y-2">
          <label class="block text-sm font-medium">Button Labels</label>
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
            label="Create Question"
            @click="submitQuestion"
          />
        </div>
      </div>
    </template>
  </UModal>

  <!-- Modal for Assign Question -->
  <UModal v-model:open="assignQuestionModal">
    <template #header>
      <div class="flex justify-between w-full">
        <h2 class="text-xl font-bold text-primary">Assign Question to Schedule</h2>
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
          <p class="font-semibold">{{ selectedQuestion?.text }}</p>
        </div>

        <!-- Schedule Selection -->
        <UFormField label="Select Schedule" required>
          <USelect
            v-model="assignmentState.scheduleId"
            :options="schedules.map((schedule) => ({
              label: `${schedule.start} - ${schedule.end}`,
              value: schedule.id
            }))"
            placeholder="Choose a schedule"
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
</template>

<script setup>
import { convertTo24Hour } from "~/common/common";

definePageMeta({
  layout: "sidebar",
  middleware: ["auth"],
});
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
});
</script>

<template>
  <div>
    <UCard class="rounded-2xl shadow-sm mb-4">
      <div
        class="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-4 md:mb-0"
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
    <ScheduleCalender
      :schedules="schedules"
      @edit_clicked="displayModel"
      @reload="fetchSchedules"
      @year_month="handleYearMonth"
    />
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
</template>

<script setup>
import { DateFormatter, getLocalTimeZone } from "@internationalized/date";
import { object, mixed } from "yup";
import { convertTo24Hour, secondsToAmPm } from "~/common/common";

definePageMeta({
  layout: "sidebar",
  middleware: ["auth"],
});

const dayMap = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thoursday: 4,
  Friday: 5,
  Shabbos: 6,
};

const df = new DateFormatter("en-US", {
  dateStyle: "medium",
});

const api = useApi();
const toast = useToast();

const isSubmitting = ref(false);
const fromDatePickerOpen = ref(false);
const toDatePickerOpen = ref(false);
const defaultSchedules = ref([]);
const scheduleQuestions = ref([]);
const scheduleFetching = ref(false);
const questionsFetching = ref(false);
const defaultScheduleModal = ref(false);
const selectedSchedule = ref(null);
const schdeuleFormSubmiting = ref(false);
const scheduleDeleteConfirmModal = ref(false);

const schema = object({
  from_date: mixed()
    .required("From date is required")
    .test(
      "valid-from-date",
      "Invalid from date",
      (value) => value && typeof value === "object",
    ),

  to_date: mixed()
    .required("To date is required")
    .test(
      "valid-to-date",
      "Invalid to date",
      (value) => value && typeof value === "object",
    )
    .test(
      "after-from-date",
      "To date must be greater than From date",
      function (toDate) {
        const { from_date } = this.parent;

        if (!from_date || !toDate) return true;

        // DateValue supports compare()
        return toDate.compare(from_date) > 0;
      },
    ),
});

const state = reactive({
  from_date: null,
  to_date: null,
});

const resetForm = () => {
  state.from_date = null;
  state.to_date = null;
};

const handlePopulateScheduleSubmit = async ({ data }) => {
  isSubmitting.value = true;

  const payload = {
    from_date: data.from_date.toString(),
    to_date: data.to_date.toString(),
  };

  try {
    const response = await api(`/api/schedules/populate`, {
      method: "POST",
      body: payload,
    });

    if (response?.success) {
      toast.add({
        title: "Success",
        description: response?.message || "Schedule Populated successfully",
        color: "success",
        duration: 2000,
      });
      navigateTo("/schedule");
    } else {
      toast.add({
        title: "Failed",
        description:
          response?.message ||
          response?._data?.message ||
          "Something went wrong. Please try again later.",
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
    resetForm();
  }
};

async function fetchDefaultSchedules() {
  scheduleFetching.value = true;

  try {
    const response = await api(`/api/schedules/default`);

    if (response?.success) {
      const dayNames = Object.keys(response?.schedules);

      defaultSchedules.value = Object.entries(response?.schedules).map(
        ([dayName, daySchedules]) => {
          const schedule = daySchedules[0] || {}; // take first schedule if exists, else empty
          return {
            id: schedule?.id,
            day_of_week:
              schedule.day_of_week !== undefined
                ? dayNames[schedule.day_of_week] // if schedule exists, map by index
                : dayName,
            seder1_begin: schedule.a_begin
              ? secondsToAmPm(schedule.a_begin)
              : "-",
            seder1_end: schedule.a_ends ? secondsToAmPm(schedule.a_ends) : "-",
            seder2_begin: schedule.b_begin
              ? secondsToAmPm(schedule.b_begin)
              : "-",
            seder2_end: schedule.b_ends ? secondsToAmPm(schedule.b_ends) : "-",
            a_question_in: schedule.a_question_in ?? null,
            a_question_out: schedule.a_question_out ?? null,
            b_question_in: schedule.b_question_in ?? null,
            b_question_out: schedule.b_question_out ?? null,
          };
        },
      );
    }
  } catch (err) {
    console.log("🚀 ~ fetchStudents ~ err:", err);
    toast.add({
      description: "Error fetching default schedules. Please try again later.",
      color: "error",
      timeout: 3000,
    });
  } finally {
    scheduleFetching.value = false;
  }
}

async function fetchScheduleQuestions() {
  questionsFetching.value = true;
  try {
    const response = await api("/api/schedules/questions", {
      method: "GET",
    });

    if (response?.success) {
      scheduleQuestions.value = response?.questions || [];
    }
  } catch (err) {
    console.log("Error fetching schedule questions:", err);
    toast.add({
      title: "Error",
      description: "Failed to load schedule questions",
      color: "error",
    });
  } finally {
    questionsFetching.value = false;
  }
}

const questionOptions = computed(() => {
  const base = [{ label: "None", value: null }];

  if (!scheduleQuestions.value || !Array.isArray(scheduleQuestions.value)) {
    return base;
  }

  return [
    ...base,
    ...scheduleQuestions.value.map((question) => ({
      label: question.question_text || question.question || `Question #${question.id}`,
      value: question.id,
    })),
  ];
});

const columns = [
  {
    accessorKey: "day_of_week",
    header: "Day of week",
  },
  { accessorKey: "seder1_begin", header: "Seder 1 Begins" },
  { accessorKey: "seder1_end", header: "Seder 1 Ends" },
  { accessorKey: "seder2_begin", header: "Seder 2 Begins" },
  { accessorKey: "seder2_end", header: "Seder 2 Ends" },
  {
    accessorKey: "questions",
    header: "Questions",
    cell: ({ row }) => {
      const hasAIn = Boolean(row.original.a_question_in);
      const hasAOut = Boolean(row.original.a_question_out);
      const hasBIn = Boolean(row.original.b_question_in);
      const hasBOut = Boolean(row.original.b_question_out);

      return h("div", { class: "flex flex-col gap-1 text-xs" }, [
        h("div", { class: "flex items-center gap-2" }, [
          h("span", { class: "font-medium text-gray-600" }, "A"),
          hasAIn
            ? h(
                resolveComponent("UTooltip"),
                { text: "Seder A: Question In" },
                {
                  default: () =>
                    h(resolveComponent("UIcon"), {
                      name: "i-lucide-log-in",
                      class: "size-4 text-emerald-700",
                    }),
                },
              )
            : null,
          hasAOut
            ? h(
                resolveComponent("UTooltip"),
                { text: "Seder A: Question Out" },
                {
                  default: () =>
                    h(resolveComponent("UIcon"), {
                      name: "i-lucide-log-out",
                      class: "size-4 text-amber-700",
                    }),
                },
              )
            : null,
          !hasAIn && !hasAOut
            ? h("span", { class: "text-gray-400" }, "-")
            : null,
        ]),
        h("div", { class: "flex items-center gap-2" }, [
          h("span", { class: "font-medium text-gray-600" }, "B"),
          hasBIn
            ? h(
                resolveComponent("UTooltip"),
                { text: "Seder B: Question In" },
                {
                  default: () =>
                    h(resolveComponent("UIcon"), {
                      name: "i-lucide-log-in",
                      class: "size-4 text-emerald-700",
                    }),
                },
              )
            : null,
          hasBOut
            ? h(
                resolveComponent("UTooltip"),
                { text: "Seder B: Question Out" },
                {
                  default: () =>
                    h(resolveComponent("UIcon"), {
                      name: "i-lucide-log-out",
                      class: "size-4 text-amber-700",
                    }),
                },
              )
            : null,
          !hasBIn && !hasBOut
            ? h("span", { class: "text-gray-400" }, "-")
            : null,
        ]),
      ]);
    },
  },
  {
    accessorKey: "action",
    header: "Edit / Set",
    cell: ({ row }) => {
      return h("div", { class: "flex gap-2 items-center" }, [
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
                onClick: () => editSchedule(row.original),
              }),
          },
        ),

        // Delete Schedule Button
        h(
          resolveComponent("UTooltip"),
          { text: "Remove Schedule" },
          {
            default: () =>
              h(resolveComponent("UButton"), {
                icon: "i-lucide-trash-2",
                size: "md",
                color: "error",
                variant: "soft",
                disabled: !row.original.id,
                onClick: () => handleRemoveSchedule(row.original),
              }),
          },
        ),
      ]);
    },
  },
];

const schdeuleState = reactive({
  day_of_week: null,
  a_begin: null,
  a_ends: null,
  b_begin: null,
  b_ends: null,
  a_question_in: null,
  a_question_out: null,
  b_question_in: null,
  b_question_out: null,
});

const schduleResetForm = () => {
  schdeuleState.day_of_week = null;
  schdeuleState.a_begin = null;
  schdeuleState.a_ends = null;
  schdeuleState.b_begin = null;
  schdeuleState.b_ends = null;
  schdeuleState.a_question_in = null;
  schdeuleState.a_question_out = null;
  schdeuleState.b_question_in = null;
  schdeuleState.b_question_out = null;
};

const editSchedule = (schedule) => {
  selectedSchedule.value = schedule;
  defaultScheduleModal.value = true;
  if (!scheduleQuestions.value.length) {
    fetchScheduleQuestions();
  }
  schdeuleState.day_of_week = schedule.day_of_week;
  schdeuleState.a_begin = convertTo24Hour(schedule.seder1_begin);
  schdeuleState.a_ends = convertTo24Hour(schedule.seder1_end);
  schdeuleState.b_begin = convertTo24Hour(schedule.seder2_begin);
  schdeuleState.b_ends = convertTo24Hour(schedule.seder2_end);
  schdeuleState.a_question_in = schedule.a_question_in ?? null;
  schdeuleState.a_question_out = schedule.a_question_out ?? null;
  schdeuleState.b_question_in = schedule.b_question_in ?? null;
  schdeuleState.b_question_out = schedule.b_question_out ?? null;
};
const onScheduleSubmit = async (event) => {
  schdeuleFormSubmiting.value = true;

  const payload = {
    ...event.data,
    day_of_week: dayMap[schdeuleState.day_of_week],
  };

  const isCreateNewSchedule =
    selectedSchedule.value.seder1_begin === "-" &&
    selectedSchedule.value.seder1_end === "-" &&
    selectedSchedule.value.seder2_begin === "-" &&
    selectedSchedule.value.seder2_end === "-";

  const endpoint = isCreateNewSchedule
    ? `/api/schedules/default/store`
    : `/api/schedules/default/update`;

  let method = isCreateNewSchedule ? "POST" : "PUT";

  try {
    const response = await api(endpoint, {
      method: method,
      body: payload,
    });

    if (response?.success) {
      toast.add({
        title: "Success",
        description:
          response?.message || isCreateNewSchedule
            ? "Schedule has been set"
            : "Schedule created successfully",
        color: "success",
        duration: 2000,
      });
      defaultScheduleModal.value = false;
      await fetchDefaultSchedules();
    } else {
      toast.add({
        title: "Failed",
        description:
          response?.message ||
          response?._data?.message ||
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
    schdeuleFormSubmiting.value = false;
    schduleResetForm();
  }
};

const handleRemoveSchedule = async (schedule) => {
  selectedSchedule.value = schedule;
  scheduleDeleteConfirmModal.value = true;
};

const onSubmitScheduleDelete = async () => {
  try {
    isSubmitting.value = true;

    const response = await api(
      `/api/schedules/default/destroy?id=${selectedSchedule.value.id}`,
      {
        method: "DELETE",
      },
    );

    if (response?.success) {
      toast.add({
        title: "Success",
        description: response?.message || "Group deleted successfully",
        color: "success",
        duration: 2000,
      });
      scheduleDeleteConfirmModal.value = false;
      await fetchDefaultSchedules();
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
      description: "Error deleting schedule. Please try again later.",
      color: "error",
      timeout: 3000,
    });
  } finally {
    isSubmitting.value = false;
  }
};

onMounted(async () => {
  await Promise.all([fetchDefaultSchedules(), fetchScheduleQuestions()]);
});
</script>
<template>
  <UButton
    variant="outline"
    color="primary"
    to="/schedule"
    icon="i-lucide-arrow-left"
    label="Back to Schedule"
  />

  <div class="space-y-8 mt-4">
    <div>
      <h2 class="text-2xl font-bold text-gray-800 mb-2">
        Populate Schedule based on default
      </h2>
      <div class="gap-4">
        <UForm
          :schema="schema"
          :state="state"
          class="space-y-4 bg-gray-50 p-6 rounded-xl shadow h-fit mt-5"
          @submit="handlePopulateScheduleSubmit"
        >
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <UFormField label="From Date" name="from_date" required>
              <UPopover class="w-full" v-model:open="fromDatePickerOpen">
                <UButton
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-calendar"
                  size="lg"
                  class="w-full text-left"
                >
                  {{
                    state?.from_date
                      ? df.format(state?.from_date.toDate(getLocalTimeZone()))
                      : "Select a date"
                  }}
                </UButton>

                <template #content>
                  <UCalendar
                    v-model="state.from_date"
                    class="p-2"
                    @update:model-value="fromDatePickerOpen = false"
                  />
                </template>
              </UPopover>
            </UFormField>

            <UFormField label="To Date" name="to_date" required>
              <UPopover class="w-full" v-model:open="toDatePickerOpen">
                <UButton
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-calendar"
                  size="lg"
                  class="w-full text-left"
                >
                  {{
                    state?.to_date
                      ? df.format(state?.to_date.toDate(getLocalTimeZone()))
                      : "Select a date"
                  }}
                </UButton>

                <template #content>
                  <UCalendar
                    v-model="state.to_date"
                    class="p-2"
                    @update:model-value="toDatePickerOpen = false"
                  />
                </template>
              </UPopover>
            </UFormField>
          </div>

          <div
            class="flex justify-end items-center gap-2 mt-4 border-t border-gray-200 pt-4"
          >
            <UButton
              color="neutral"
              variant="solid"
              label="Cancel"
              @click="populateModalOpen = false"
            />

            <UButton
              type="submit"
              label="Set Schedule"
              :loading="isSubmitting"
              :disabled="isSubmitting"
            />
          </div>
        </UForm>
      </div>
    </div>
  </div>
  <UCard class="rounded-2xl shadow-sm my-8">
    <div
      class="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-4 md:mb-0"
    >
      <h2 class="text-lg font-bold">Manage Default Schdedules</h2>
    </div>
    <UTable
      :columns="columns"
      :data="defaultSchedules"
      :loading="scheduleFetching"
      class="flex-1 mt-6"
    />
  </UCard>
  <!-- Modal for Create Default Schedule -->
  <UModal v-model:open="defaultScheduleModal">
    <!-- Custom Header -->
    <template #header>
      <div class="flex justify-between w-full">
        <h2 class="text-xl font-bold text-primary">
          Edit Schedule for : {{ selectedSchedule?.day_of_week }}
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
              defaultScheduleModal = false;
              schduleResetForm();
            }
          "
        >
        </UButton>
      </div>
    </template>

    <template #body>
      <UForm
        :state="schdeuleState"
        class="space-y-4"
        @submit="onScheduleSubmit"
      >
        <div class="flex flex-col gap-4">
          <UFormField label="Seder A Begin">
            <UInput
              v-model="schdeuleState.a_begin"
              type="time"
              step="1"
              size="lg"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Seder A Ends">
            <UInput
              v-model="schdeuleState.a_ends"
              type="time"
              step="1"
              size="lg"
              class="w-full"
            />
          </UFormField>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <UFormField label="Seder A Question In">
              <USelect
                v-model="schdeuleState.a_question_in"
                :items="questionOptions"
                :loading="questionsFetching"
                placeholder="Select question (optional)"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Seder A Question Out">
              <USelect
                v-model="schdeuleState.a_question_out"
                :items="questionOptions"
                :loading="questionsFetching"
                placeholder="Select question (optional)"
                class="w-full"
              />
            </UFormField>
          </div>

          <UFormField label="Seder B Begin">
            <UInput
              v-model="schdeuleState.b_begin"
              type="time"
              step="1"
              size="lg"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Seder B Ends">
            <UInput
              v-model="schdeuleState.b_ends"
              type="time"
              step="1"
              size="lg"
              class="w-full"
            />
          </UFormField>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <UFormField label="Seder B Question In">
              <USelect
                v-model="schdeuleState.b_question_in"
                :items="questionOptions"
                :loading="questionsFetching"
                placeholder="Select question (optional)"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Seder B Question Out">
              <USelect
                v-model="schdeuleState.b_question_out"
                :items="questionOptions"
                :loading="questionsFetching"
                placeholder="Select question (optional)"
                class="w-full"
              />
            </UFormField>
          </div>
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
                defaultScheduleModal = false;
                schduleResetForm();
              }
            "
          />

          <UButton
            type="submit"
            label="Update Schedule"
            :loading="schdeuleFormSubmiting"
            :disabled="schdeuleFormSubmiting"
          />
        </div>
      </UForm>
    </template>
  </UModal>

  <!-- Delete schedule confirm modal -->
  <UModal
    v-model:open="scheduleDeleteConfirmModal"
    title="Confirm Delete Schedule"
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
          <strong>{{ selectedSchedule?.day_of_week }}</strong> schdeule time?
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
          @click="scheduleDeleteConfirmModal = false"
        />
        <UButton
          color="error"
          variant="solid"
          class="mt-4"
          label="Delete"
          :loading="isSubmitting"
          :disabled="isSubmitting"
          @click="onSubmitScheduleDelete()"
        />
      </div>
    </template>
  </UModal>
</template>

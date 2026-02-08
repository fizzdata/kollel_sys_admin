<script setup>
import {
  today,
  DateFormatter,
  getLocalTimeZone,
  Time,
} from "@internationalized/date";
import { object, string, number } from "yup";
import {
  convertTo24Hour,
  secondsToAmPm,
  secondsToPercent,
} from "~/common/common";

definePageMeta({
  layout: "sidebar",
  middleware: ["auth"],
});
const open = ref(false);
const datePickerOpen = ref(false);
const clockingsData = ref([]);
const studentsData = ref([]);
const isActive = ref(false);
const CreateClockingModal = ref(false);
const toast = useToast();
const pagination = ref({
  currentPage: 1,
  lastPage: 1,
  perPage: 100,
  total: 0,
});
const df = new DateFormatter("en-US", {
  dateStyle: "medium",
});

const isSubmitting = ref(false);
const isImporting = ref(false);
const loading = ref(false);
const ImportClockingModal = ref(false);
const file = ref(null);

const api = useApi();
// Get today's date
const todayDate = today(getLocalTimeZone());

// Get date 7 days ago
const fromDate = todayDate.subtract({ days: 7 });

const calendarRange = ref({
  start: fromDate,
  end: todayDate,
});
const toggleSwitch = async () => {
  isActive.value = !isActive.value;
  pagination.value.currentPage = 1; // Reset to first page
  await fetchClockings(
    {
      date_from: calendarRange.value.start?.toString(),
      date_to: calendarRange.value.end?.toString(),
    },
    1,
  );
};

// Add pagination functions
const goToPreviousPage = async () => {
  if (pagination.value.currentPage > 1) {
    const newPage = pagination.value.currentPage - 1;
    await fetchClockings(
      {
        date_from: calendarRange.value.start?.toString(),
        date_to: calendarRange.value.end?.toString(),
      },
      newPage,
    );
  }
};

const goToNextPage = async () => {
  if (pagination.value.currentPage < pagination.value.lastPage) {
    const newPage = pagination.value.currentPage + 1;
    await fetchClockings(
      {
        date_from: calendarRange.value.start?.toString(),
        date_to: calendarRange.value.end?.toString(),
      },
      newPage,
    );
  }
};

const state = reactive({
  id: undefined,
  student_id: undefined,
  day: undefined,
  in: undefined,
  out: undefined,
  user: undefined,
});

const resetClockingForm = () => {
  state.id = undefined;
  state.student_id = undefined;
  state.day = undefined;
  state.in = undefined;
  state.out = undefined;
  state.user = undefined;
};

const schema = object({
  student_id: number()
    .typeError("User is required") // ensures number, not string
    .required("User is required"),
  day: string()
    .matches(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
    .required("Date is required"),
  in: string()
    .matches(
      /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/,
      "In Time must be HH:mm:ss",
    )
    .required("In Time is required"),
  out: string()
    .matches(
      /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/,
      "Out Time must be HH:mm:ss",
    )
    .required("Out Time is required"),
});

const clockingsColumns = [
  { accessorKey: "day", header: "Date" },
  {
    accessorKey: "student_id",
    header: "Name",
    cell: ({ row }) => {
      return (
        row.original.first_yiddish_name + " " + row.original.last_yiddish_name
      );
    },
  },
  { accessorKey: "morning_in", header: "Morning In" },
  { accessorKey: "morning_out", header: "Morning Out" },
  {
    accessorKey: "retzifus_morning",
    header: "Retzifus",
  },
  {
    accessorKey: "retzifus_morning",
    header: "",
    cell: ({ row }) =>
      h("div", { class: "flex gap-2 items-center" }, [
        // Edit Clocking Button
        h(
          resolveComponent("UTooltip"),
          { text: "Edit Clocking" },
          {
            default: () =>
              h(resolveComponent("UButton"), {
                icon: "i-lucide-square-pen",
                size: "md",
                color: "success",
                variant: "soft",
                onClick: () => editClocking(row.original, "morning"),
              }),
          },
        ),
      ]),
  },
  { accessorKey: "total_morning", header: "Total morning" },
  { accessorKey: "afternoon_in", header: "Afternoon In" },
  { accessorKey: "afternoon_out", header: "Afternoon out" },
  { accessorKey: "retzifus_evening", header: "Retzifus" },
  {
    accessorKey: "retzifus_morning",
    header: "",
    cell: ({ row }) =>
      h("div", { class: "flex gap-2 items-center" }, [
        // Edit User Clocking
        h(
          resolveComponent("UTooltip"),
          { text: "Edit Clocking" },
          {
            default: () =>
              h(resolveComponent("UButton"), {
                icon: "i-lucide-square-pen",
                size: "md",
                color: "success",
                variant: "soft",
                onClick: () => editClocking(row.original, "evening"),
              }),
          },
        ),
      ]),
  },
  { accessorKey: "total_afternoon", header: "Total Afternoon" },
];

const formatClockings = (clockings = []) => {
  return clockings.map((item) => {
    const row = {
      morning_in: "-",
      morning_out: "-",
      total_morning: "-",
      retzifus_morning: "-",

      evening_in: "-",
      evening_out: "-",
      total_evening: "-",
      retzifus_evening: "-",
      ...item,
    };

    item.clocking.forEach((session) => {
      // Morning session
      if (session.session === 1) {
        row.morning_in = secondsToAmPm(session.in);
        row.morning_out = secondsToAmPm(session.out);
        row.total_morning = secondsToPercent(
          session.out - session.in,
          session.schedule_total,
        );
        row.retzifus_morning = session.retzifus === 0 ? "NO" : "-";
      }

      // Evening session
      if (session.session === 2) {
        row.afternoon_in = secondsToAmPm(session.in);
        row.afternoon_out = secondsToAmPm(session.out);
        row.total_afternoon = secondsToPercent(
          session.out - session.in,
          session.schedule_total,
        );
        row.retzifus_evening = session.retzifus === 0 ? "NO" : "-";
      }
    });

    return row;
  });
};

const fetchStudents = async () => {
  try {
    const response = await api(`/api/students`, {
      method: "GET",
    });

    if (response?.success) {
      studentsData.value = response?.students?.map((item) => ({
        label: item?.first_yiddish_name + " " + item?.last_yiddish_name,
        value: item?.id,
      }));
    }
  } catch (err) {
    console.log("🚀 ~ fetchStudents ~ err:", err);
    toast.add({
      title: "Error",
      description:
        "An unexpected error occurred while fetching students. Please try again later.",
      color: "error",
    });
  }
};

const fetchClockings = async (date, page = 1) => {
  try {
    loading.value = true;
    const response = await api(`/api/clockings`, {
      method: "GET",
      params: {
        date_from: date?.date_from,
        date_to: date?.date_to,
        error_only: isActive.value,
        page: page,
      },
    });

    if (response?.success) {
      // Handle paginated response structure
      const clockingsArray =
        response?.clockings?.data || response?.clockings || [];
      clockingsData.value = formatClockings(clockingsArray);

      // Update pagination info
      if (response?.clockings?.current_page) {
        pagination.value = {
          currentPage: response.clockings.current_page,
          lastPage: response.clockings.last_page,
          perPage: response.clockings.per_page,
          total: response.clockings.total,
        };
      }
    }
  } catch (err) {
    console.log("🚀 ~ fetchStudents ~ err:", err);
    toast.add({
      title: "Error",
      description:
        "An unexpected error occurred while fetching clockings. Please try again later.",
      color: "error",
    });
  } finally {
    loading.value = false;
  }
};

const onSubmit = async (event) => {
  isSubmitting.value = true;

  const endpoint = state?.id ? `/api/clockings/${state.id}` : `/api/clockings`;
  const method = state?.id ? "PUT" : "POST";

  const payload = state?.id
    ? {
        in: event.data.in,
        out: event.data.out,
      }
    : {
        in: event.data.in,
        out: event.data.out,
        student_id: event.data.student_id,
        day: event.data.day,
      };

  try {
    const response = await api(endpoint, {
      method: method,
      body: payload,
    });

    if (response?.success) {
      toast.add({
        title: "Success",
        description: response?.message
          ? response?.message
          : state.id
            ? "Successfully Updated"
            : "Successfully Created",
        color: "success",
        duration: 2000,
      });
      state.id = undefined;
      CreateClockingModal.value = false;
      await fetchClockings(
        {
          date_from: calendarRange.value.start?.toString(),
          date_to: calendarRange.value.end?.toString(),
        },
        1,
      );
      resetClockingForm();
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
    isSubmitting.value = false;
  }
};

const editClocking = (clock, type) => {
  state.id = clock.student_id;
  state.student_id = clock.student_id;
  state.day = clock.day;

  const userName =
    clock.first_yiddish_name + " " + clock.last_yiddish_name + " " + clock.day;
  state.user = userName;
  if (type === "morning") {
    state.in = convertTo24Hour(clock.morning_in);
    state.out = convertTo24Hour(clock.morning_out);
  } else if (type === "evening") {
    state.in = convertTo24Hour(clock.afternoon_in);
    state.out = convertTo24Hour(clock.afternoon_out);
  }

  CreateClockingModal.value = true;
};

const importClockings = async (formData) => {
  try {
    isImporting.value = true;
    const response = await api(`/api/clockings/import`, {
      method: "POST",
      body: formData,
    });

    if (response?.success) {
      toast.add({
        title: "Success",
        description: response?.message || "Data will be imported shortly",
        color: "success",
        duration: 2000,
      });
      await fetchClockings(
        {
          date_from: calendarRange.value.start?.toString(),
          date_to: calendarRange.value.end?.toString(),
        },
        1,
      );
      ImportClockingModal.value = false;
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
    console.error("Import error:", error);
    toast.add({
      title: "Error",
      description: "An unexpected error occurred during import.",
      color: "error",
    });
  } finally {
    isImporting.value = false;
  }
};

const exportToPDF = async () => {
  try {
    const response = await api(`/api/clockings/pdf`, {
      method: "GET",
      params: {
        date_from: calendarRange.value.start?.toString(),
        date_to: calendarRange.value.end?.toString(),
        error_only: isActive.value,
      },
    });

    if (response) {
      toast.add({
        title: "Success",
        description: response?.message || "PDF exported successfully",
        color: "success",
        duration: 2000,
      });
    }
  } catch (error) {
    console.error("Export to PDF error:", error);
    toast.add({
      title: "Error",
      description:
        "An unexpected error occurred while clocking export to pdf. Please try again later.",
      color: "error",
    });
  }
};

onMounted(async () => {
  await fetchStudents();
  await fetchClockings(
    {
      date_from: calendarRange.value.start?.toString(),
      date_to: calendarRange.value.end?.toString(),
    },
    1,
  );
});

// watch for datepicker changes
watch(
  () => calendarRange.value,
  async (val) => {
    if (!val?.start || !val?.end) {
      toast.add({
        title: "Error",
        description: "Please select a valid date range.",
        color: "error",
      });
      return;
    }

    // close popover
    open.value = false;

    // reset to first page when date changes
    pagination.value.currentPage = 1;

    // call API
    await fetchClockings(
      {
        date_from: val.start.toString(),
        date_to: val.end.toString(),
      },
      1,
    );
  },
  { deep: true },
);
</script>
<template>
  <UCard class="rounded-2xl shadow-sm">
    <div class="flex justify-between items-center gap-4">
      <h2 class="text-xl font-bold">This Weeks Clockings</h2>
      <div class="flex justify-end gap-2">
        <UButton
          @click="
            () => {
              CreateClockingModal = true;
              state.id = undefined;
            }
          "
          icon="i-lucide-plus"
          label="Create New Clockings"
          class="text-white"
          color="primary"
          variant="solid"
        />

        <UButton
          @click="ImportClockingModal = true"
          icon="i-lucide-download"
          label="Import Clockings"
        />

        <UButton
          icon="i-lucide-file-text"
          label="Export to PDF"
          @click="exportToPDF"
        />
      </div>
    </div>
  </UCard>
  <div class="flex justify-between my-6">
    <div class="flex gap-4 items-center">
      <UPopover v-model:open="open">
        <UButton
          color="neutral"
          variant="outline"
          size="lg"
          icon="i-lucide-calendar"
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
      <USwitch
        :model-value="isActive"
        @update:model-value="toggleSwitch"
        label="Show only with error"
        :ui="{ base: 'cursor-pointer' }"
      />
    </div>
    <UButton
      to="/clockings/requests"
      icon=""
      label="Requests"
      variant="outline"
    />
  </div>
  <!-- Clockings Table -->
  <UCard class="rounded-2xl shadow-sm mt-6">
    <div
      class="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-4 md:mb-0"
    >
      <h2 class="text-lg font-bold">View and manage Clockings</h2>
    </div>
    <UTable
      :columns="clockingsColumns"
      :loading="loading"
      :data="clockingsData"
      class="flex-1 mt-6"
    />
    <!-- Pagination Info -->
    <div class="flex justify-between items-center mt-4 text-sm text-gray-600">
      <div>
        Showing {{ (pagination.currentPage - 1) * pagination.perPage + 1 }} to
        {{
          Math.min(
            pagination.currentPage * pagination.perPage,
            pagination.total,
          )
        }}
        of {{ pagination.total }} results
      </div>
      <div class="flex gap-2">
        <UButton
          v-if="pagination.currentPage > 1"
          variant="outline"
          size="sm"
          label="Previous"
          icon="i-lucide-chevron-left"
          @click="goToPreviousPage"
          :loading="loading"
          :disabled="loading"
        />
        <span class="px-3 py-2"
          >{{ pagination.currentPage }} / {{ pagination.lastPage }}
        </span>
        <UButton
          v-if="pagination.currentPage < pagination.lastPage"
          variant="outline"
          size="sm"
          label="Next"
          icon="i-lucide-chevron-right"
          @click="goToNextPage"
          :loading="loading"
          :disabled="loading"
        />
      </div>
    </div>
  </UCard>
  <!-- Modal for Create New User -->
  <UModal v-model:open="CreateClockingModal">
    <!-- Custom Header -->
    <template #header>
      <div class="flex justify-between w-full">
        <h2 class="text-xl font-bold text-primary">
          {{ state?.id ? "Edit: " + state.user : "Create New Clockings" }}
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
              CreateClockingModal = false;
              resetClockingForm();
            }
          "
        />
      </div>
    </template>
    <!-- :schema="schema" -->
    <template #body>
      <UForm
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <div v-if="!state.id" class="flex flex-col gap-4">
          <UFormField label="Student" name="student_id" required>
            <USelect
              v-model.number="state.student_id"
              :items="studentsData"
              class="w-full"
              size="lg"
              placeholder="Select Student"
              required
            />
          </UFormField>
          <UFormField label="Day" name="day">
            <UPopover class="w-full" v-model:open="datePickerOpen" required>
              <UButton
                color="neutral"
                variant="outline"
                icon="i-lucide-calendar"
                size="lg"
              >
                {{
                  state?.day
                    ? df.format(state?.day.toDate(getLocalTimeZone()))
                    : "Select a date"
                }}
              </UButton>

              <template #content>
                <UCalendar
                  v-model="state.day"
                  class="p-2"
                  @update:model-value="datePickerOpen = false"
                />
              </template>
            </UPopover>
          </UFormField>
        </div>
        <div class="grid grid-cols-2 mb-6 place-items-center">
          <UFormField label="In" class="flex gap-4 items-center" required>
            <UInput
              v-model="state.in"
              type="time"
              step="1"
              class="w-full"
              size="lg"
              required
            />
          </UFormField>

          <UFormField label="Out" class="flex gap-4 items-center" required>
            <UInput
              v-model="state.out"
              type="time"
              step="1"
              class="w-full"
              size="lg"
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
                CreateClockingModal = false;
                resetClockingForm();
              }
            "
          />

          <UButton
            type="submit"
            :loading="isSubmitting"
            :disabled="isSubmitting"
            :label="state?.id ? 'Edit Clockings' : 'Create Clockings'"
          />
        </div>
      </UForm>
    </template>
  </UModal>

  <!-- Import Clockings Modal -->
  <CommonClockingsImportModal
    v-model="ImportClockingModal"
    :isLoading="isImporting"
    @import="importClockings"
  />
</template>

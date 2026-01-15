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
  await fetchClockings({
    date_from: calendarRange.value.start?.toString(),
    date_to: calendarRange.value.end?.toString(),
  });
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
      "In Time must be HH:mm:ss"
    )
    .required("In Time is required"),
  out: string()
    .matches(
      /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/,
      "Out Time must be HH:mm:ss"
    )
    .required("Out Time is required"),
});

const clockingsColumns = [
  { accessorKey: "day", header: "Date" },
  {
    accessorKey: "student_id",
    header: "Name",
    cell: ({ row }) => {
      console.log("row", clockingsData.value);
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
        // Edit User Button
        h(
          resolveComponent("UTooltip"),
          { text: "Edit User" },
          {
            default: () =>
              h(resolveComponent("UButton"), {
                icon: "i-lucide-square-pen",
                size: "md",
                color: "success",
                variant: "soft",
                onClick: () => editClocking(row.original, "morning"),
              }),
          }
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
        // Edit User Button
        h(
          resolveComponent("UTooltip"),
          { text: "Edit User" },
          {
            default: () =>
              h(resolveComponent("UButton"), {
                icon: "i-lucide-square-pen",
                size: "md",
                color: "success",
                variant: "soft",
                onClick: () => editClocking(row.original, "evening"),
              }),
          }
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
          session.schedule_total
        );
        row.retzifus_morning = session.retzifus === 0 ? "NO" : "-";
      }

      // Evening session
      if (session.session === 2) {
        row.afternoon_in = secondsToAmPm(session.in);
        row.afternoon_out = secondsToAmPm(session.out);
        row.total_afternoon = secondsToPercent(
          session.out - session.in,
          session.schedule_total
        );
        row.retzifus_evening = session.retzifus === 0 ? "NO" : "-";
      }
    });

    return row;
  });
};

const fetchClockings = async (date) => {
  try {
    loading.value = true;
    const response = await api(`/api/clockings`, {
      method: "GET",
      params: {
        date_from: date?.date_from,
        date_to: date?.date_to,
        error_only: isActive.value,
      },
    });

    if (response?.success) {
      studentsData.value = response?.students.map((item) => ({
        label: item?.first_yiddish_name + " " + item?.last_yiddish_name,
        value: item?.id,
      }));

      clockingsData.value = formatClockings(response?.clockings);
    }
  } catch (err) {
    console.log("🚀 ~ fetchStudents ~ err:", err);
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
          ? "Clocking updated successfully"
          : "Clocking created successfully",
        color: "success",
        duration: 2000,
      });
      state.id = null;
      await fetchClockings({
        date_from: calendarRange.value.start?.toString(),
        date_to: calendarRange.value.end?.toString(),
      });
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
    CreateClockingModal.value = false;
    isSubmitting.value = false;
    resetClockingForm();
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
  console.log("🚀 ~ importClockings ~ formData:", formData);
  try {
    isImporting.value = true;
    const response = await api(`/api/clockings/import`, {
      method: "POST",
      body: formData,
    });

    if (response?.success) {
      toast.add({
        title: "Success",
        description: response?.message || "Clockings imported successfully",
        color: "success",
        duration: 2000,
      });
      await fetchClockings({
        date_from: calendarRange.value.start?.toString(),
        date_to: calendarRange.value.end?.toString(),
      });
      ImportClockingModal.value = false;
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
      // responseType: "blob",
    });

    if (response) {
      // const url = window.URL.createObjectURL(
      //   new Blob([response.job], { type: "application/pdf" })
      // );
      // window.open(url, "_blank");
      toast.add({
        title: "Success",
        description: response?.message || "PDF exported successfully",
        color: "success",
        duration: 2000,
      });
    }
  } catch (error) {
    console.error("Export to PDF error:", error);
  }
  // window.open(
  //   `/api/clockings/pdf?date_from=${calendarRange.value.start?.toString()}&date_to=${calendarRange.value.end?.toString()}&error_only=${
  //     isActive.value
  //   }`,
  //   "_blank"
  // );
};

onMounted(async () => {
  await fetchClockings({
    date_from: calendarRange.value.start?.toString(),
    date_to: calendarRange.value.end?.toString(),
  });
});

// watch for datepicker changes
watch(
  () => calendarRange.value,
  async (val) => {
    if (!val?.start || !val?.end) return;

    // close popover
    open.value = false;

    // call API
    await fetchClockings({
      date_from: val.start.toString(),
      date_to: val.end.toString(),
    });
  },
  { deep: true }
);
</script>
<template>
  <UCard class="rounded-2xl shadow-sm">
    <div class="flex justify-between items-center gap-4">
      <h2 class="text-xl font-bold">This Weeks Clockings</h2>
      <div class="flex justify-end gap-2">
        <UButton
          @click="
            CreateClockingModal = true;
            state.id = undefined;
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
  <UCard>
    <UTable
      :columns="clockingsColumns"
      :loading="loading"
      :data="clockingsData"
      class="flex-1 mt-6"
    />
  </UCard>
  <!-- Modal for Create New User -->
  <UModal v-model:open="CreateClockingModal">
    <!-- Custom Header -->
    <template #header>
      <div class="flex justify-between w-full">
        <h2 class="text-xl font-bold text-primary">
          {{ state?.id ? "Edit" + " " + state.user : "Create New Clockings" }}
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
        >
        </UButton>
      </div>
    </template>
    <!-- :schema="schema" -->
    <template #body>
      <div>
        <UForm
          :schema="schema"
          :state="state"
          class="space-y-4"
          @submit="onSubmit"
        >
          <div v-if="!state.id" class="flex flex-col gap-4">
            <UFormField label="User" name="user">
              <USelect
                v-model.number="state.student_id"
                :items="studentsData"
                class="w-full"
                size="lg"
                placeholder="Select User"
                required
              />
            </UFormField>
            <UFormField label="Day" name="day">
              <UPopover class="w-full" v-model:open="datePickerOpen">
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
          <div class="grid grid-cols-2 my-6 place-items-center">
            <UFormField label="In" class="flex gap-4 items-center">
              <input
                v-model="state.in"
                type="time"
                name="in"
                id="in"
                step="1"
                class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary focus:border-primary p-2.5"
                required
              />
            </UFormField>

            <UFormField label="Out" class="flex gap-4 items-center">
              <input
                v-model="state.out"
                type="time"
                name="out"
                id="out"
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
              @click="
                () => {
                  CreateClockingModal = false;
                  resetClockingForm();
                }
              "
            >
              Cancel
            </UButton>
            <UButton
              type="submit"
              :loading="isSubmitting"
              :disabled="isSubmitting"
            >
              {{ state?.id ? "Edit" : "Create" }} Clockings
            </UButton>
          </div>
        </UForm>
      </div>
    </template>
  </UModal>

  <!-- Import Clockings Modal -->
  <CommonClockingsImportModal
    v-model="ImportClockingModal"
    :isLoading="isImporting"
    @import="importClockings"
  />
</template>

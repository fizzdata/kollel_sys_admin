<script setup>
import {
  today,
  DateFormatter,
  getLocalTimeZone,
  Time,
} from "@internationalized/date";
import { secondsToAmPm, secondsToPercent } from "~/common/common";

definePageMeta({
  layout: "sidebar",
  middleware: ["auth"],
});
const open = ref(false);
const clockingsData = ref([]);
const studentsData = ref([]);
const isActive = ref(false);
const CreateClockingModal = ref(false);
const clockingFormModal = ref(null);
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

const isImporting = ref(false);
const exporting = ref(false);
const loading = ref(false);
const ImportClockingModal = ref(false);
const file = ref(null);
const pendingRequestsCount = ref(0);

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

const fetchPendingRequestsCount = async () => {
  try {
    const response = await api(`/api/requests/count`, {
      method: "GET",
    });

    if (response?.success) {
      pendingRequestsCount.value = response?.request_amount || 0;
    }
  } catch (err) {
    console.log("🚀 ~ fetchPendingRequestsCount ~ err:", err);
  }
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

const onClockingSaved = async () => {
  await fetchClockings(
    {
      date_from: calendarRange.value.start?.toString(),
      date_to: calendarRange.value.end?.toString(),
    },
    1,
  );
};

const editClocking = (clock, type) => {
  const sessionNum = type === "morning" ? 1 : 2;
  const session = clock.clocking?.find((s) => s.session === sessionNum) || null;
  const label =
    clock.first_yiddish_name + " " + clock.last_yiddish_name + " " + clock.day;

  clockingFormModal.value?.open(
    { ...session, student_id: clock.student_id },
    clock.day,
    label,
  );
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

const exportToExcel = async () => {
  const fromDateStr = calendarRange.value.start?.toString();
  const toDateStr = calendarRange.value.end?.toString();

  if (!fromDateStr || !toDateStr) {
    toast.add({
      title: "Error",
      description: "Please select a valid date range for export",
      color: "error",
    });
    return;
  }

  exporting.value = true;
  try {
    const response = await api(
      `/api/clockings/export?from_date=${fromDateStr}&to_date=${toDateStr}`,
    );

    const blob = new Blob([response], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clockings_export_${fromDateStr}_to_${toDateStr}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast.add({
      title: "Success",
      description: "Export completed successfully",
      color: "success",
    });
  } catch (error) {
    console.error("Export to Excel error:", error);
    toast.add({
      title: "Error",
      description: "Failed to export clockings",
      color: "error",
    });
  } finally {
    exporting.value = false;
  }
};

onMounted(async () => {
  await fetchStudents();
  await fetchPendingRequestsCount();
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
    <div
      class="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"
    >
      <h2 class="text-lg sm:text-xl font-bold">This Week’s Clockings</h2>

      <div class="flex flex-wrap gap-2 sm:gap-2 sm:justify-end">
        <UButton
          @click="clockingFormModal?.open()"
          icon="i-lucide-plus"
          label="Create New Clockings"
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

        <UButton
          icon="i-lucide-file-spreadsheet"
          label="Export to Excel"
          :loading="exporting"
          @click="exportToExcel"
        />
      </div>
    </div>
  </UCard>

  <div class="flex justify-between my-6">
    <div class="flex flex-col md:flex-row gap-4 md:items-center">
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
    <UChip
      :show="pendingRequestsCount > 0"
      :text="pendingRequestsCount"
      color="error"
      :ui="{ base: 'h-5 min-w-5 px-1 text-[11px] font-bold ring-2' }"
    >
      <UButton
        to="/clockings/requests"
        icon="i-lucide-list-checks"
        label="Requests"
        variant="outline"
      />
    </UChip>
  </div>
  <!-- Clockings Table -->
  <UCard class="rounded-2xl shadow-sm mt-6">
    <div
      class="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-0"
    >
      <h2 class="md:text-lg text-base font-bold">View and manage Clockings</h2>
    </div>
    <UTable
      :columns="clockingsColumns"
      :loading="loading"
      :data="clockingsData"
      sticky
      class="flex-1 md:mt-6 mt-2 max-h-160"
    />
    <!-- Pagination Info -->
    <div
      class="flex flex-col md:flex-row justify-between md:items-center mt-4 md:text-sm text-xs text-gray-600"
    >
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
      <div class="flex mt-2 md:mt-0 justify-center items-center sm:flex-row">
        <UButton
          size="sm"
          label="Previous"
          color="neutral"
          variant="soft"
          icon="i-lucide-chevron-left"
          @click="goToPreviousPage"
          :disabled="pagination.currentPage === 1 || loading"
        />
        <span class="px-3 py-2"
          >Page {{ pagination.currentPage }} of {{ pagination.lastPage }}
        </span>
        <UButton
          size="sm"
          label="Next"
          color="neutral"
          variant="soft"
          trailing-icon="i-lucide-chevron-right"
          @click="goToNextPage"
          :disabled="pagination.currentPage === pagination.total || loading"
        />
      </div>
    </div>
  </UCard>
  <!-- Create/Edit Clocking Modal -->
  <CommonClockingFormModal
    v-model="CreateClockingModal"
    ref="clockingFormModal"
    :students-data="studentsData"
    @saved="onClockingSaved"
  />

  <!-- Import Clockings Modal -->
  <CommonClockingsImportModal
    v-model="ImportClockingModal"
    :isLoading="isImporting"
    @import="importClockings"
  />
</template>

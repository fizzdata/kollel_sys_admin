<script setup>
import {
  today,
  DateFormatter,
  getLocalTimeZone,
  Time,
} from "@internationalized/date";
definePageMeta({
  layout: "sidebar",
  middleware: ["auth"],
});

const api = useApi();
const toast = useToast();

const todayDate = today(getLocalTimeZone());
const fromDate = todayDate.subtract({ days: 7 });
const loading = ref(false);
const halfHourData = ref([]);
const percentData = ref([]);
const questionData = ref([]);
const payrollSummaryData = ref([]);
const questionItems = ref([]);
const calendarRange = ref({
  start: fromDate,
  end: todayDate,
});
const percentCalendarRange = ref({
  start: fromDate,
  end: todayDate,
});
const questionCalendarRange = ref({
  start: fromDate,
  end: todayDate,
});
const payrollCalendarRange = ref({
  start: fromDate,
  end: todayDate,
});
const questionState = reactive({
  question: "",
});
const open = ref(false);
const percentCalendarOpen = ref(false);
const questionCalendarOpen = ref(false);
const payrollCalendarOpen = ref(false);
const halfHourState = reactive({
  number: "0",
  select: "Yes",
});
const df = new DateFormatter("en-US", {
  dateStyle: "medium",
});
const selectedItems = ref(["Yes", "No"]);

const activeTab = ref("0");
const items = computed(() => [
  {
    label: "Half Hour",
    key: "half-hour",
  },
  {
    label: "Percent",
    key: "percent",
  },
  {
    label: "Question",
    key: "question",
  },
  {
    label: "Payroll Summary",
    key: "payroll-summary",
  },
]);
const halfHourColumns = [
  {
    accessorKey: "first_name",
    header: "First Name",
  },
  { accessorKey: "last_name", header: "Last Name" },
  { accessorKey: "total1", header: "Morning" },
  { accessorKey: "total2", header: "Afternoon" },
];
const percentColumns = [
  {
    accessorKey: "first_name",
    header: "First Name",
  },
  { accessorKey: "last_name", header: "Last Name" },
  { accessorKey: "morning", header: "Morning" },
  { accessorKey: "afternoon", header: "Afternoon" },
];
const questionColumns = [
  {
    accessorKey: "first_name",
    header: "First Name",
  },
  { accessorKey: "last_name", header: "Last Name" },
  { accessorKey: "yes1", header: "Yes (Morning)" },
  { accessorKey: "yes2", header: "Yes (Afternoon)" },
  { accessorKey: "no1", header: "No (Morning)" },
  { accessorKey: "no2", header: "No (Afternoon)" },
];
const payrollSummaryColumns = [
  {
    accessorKey: "name",
    header: "Student",
    cell: ({ row }) =>
      `${row.original.first_yiddish_name || ""} ${row.original.last_yiddish_name || ""}`.trim(),
  },
  {
    accessorKey: "total_paid",
    header: "Total Paid",
    cell: ({ row }) => `$${row.original.total_paid}`,
  },
];

const fetchHalfHour = async () => {
  if (!calendarRange.value?.start || !calendarRange.value?.end) return;

  try {
    loading.value = true;
    const response = await api("/api/reports/half-hour", {
      method: "GET",
      params: {
        date_from: calendarRange.value.start?.toString(),
        date_to: calendarRange.value.end?.toString(),
        till_minutes: halfHourState.number,
        retzifus: halfHourState.select === "Yes" ? 1 : 0,
      },
    });

    if (response?.success) {
      halfHourData.value = response?.half_hour || [];
    }
  } catch (err) {
    console.log("🚀 ~ fetchHalfHour ~ err:", err);
    toast.add({
      title: "Error",
      description:
        "An unexpected error occurred while fetching the half hour report. Please try again later.",
      color: "error",
    });
  } finally {
    loading.value = false;
  }
};

const fetchPercent = async () => {
  if (!percentCalendarRange.value?.start || !percentCalendarRange.value?.end)
    return;

  try {
    loading.value = true;
    const response = await api("/api/reports/percent", {
      method: "GET",
      params: {
        date_from: percentCalendarRange.value.start?.toString(),
        date_to: percentCalendarRange.value.end?.toString(),
      },
    });

    if (response?.success) {
      percentData.value = response?.percent || [];
    }
  } catch (err) {
    console.log("🚀 ~ fetchPercent ~ err:", err);
    toast.add({
      title: "Error",
      description:
        "An unexpected error occurred while fetching the percent report. Please try again later.",
      color: "error",
    });
  } finally {
    loading.value = false;
  }
};

const fetchQuestionOptions = async () => {
  try {
    const response = await api("/api/reports/question/options", {
      method: "GET",
    });

    if (response?.success) {
      questionItems.value = response?.questions || [];
      if (!questionState.question && questionItems.value.length) {
        questionState.question = questionItems.value[0];
      }
    }
  } catch (err) {
    console.log("🚀 ~ fetchQuestionOptions ~ err:", err);
    toast.add({
      title: "Error",
      description:
        "An unexpected error occurred while fetching questions. Please try again later.",
      color: "error",
    });
  }
};

const fetchQuestion = async () => {
  if (
    !questionState.question ||
    !questionCalendarRange.value?.start ||
    !questionCalendarRange.value?.end
  )
    return;

  try {
    loading.value = true;
    const response = await api("/api/reports/question", {
      method: "GET",
      params: {
        date_from: questionCalendarRange.value.start?.toString(),
        date_to: questionCalendarRange.value.end?.toString(),
        question: questionState.question,
      },
    });

    if (response?.success) {
      questionData.value = response?.question || [];
    }
  } catch (err) {
    console.log("🚀 ~ fetchQuestion ~ err:", err);
    toast.add({
      title: "Error",
      description:
        "An unexpected error occurred while fetching the question report. Please try again later.",
      color: "error",
    });
  } finally {
    loading.value = false;
  }
};

const fetchPayrollSummary = async () => {
  if (!payrollCalendarRange.value?.start || !payrollCalendarRange.value?.end)
    return;

  try {
    loading.value = true;
    const response = await api("/api/reports/payroll-summary", {
      method: "GET",
      params: {
        date_from: payrollCalendarRange.value.start?.toString(),
        date_to: payrollCalendarRange.value.end?.toString(),
      },
    });

    if (response?.success) {
      payrollSummaryData.value = response?.payroll_summary || [];
    }
  } catch (err) {
    console.log("🚀 ~ fetchPayrollSummary ~ err:", err);
    toast.add({
      title: "Error",
      description:
        "An unexpected error occurred while fetching the payroll summary. Please try again later.",
      color: "error",
    });
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  await fetchQuestionOptions();
  await fetchHalfHour();
  await fetchQuestion();
  await fetchPayrollSummary();
});

watch(
  () => ({
    calendar: calendarRange.value,
    question: questionCalendarRange.value,
    payroll: payrollCalendarRange.value,
  }),
  async ({ calendar, question, payroll }) => {
    // Calendar range (Half Hour)
    if (calendar?.start && calendar?.end) {
      open.value = false;
      await fetchHalfHour();
    }

    // Question calendar range
    if (question?.start && question?.end) {
      questionCalendarOpen.value = false;
      await fetchQuestion();
    }

    // Payroll summary calendar range
    if (payroll?.start && payroll?.end) {
      payrollCalendarOpen.value = false;
      await fetchPayrollSummary();
    }
  },
  { deep: true },
);

watch(
  () => halfHourState.select,
  async () => {
    await fetchHalfHour();
  },
);

watch(
  () => halfHourState.number,
  async () => {
    await fetchHalfHour();
  },
);

watch(
  () => questionState.question,
  async () => {
    await fetchQuestion();
  },
);

watch(
  () => percentCalendarRange.value,
  (val) => {
    if (val?.start && val?.end) {
      percentCalendarOpen.value = false;
    }
  },
  { deep: true },
);
</script>
<template>
  <UCard class="rounded-2xl shadow-sm">
    <div
      class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div class="flex items-center gap-1 mb-0 text-xl font-bold">
        <h2 class="text-lg sm:text-xl font-bold">
          Reports -
          {{
            activeTab === "0"
              ? "Half Hour"
              : activeTab === "1"
                ? "Percent"
                : activeTab === "2"
                  ? "Question"
                  : "Payroll Summary"
          }}
        </h2>
      </div>

      <div class="flex flex-wrap gap-2 sm:gap-2 sm:justify-end">
        <UButton
          v-if="activeTab === '0'"
          icon="i-lucide-file-text"
          label="Export"
        />
        <UButton
          v-if="activeTab === '2'"
          icon="i-lucide-file-text"
          label="Export"
        />
        <UButton
          v-if="activeTab === '1'"
          icon="i-lucide-file-text"
          label="Export"
        />
        <UButton
          v-if="activeTab === '1'"
          icon="i-lucide-plus"
          label="Get Report"
          @click="fetchPercent"
        />
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
  <div v-if="activeTab === '0'">
    <div class="flex flex-wrap gap-4 items-center my-6">
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
      </div>
      <p class="font-medium">
        And Was in for {{ halfHourState.number }} Minutes
      </p>
      <UInput v-model="halfHourState.number" type="number" size="lg" />
      <p class="font-medium">Needs to be Retzifus</p>
      <UFormField
        label=""
        name=""
        class="flex gap-2 items-center text-base font-medium"
      >
        <USelect
          v-model="halfHourState.select"
          :items="selectedItems"
          class="w-full"
          placeholder=""
          size="lg"
        />
      </UFormField>
    </div>

    <UCard class="rounded-2xl shadow-sm mt-6">
      <div
        class="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-0"
      >
        <h2 class="md:text-lg text-base font-bold">
          View and manage half hour reports
        </h2>
      </div>
      <UTable
        :columns="halfHourColumns"
        :loading="loading"
        :data="halfHourData"
        class="flex-1 md:mt-6 mt-2"
      />
    </UCard>
  </div>
  <div v-if="activeTab === '1'">
    <div class="flex flex-wrap gap-4 items-center my-6">
      <div class="flex gap-4 items-center">
        <UPopover v-model:open="percentCalendarOpen">
          <UButton
            color="neutral"
            variant="outline"
            size="lg"
            icon="i-lucide-calendar"
          >
            <template v-if="percentCalendarRange.start">
              <template v-if="percentCalendarRange.end">
                {{
                  df.format(
                    percentCalendarRange.start.toDate(getLocalTimeZone()),
                  )
                }}
                -
                {{
                  df.format(percentCalendarRange.end.toDate(getLocalTimeZone()))
                }}
              </template>
              <template v-else>
                {{
                  df.format(
                    percentCalendarRange.start.toDate(getLocalTimeZone()),
                  )
                }}
              </template>
            </template>
            <template v-else> Pick a date </template>
          </UButton>

          <template #content>
            <UCalendar
              v-model="percentCalendarRange"
              range
              :number-of-months="2"
              class="p-2"
            />
          </template>
        </UPopover>
      </div>
    </div>
    <UCard class="rounded-2xl shadow-sm mt-6">
      <div
        class="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-0"
      >
        <h2 class="md:text-lg text-base font-bold">
          View and manage percent reports
        </h2>
      </div>
      <UTable
        :columns="percentColumns"
        :loading="loading"
        :data="percentData"
        class="flex-1 md:mt-6 mt-2"
      />
    </UCard>
  </div>
  <div v-if="activeTab === '2'">
    <div class="flex flex-wrap gap-4 items-center my-6">
      <div class="flex flex-col md:flex-row gap-4">
        <UFormField
          label="Question"
          name="question"
          class="flex gap-2 items-center text-base font-medium"
        >
          <USelect
            v-model="questionState.question"
            :items="questionItems"
            class="w-full"
            size="lg"
            placeholder="Select question"
          />
        </UFormField>
        <UPopover v-model:open="questionCalendarOpen">
          <UButton
            color="neutral"
            variant="outline"
            size="lg"
            icon="i-lucide-calendar"
          >
            <template v-if="questionCalendarRange.start">
              <template v-if="questionCalendarRange.end">
                {{
                  df.format(
                    questionCalendarRange.start.toDate(getLocalTimeZone()),
                  )
                }}
                -
                {{
                  df.format(
                    questionCalendarRange.end.toDate(getLocalTimeZone()),
                  )
                }}
              </template>
              <template v-else>
                {{
                  df.format(
                    questionCalendarRange.start.toDate(getLocalTimeZone()),
                  )
                }}
              </template>
            </template>
            <template v-else> Pick a date </template>
          </UButton>

          <template #content>
            <UCalendar
              v-model="questionCalendarRange"
              range
              :number-of-months="2"
              class="p-2"
            />
          </template>
        </UPopover>
      </div>
    </div>
    <UCard class="rounded-2xl shadow-sm mt-6">
      <div
        class="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-0"
      >
        <h2 class="md:text-lg text-base font-bold">
          View and manage question reports
        </h2>
      </div>
      <UTable
        :columns="questionColumns"
        :loading="loading"
        :data="questionData"
        class="flex-1 md:mt-6 mt-2"
      />
    </UCard>
  </div>
  <div v-if="activeTab === '3'">
    <div class="flex flex-wrap gap-4 items-center my-6">
      <div class="flex gap-4 items-center">
        <UPopover v-model:open="payrollCalendarOpen">
          <UButton
            color="neutral"
            variant="outline"
            size="lg"
            icon="i-lucide-calendar"
          >
            <template v-if="payrollCalendarRange.start">
              <template v-if="payrollCalendarRange.end">
                {{
                  df.format(
                    payrollCalendarRange.start.toDate(getLocalTimeZone()),
                  )
                }}
                -
                {{
                  df.format(payrollCalendarRange.end.toDate(getLocalTimeZone()))
                }}
              </template>
              <template v-else>
                {{
                  df.format(
                    payrollCalendarRange.start.toDate(getLocalTimeZone()),
                  )
                }}
              </template>
            </template>
            <template v-else> Pick a date </template>
          </UButton>

          <template #content>
            <UCalendar
              v-model="payrollCalendarRange"
              range
              :number-of-months="2"
              class="p-2"
            />
          </template>
        </UPopover>
      </div>
    </div>
    <UCard class="rounded-2xl shadow-sm mt-6">
      <div
        class="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-0"
      >
        <h2 class="md:text-lg text-base font-bold">
          Total paid per student for the selected date range
        </h2>
      </div>
      <UTable
        :columns="payrollSummaryColumns"
        :loading="loading"
        :data="payrollSummaryData"
        class="flex-1 md:mt-6 mt-2"
      />
    </UCard>
  </div>
</template>

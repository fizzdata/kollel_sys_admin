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
const todayDate = today(getLocalTimeZone());
const fromDate = todayDate.subtract({ days: 7 });
const loading = ref(false);
const halfHourData = ref([]);
const percentData = ref([]);
const questionData = ref([]);
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
const percentState = reactive({
  morning: "300",
  afternoon: "250",
});
const questionState = reactive({
  question: "",
});
const open = ref(false);
const percentCalendarOpen = ref(false);
const questionCalendarOpen = ref(false);
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
]);
const halfHourColumns = [
  {
    accessorKey: "first_name",
    header: "First Name",
  },
  { accessorKey: "last_name", header: "Last Name" },
  { accessorKey: "morning", header: "Morning" },
  { accessorKey: "afternoon", header: "Afternoon" },
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
  { accessorKey: "times_morning", header: "Times Morning" },
  { accessorKey: "times_afternoon", header: "Times Afternoon" },
];
watch(
  () => ({
    calendar: calendarRange.value,
    percent: percentCalendarRange.value,
    question: questionCalendarRange.value,
  }),
  async ({ calendar, percent, question }) => {
    // Calendar range
    if (calendar?.start && calendar?.end) {
      open.value = false;
    }

    // Percent calendar range
    if (percent?.start && percent?.end) {
      percentCalendarOpen.value = false;
    }
    // Question calendar range
    if (question?.start && question?.end) {
      questionCalendarOpen.value = false;
    }
  },
  { deep: true },
);
</script>
<template>
  <UCard class="rounded-2xl shadow-sm mb-4">
    <div class="flex justify-between items-center gap-4">
      <div class="flex items-center gap-1 mb-4 md:mb-0 text-xl font-bold">
        <h2 class="">
          Reports -
          {{
            activeTab === "0"
              ? "Half Hour"
              : activeTab === "1"
                ? "Percent"
                : "Question"
          }}
        </h2>
      </div>

      <div class="space-x-2">
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
          icon="i-lucide-printer"
          label="Checks"
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
        class="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-4 md:mb-0"
      >
        <h2 class="text-lg font-bold">View and manage half hour reports</h2>
      </div>
      <UTable
        :columns="halfHourColumns"
        :loading="loading"
        :data="halfHourData"
        class="flex-1 mt-6"
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
      <UFormField
        label="Morning"
        name="morning"
        class="flex gap-2 items-center text-base font-medium"
      >
        <UInput v-model="percentState.morning" type="text" size="lg" />
      </UFormField>
      <UFormField
        label="Afternoon"
        name="afternoon"
        class="flex gap-2 items-center text-base font-medium"
      >
        <UInput v-model="percentState.afternoon" type="text" size="lg" />
      </UFormField>
    </div>
    <UCard class="rounded-2xl shadow-sm mt-6">
      <div
        class="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-4 md:mb-0"
      >
        <h2 class="text-lg font-bold">View and manage percent reports</h2>
      </div>
      <UTable
        :columns="percentColumns"
        :loading="loading"
        :data="percentData"
        class="flex-1 mt-6"
      />
    </UCard>
  </div>
  <div v-if="activeTab === '2'">
    <div class="flex flex-wrap gap-4 items-center my-6">
      <div class="flex gap-4 items-center">
        <UFormField
          label="Wage"
          name="wage"
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
        class="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-4 md:mb-0"
      >
        <h2 class="text-lg font-bold">View and manage question reports</h2>
      </div>
      <UTable
        :columns="questionColumns"
        :loading="loading"
        :data="questionData"
        class="flex-1 mt-6"
      />
    </UCard>
  </div>
</template>

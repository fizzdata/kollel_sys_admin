<script setup>
import {
  FormatYear,
  G2H,
  G2Hnumber,
  H2G,
} from "~/common/Gregorian_to_Hebrew.js";
import { formatActualTime } from "~/common/common.js";

const props = defineProps({
  items: {
    type: Array,
    default: () => [],
  },
  initialYear: {
    type: [Number, String],
    default: null,
  },
  initialMonth: {
    type: [Number, String],
    default: null,
  },
});

const emit = defineEmits(["select-session", "reload"]);

const weeks = ref([]);
const today = new Date();
const firstDate = ref(null);
const lastDate = ref(null);

function notifyRange() {
  if (firstDate.value && lastDate.value) {
    emit("reload", {
      from: firstDate.value,
      to: lastDate.value,
      year: hYear.value,
      month: hMonth.value,
    });
  }
}

const hebrewMonthNames = [
  "תשרי",
  "חשון",
  "כסלו",
  "טבת",
  "שבט",
  "אדר א'",
  "אדר ב'",
  "ניסן",
  "אייר",
  "סיון",
  "תמוז",
  "אב",
  "אלול",
];

function formatDate(date) {
  return date.toISOString().split("T")[0];
}

function hebrew_date_array(date) {
  const [y, m, d] = formatDate(date).split("-");
  const h = G2Hnumber(y, m, d).split("/");
  return { month: +h[0], day: +h[1], year: h[2] };
}

const hebrewToday = hebrew_date_array(today);
const hYear = ref(props.initialYear ?? hebrewToday.year);
const hMonth = ref(props.initialMonth ?? hebrewToday.month);

function month_year() {
  return `${hebrewMonthNames[hMonth.value - 1]} ${FormatYear(hYear.value)}`;
}

function findFirstHebrewMonthDay() {
  return H2G(hYear.value, hMonth.value, 1);
}

function getDataForDay(day) {
  return props.items.find((i) => i.day === day) || null;
}

function findSession(dayData, sessionNum) {
  return (dayData?.sessions || []).find((s) => s.session === sessionNum) || null;
}

function timestampToSeconds(timestamp) {
  if (!timestamp) return null;
  const date = new Date(timestamp.replace(" ", "T"));
  return isNaN(date.getTime())
    ? null
    : date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
}

// When a session's current in/out differs from the actual device-punch time
// (i.e. it was later edited by an admin or an approved correction request),
// return the original time to show as a tooltip.
function editedInfo(dayData, sessionNum) {
  const s = findSession(dayData, sessionNum);
  if (!s) return null;

  const inEdited = s.actual_in != null && s.in != null && timestampToSeconds(s.actual_in) !== s.in;
  const outEdited = s.actual_out != null && s.out != null && timestampToSeconds(s.actual_out) !== s.out;

  if (!inEdited && !outEdited) return null;

  const parts = [];
  if (inEdited) parts.push(`In: ${formatActualTime(s.actual_in)}`);
  if (outEdited) parts.push(`Out: ${formatActualTime(s.actual_out)}`);

  return `Originally punched — ${parts.join(", ")}`;
}

function selectSession(day, sessionNum) {
  const session = findSession(day.data, sessionNum);

  if (!session) return;

  emit("select-session", { day: day.date, session });
}

function generateCalendar() {
  const firstDay = findFirstHebrewMonthDay();
  const weeksArr = [];
  let week = [];

  let currentDate = new Date(firstDay);

  for (let i = 0; i < firstDay.getDay(); i++) {
    week.push({ date: null, data: null });
  }

  const firstHebrewMonth = G2Hnumber(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
    currentDate.getDate(),
  ).split("/")[0];

  while (true) {
    const dateString = formatDate(currentDate);

    week.push({
      date: dateString,
      data: getDataForDay(dateString),
    });

    currentDate.setDate(currentDate.getDate() + 1);

    if (week.length === 7) {
      weeksArr.push(week);
      week = [];
    }

    const nextHebrewMonth = G2Hnumber(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      currentDate.getDate(),
    ).split("/")[0];

    if (nextHebrewMonth !== firstHebrewMonth) {
      if (week.length) {
        while (week.length < 7) week.push({ date: null, data: null });
        weeksArr.push(week);
      }
      break;
    }
  }

  weeks.value = weeksArr;

  // Month-basis range: first day of current Hebrew month to the day before the next Hebrew month
  firstDate.value = formatDate(firstDay);
  const lastDay = new Date(currentDate);
  lastDay.setDate(lastDay.getDate() - 1);
  lastDate.value = formatDate(lastDay);
}

function prevMonth() {
  hMonth.value === 1 ? ((hMonth.value = 13), hYear.value--) : hMonth.value--;
  generateCalendar();
  notifyRange();
}

function nextMonth() {
  hMonth.value === 13 ? ((hMonth.value = 1), hYear.value++) : hMonth.value++;
  generateCalendar();
  notifyRange();
}

function g2h(date) {
  if (!date) return "";
  const [y, m, d] = date.split("-");
  return G2H(y, m, d);
}

onMounted(generateCalendar);
watch(() => props.items, generateCalendar, { deep: true });
</script>

<template>
  <div class="calendar">
    <div class="flex justify-between items-center mb-4 flex-wrap gap-2">
      <UButton
        @click="prevMonth"
        icon="i-lucide-arrow-left"
        color="primary"
        variant="solid"
        label="Previous"
      />

      <h2
        class="md:text-2xl text-xl font-bold text-gray-900 text-center flex-1"
      >
        {{ month_year() }}
      </h2>
      <UButton
        @click="nextMonth"
        trailing-icon="i-lucide-arrow-right"
        color="primary"
        variant="solid"
        label="Next"
      />
    </div>

    <!-- Responsive wrapper -->
    <div class="overflow-x-auto">
      <table class="min-w-full border-collapse table-auto">
        <thead>
          <tr class="bg-gray-200">
            <th
              v-for="d in 7"
              :key="d"
              class="p-2 border text-center text-xs sm:text-sm border-gray-300"
            >
              {{
                [
                  "זונטאג",
                  "מאנטאג",
                  "דינסטאג",
                  "מיטוואך",
                  "דאנערשטאג",
                  "פרייטאג",
                  "שבת קודש",
                ][d - 1]
              }}
            </th>
          </tr>
        </thead>

        <tbody>
          <tr v-for="(week, wi) in weeks" :key="wi">
            <td
              v-for="(day, di) in week"
              :key="di"
              class="p-2 border border-gray-300 align-top min-w-30"
            >
              <!-- Date -->
              <div
                v-if="day.date"
                class="text-xs sm:text-sm font-semibold text-center"
              >
                {{ g2h(day.date) }}
                <div class="text-gray-400 text-[10px] sm:text-xs">
                  {{ day.date }}
                </div>
              </div>

              <!-- Day Data -->
              <div
                v-if="day.data"
                class="mt-2 text-[10px] sm:text-xs p-2 space-y-1 flex flex-col items-center justify-center gap-1"
              >
                <div
                  v-if="day.data.has_morning"
                  class="bg-blue-50 rounded cursor-pointer hover:bg-blue-100"
                  @click="selectSession(day, 1)"
                >
                  <span class="ml-1 text-gray-900">
                    {{ day.data.morning_in }} – {{ day.data.morning_out }} |
                    {{ day.data.retzifus_morning }} |
                    {{ day.data.total_morning }}
                    <UIcon
                      v-if="editedInfo(day.data, 1)"
                      name="i-lucide-pencil"
                      class="text-amber-600 align-text-top"
                      :title="editedInfo(day.data, 1)"
                    />
                  </span>
                </div>

                <div
                  v-if="day.data.has_afternoon"
                  class="bg-blue-50 rounded cursor-pointer hover:bg-blue-100"
                  @click="selectSession(day, 2)"
                >
                  <span class="ml-1 text-gray-900">
                    {{ day.data.afternoon_in }} – {{ day.data.afternoon_out }} |
                    {{ day.data.retzifus_evening }} |
                    {{ day.data.total_afternoon }}
                    <UIcon
                      v-if="editedInfo(day.data, 2)"
                      name="i-lucide-pencil"
                      class="text-amber-600 align-text-top"
                      :title="editedInfo(day.data, 2)"
                    />
                  </span>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

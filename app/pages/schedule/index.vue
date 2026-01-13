<script setup>
import { DateFormatter, getLocalTimeZone } from "@internationalized/date";

definePageMeta({
  layout: "sidebar",
  middleware: ["auth"],
});

const df = new DateFormatter("en-US", {
  dateStyle: "medium",
});

const schedules = ref([]);
const showModel = ref(false);
const model = ref({});
const loading = ref(false);
const api = useApi();
const date_from = ref(fromMonth());
const date_to = ref(nextMonth());
const populateModalOpen = ref(false);
const isSubmitting = ref(false);
const fromDatePickerOpen = ref(false);
const toDatePickerOpen = ref(false);

const state = reactive({
  from_date: null,
  to_date: null,
});

async function fetchSchedules() {
  loading.value = true;

  try {
    const response = await api(
      `/api/schedules?date_from=${date_from.value}&date_to=${date_to.value}`
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
  model.value = payload;
  showModel.value = true;
}

const handlePopulateScheduleSubmit = (event) => {
  console.log("🚀 ~ handlePopulateScheduleSubmit ~ event:", event.data);
  // populateModalOpen.value=true
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
            @click="populateModalOpen = true"
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

  <!--Populate default schedule Modal  -->
  <UModal
    v-model:open="populateModalOpen"
    :ui="{
      fullscreen: {
        false: {
          content: 'w-3xl max-w-4xl rounded-lg shadow-lg ring ring-default',
        },
      },
    }"
  >
    <!-- Custom Header -->
    <template #header>
      <div class="flex justify-between w-full">
        <h2 class="text-xl font-bold text-primary">Fill the schedule</h2>

        <!-- Close Button -->
        <UButton
          size="sm"
          variant="outline"
          color="primary"
          class="rounded-full p-2"
          icon="i-lucide-x"
          @click="populateModalOpen = false"
        >
        </UButton>
      </div>
    </template>
    <template #body>
      <div class="max-w-4xl mx-auto space-y-8">
        <!-- Default Schedule -->
        <div>
          <h2 class="text-2xl font-bold mb-6 text-gray-800">
            Default Schedule
          </h2>

          <div class="space-y-3">
            <!-- Day Row Template -->
            <div
              class="flex justify-between items-start bg-gray-50 border border-gray-200 rounded-lg p-3"
            >
              <span class="font-semibold text-gray-700 w-32">Sunday</span>
              <div class="text-gray-600 text-sm space-y-1 text-right">
                <div>10:00 AM – 02:00 PM</div>
                <div>03:00 PM – 06:00 PM</div>
              </div>
            </div>

            <div
              class="flex justify-between items-start bg-gray-50 border border-gray-200 rounded-lg p-3"
            >
              <span class="font-semibold text-gray-700 w-32">Monday</span>
              <div class="text-gray-600 text-sm space-y-1 text-right">
                <div>10:00 AM – 02:00 PM</div>
                <div>03:00 PM – 06:00 PM</div>
              </div>
            </div>

            <div
              class="flex justify-between items-start bg-gray-50 border border-gray-200 rounded-lg p-3"
            >
              <span class="font-semibold text-gray-700 w-32">Tuesday</span>
              <div class="text-gray-600 text-sm space-y-1 text-right">
                <div>10:00 AM – 02:00 PM</div>
                <div>03:00 PM – 06:00 PM</div>
              </div>
            </div>

            <div
              class="flex justify-between items-start bg-gray-50 border border-gray-200 rounded-lg p-3"
            >
              <span class="font-semibold text-gray-700 w-32">Wednesday</span>
              <div class="text-gray-600 text-sm space-y-1 text-right">
                <div>10:00 AM – 02:00 PM</div>
                <div>03:00 PM – 06:00 PM</div>
              </div>
            </div>

            <div
              class="flex justify-between items-start bg-gray-50 border border-gray-200 rounded-lg p-3"
            >
              <span class="font-semibold text-gray-700 w-32">Friday</span>
              <div class="text-gray-600 text-sm space-y-1 text-right">
                <div>01:25 AM – 12:12 PM</div>
                <div>12:00 AM – 12:00 AM</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Date Picker Form -->
        <UForm
          :state="state"
          class="space-y-4 bg-gray-50 p-6 rounded-xl shadow"
          @submit="handlePopulateScheduleSubmit"
        >
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <UFormField label="From Date" name="day">
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

            <UFormField label="To Date" name="day">
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

          <!-- Buttons -->
          <div
            class="flex justify-end items-center gap-2 mt-4 border-t border-gray-200 pt-4"
          >
            <UButton
              color="neutral"
              variant="solid"
              @click="populateModalOpen = false"
            >
              Cancel
            </UButton>
            <UButton
              type="submit"
              :loading="isSubmitting"
              :disabled="isSubmitting"
            >
              Set Schedule
            </UButton>
          </div>
        </UForm>
      </div>
    </template>
  </UModal>
</template>

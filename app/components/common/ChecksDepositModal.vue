<script setup>
import {
  DateFormatter,
  getLocalTimeZone,
  today,
} from "@internationalized/date";

const props = defineProps({
  modelValue: Boolean,
  title: { type: String, default: "Processing Rules" },
  type: { type: String, default: "process" },
  isStudent: { type: Boolean, default: false },
  loading: Boolean,
});

const emit = defineEmits(["update:modelValue", "submit"]);

const calendarOpen = ref(false);
// Get today's date
const todayDate = today(getLocalTimeZone());

// Get date 7 days ago
const fromDate = todayDate.subtract({ days: 7 });

// Default range: last 7 days
const calendarRange = ref({
  start: fromDate,
  end: todayDate,
});

const description = ref("");

const df = new DateFormatter("en-US", { dateStyle: "medium" });

const handleSubmit = () => {
  let payload = {};
  if (!props.isStudent) {
    payload = {
      from_date: calendarRange.value.start?.toString(),
      till_date: calendarRange.value.end?.toString(),
      description: description.value,
    };
  } else {
    payload = {
      from_date: calendarRange.value.start?.toString(),
      till_date: calendarRange.value.end?.toString(),
    };
  }

  emit("submit", payload);
};

const formatDate = (date) =>
  date ? df.format(date.toDate(getLocalTimeZone())) : "";

watch(
  calendarRange,
  (val) => {
    if (val?.start && val?.end) {
      calendarOpen.value = false; // ✅ close popover
    }
  },
  { deep: true },
);
</script>

<template>
  <UModal :open="modelValue" @update:open="$emit('update:modelValue', $event)">
    <!-- Header -->
    <template #header>
      <div class="flex justify-between w-full items-center">
        <h2 class="text-xl font-bold text-primary">
          {{ title }}
        </h2>

        <UButton
          size="sm"
          variant="outline"
          color="primary"
          class="rounded-full p-2"
          icon="i-lucide-x"
          @click="$emit('update:modelValue', false)"
        />
      </div>
    </template>

    <!-- Body -->
    <template #body>
      <UForm @submit="handleSubmit">
        <!-- Date Range -->
        <UFormField label="Select Date Range" class="mb-4">
          <UPopover v-model:open="calendarOpen">
            <UButton
              color="neutral"
              variant="subtle"
              icon="i-lucide-calendar"
              size="lg"
            >
              <template v-if="calendarRange.start">
                <template v-if="calendarRange.end">
                  {{ formatDate(calendarRange.start) }} -
                  {{ formatDate(calendarRange.end) }}
                </template>
                <template v-else>
                  {{ formatDate(calendarRange.start) }}
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
                @update:modelValue="emit('date-change', calendarRange)"
              />
            </template>
          </UPopover>
        </UFormField>

        <UFormField v-if="!isStudent" label="Description" name="description">
          <UTextarea
            v-model="description"
            placeholder="Enter Description"
            class="w-full"
          />
        </UFormField>

        <div
          class="flex justify-end items-center gap-2 mt-4 border-t border-gray-200 pt-4"
        >
          <UButton
            color="neutral"
            variant="solid"
            @click="$emit('update:modelValue', false)"
            label="Cancel"
          />

          <UButton
            type="submit"
            :loading="loading"
            :disabled="loading"
            :label="type === 'check' ? 'Process Check' : 'Process Depost'"
          />
        </div>
      </UForm>
    </template>
  </UModal>
</template>

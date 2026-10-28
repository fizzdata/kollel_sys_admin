<script setup>
import {
  DateFormatter,
  getLocalTimeZone,
  today,
} from "@internationalized/date";

const props = defineProps({
  modelValue: Boolean,
  student: { type: Object, default: null },
  // Fixed single-group usage (group detail page): pass groupId directly.
  groupId: { type: [String, Number], default: null },
  // Multi-group usage (All Students tab): pass the student's groups and let
  // them pick one, auto-selecting when there's only one.
  groups: { type: Array, default: () => [] },
});

const emit = defineEmits(["update:modelValue", "processed"]);

const api = useApi();
const toast = useToast();

const step = ref("date"); // 'group' | 'date' | 'review'
const calculating = ref(false);
const processingAs = ref(null); // null | 'check' | 'deposit'

const selectedGroupId = ref(null);
const effectiveGroupId = computed(() => props.groupId ?? selectedGroupId.value);
const groupOptions = computed(() =>
  props.groups.map((g) => ({ label: g.name, value: g.id })),
);

const calendarOpen = ref(false);
const todayDate = today(getLocalTimeZone());
const calendarRange = ref({
  start: todayDate.subtract({ days: 7 }),
  end: todayDate,
});
const checkDate = ref("");

const df = new DateFormatter("en-US", { dateStyle: "medium" });
const formatDate = (date) =>
  date ? df.format(date.toDate(getLocalTimeZone())) : "";

const preview = ref(null); // { name, rules, base_price, net_value }
const manualRows = ref([]); // [{ description, amount }]
const newRowDescription = ref("");
const newRowAmount = ref("");

// Matches backend/resources/views/yingerman/sections/check.blade.php's
// stub-rules table (Rule / Times / Rate / Total, Base + Total Adjustments +
// Net footer) so the review table looks exactly like the resulting check stub.
const formatDateShort = (dateStr) => {
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? dateStr : `${d.getMonth() + 1}/${d.getDate()}`;
};

const ruleRows = computed(() => {
  if (!preview.value?.rules?.length) return [];

  const baseAmount = Number(preview.value.base_price || 0);

  return preview.value.rules.map((item) => {
    const applies = item.applies || {};
    const rate = Number(item.rule?.amount || 0);
    const rawImpact = applies.percent
      ? (Number(applies.net_value) / 100) * baseAmount
      : Number(applies.net_value);
    const impact = applies.sign === "-" ? -rawImpact : rawImpact;
    const sign = applies.sign === "-" ? "-" : "+";

    const dates = (applies.days || [])
      .filter((d) => /^\d{4}-\d{2}-\d{2}/.test(String(d)))
      .map(formatDateShort);

    return {
      description: item.rule?.description || "",
      amount: impact,
      count: applies.percent ? null : (applies.count ?? 0),
      dates,
      rate: applies.percent ? `${sign}${rate}%` : `${sign}$${rate.toFixed(2)}`,
    };
  });
});

const baseAmount = computed(() => Number(preview.value?.base_price || 0));

const tableRows = computed(() => [...ruleRows.value, ...manualRows.value]);

const grandTotal = computed(
  () => baseAmount.value + tableRows.value.reduce((sum, row) => sum + Number(row.amount || 0), 0),
);

const totalAdjustments = computed(() => grandTotal.value - baseAmount.value);

const isManualRow = (index) => index >= ruleRows.value.length;

const resetState = () => {
  selectedGroupId.value = props.groups.length === 1 ? props.groups[0].id : null;
  step.value = props.groupId == null && props.groups.length > 1 ? "group" : "date";
  preview.value = null;
  manualRows.value = [];
  newRowDescription.value = "";
  newRowAmount.value = "";
  checkDate.value = "";
};

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      resetState();
    } else {
      step.value = "date";
    }
  },
);

watch(
  calendarRange,
  (val) => {
    if (val?.start && val?.end) {
      calendarOpen.value = false;
    }
  },
  { deep: true },
);

const calculate = async () => {
  if (!calendarRange.value.start || !calendarRange.value.end || !props.student || !effectiveGroupId.value) {
    toast.add({
      title: "Error",
      description: "Please select a valid date range.",
      color: "error",
    });
    return;
  }

  calculating.value = true;
  try {
    const response = await api(
      `/api/payroll/group/${effectiveGroupId.value}/student/${props.student.id}/preview`,
      {
        method: "GET",
        params: {
          from_date: calendarRange.value.start.toString(),
          till_date: calendarRange.value.end.toString(),
        },
      },
    );

    if (response?.success) {
      preview.value = response.data;
      step.value = "review";
    } else {
      toast.add({
        title: "Failed",
        description: response?.message || "Failed to calculate payroll",
        color: "error",
      });
    }
  } catch (error) {
    console.error("Error calculating preview:", error);
    toast.add({
      title: "Error",
      description: "An error occurred while calculating.",
      color: "error",
    });
  } finally {
    calculating.value = false;
  }
};

const addManualRow = () => {
  const description = newRowDescription.value.trim();
  const amount = Number(newRowAmount.value);

  if (!description) {
    toast.add({ title: "Error", description: "Enter a description.", color: "error" });
    return;
  }
  if (newRowAmount.value === "" || !Number.isFinite(amount)) {
    toast.add({ title: "Error", description: "Enter a valid amount.", color: "error" });
    return;
  }
  if (amount === 0) {
    toast.add({ title: "Error", description: "Amount cannot be zero.", color: "error" });
    return;
  }
  if (Math.round(amount * 100) / 100 !== amount) {
    toast.add({
      title: "Error",
      description: "Amount can have at most 2 decimal places.",
      color: "error",
    });
    return;
  }

  manualRows.value.push({ description, amount });
  newRowDescription.value = "";
  newRowAmount.value = "";
};

const removeManualRow = (index) => {
  manualRows.value.splice(index - ruleRows.value.length, 1);
};

const processAs = async (outputType) => {
  if (grandTotal.value < 0) {
    toast.add({
      title: "Error",
      description: "Final total cannot be negative.",
      color: "error",
    });
    return;
  }

  processingAs.value = outputType;
  try {
    const endpoint = outputType === "check" ? "checks" : "deposit";
    const response = await api(
      `/api/payroll/group/${effectiveGroupId.value}/student/${props.student.id}/process/${endpoint}`,
      {
        method: "POST",
        body: {
          from_date: calendarRange.value.start.toString(),
          till_date: calendarRange.value.end.toString(),
          check_date: outputType === "check" ? checkDate.value || null : null,
          manual_adjustments: manualRows.value,
        },
      },
    );

    if (response?.success) {
      emit("processed", { outputType, response });
      emit("update:modelValue", false);
    } else {
      toast.add({
        title: "Failed",
        description:
          response?.message ||
          response?._data?.message ||
          `Failed to process ${outputType}`,
        color: "error",
      });
    }
  } catch (error) {
    console.error(`Error processing ${outputType}:`, error);
    toast.add({
      title: "Error",
      description: `An error occurred while processing the ${outputType}.`,
      color: "error",
    });
  } finally {
    processingAs.value = null;
  }
};
</script>

<template>
  <UModal :open="modelValue" @update:open="$emit('update:modelValue', $event)">
    <template #header>
      <div class="flex justify-between w-full items-center">
        <h2 class="text-xl font-bold text-primary">
          {{ student ? `${student.first_yiddish_name} ${student.last_yiddish_name}` : "" }}
          — Process
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

    <template #body>
      <!-- Group step (only when the student belongs to more than one group) -->
      <div v-if="step === 'group'">
        <UFormField label="Which group is this for?" class="mb-4" required>
          <USelect
            v-model="selectedGroupId"
            :items="groupOptions"
            placeholder="Select a group"
            class="w-full"
            size="lg"
          />
        </UFormField>

        <div class="flex justify-end items-center gap-2 mt-4 border-t border-gray-200 pt-4">
          <UButton
            color="neutral"
            variant="solid"
            label="Cancel"
            @click="$emit('update:modelValue', false)"
          />
          <UButton
            label="Next"
            :disabled="!selectedGroupId"
            @click="step = 'date'"
          />
        </div>
      </div>

      <!-- Date step -->
      <div v-else-if="step === 'date'">
        <UFormField label="Select Date Range" class="mb-4" required>
          <UPopover v-model:open="calendarOpen">
            <UButton color="neutral" variant="subtle" icon="i-lucide-calendar" size="lg">
              <template v-if="calendarRange.start">
                <template v-if="calendarRange.end">
                  {{ formatDate(calendarRange.start) }} - {{ formatDate(calendarRange.end) }}
                </template>
                <template v-else>{{ formatDate(calendarRange.start) }}</template>
              </template>
              <template v-else>Pick a date</template>
            </UButton>
            <template #content>
              <UCalendar v-model="calendarRange" range :number-of-months="2" class="p-2" />
            </template>
          </UPopover>
        </UFormField>

        <div class="flex justify-end items-center gap-2 mt-4 border-t border-gray-200 pt-4">
          <UButton
            color="neutral"
            variant="solid"
            label="Cancel"
            @click="$emit('update:modelValue', false)"
          />
          <UButton
            label="Calculate"
            :loading="calculating"
            :disabled="calculating"
            @click="calculate"
          />
        </div>
      </div>

      <!-- Review step -->
      <div v-else-if="step === 'review'">
        <table class="w-full text-sm border-collapse">
          <thead>
            <tr class="border-b border-gray-200 text-left text-gray-500">
              <th class="py-2">Rule</th>
              <th class="py-2 text-center">Times</th>
              <th class="py-2 text-center">Rate</th>
              <th class="py-2 text-right">Total</th>
              <th class="py-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, index) in tableRows"
              :key="index"
              class="border-b border-gray-100"
            >
              <td class="py-2">{{ row.description }}</td>
              <td class="py-2 text-center text-gray-500">
                {{ row.count ?? "—" }}
                <span v-if="row.dates?.length" class="text-xs text-gray-400">
                  ({{ row.dates.join(", ") }})
                </span>
              </td>
              <td class="py-2 text-center text-gray-500">{{ row.rate ?? "—" }}</td>
              <td
                class="py-2 text-right font-medium"
                :class="row.amount < 0 ? 'text-red-600' : 'text-green-600'"
              >
                {{ row.amount < 0 ? "-" : "+" }}${{ Math.abs(row.amount).toFixed(2) }}
              </td>
              <td class="py-2 text-right">
                <UButton
                  v-if="isManualRow(index)"
                  icon="i-lucide-x"
                  size="xs"
                  color="error"
                  variant="ghost"
                  @click="removeManualRow(index)"
                />
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colspan="2" class="py-2"><strong>Base:</strong> ${{ baseAmount.toFixed(2) }}</td>
              <td
                colspan="2"
                class="py-2 text-right"
                :class="totalAdjustments < 0 ? 'text-red-600' : 'text-green-600'"
              >
                <strong>Total Adjustments:</strong>
                {{ totalAdjustments < 0 ? "-" : "+" }}${{ Math.abs(totalAdjustments).toFixed(2) }}
              </td>
              <td></td>
            </tr>
            <tr>
              <td colspan="4" class="py-2 text-right">
                <strong :class="grandTotal < 0 ? 'text-red-600' : 'text-green-600'">
                  Net: ${{ grandTotal.toFixed(2) }}
                </strong>
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>

        <div class="flex gap-2 mt-4">
          <UInput
            v-model="newRowDescription"
            placeholder="Manual adjustment description"
            class="flex-1"
          />
          <UInput
            v-model="newRowAmount"
            type="number"
            step="0.01"
            placeholder="Amount"
            class="w-32"
          />
          <UButton icon="i-lucide-plus" @click="addManualRow" />
        </div>

        <UFormField
          label="Check Date (Optional)"
          hint="Only used if you create a check"
          class="mt-4"
        >
          <UInput
            v-model="checkDate"
            type="date"
            class="w-full"
            placeholder="Leave empty to use today's date"
          />
        </UFormField>

        <div class="flex justify-end items-center gap-2 mt-4 border-t border-gray-200 pt-4">
          <UButton color="neutral" variant="soft" label="Back" @click="step = 'date'" />
          <UButton
            color="neutral"
            variant="solid"
            label="Cancel"
            @click="$emit('update:modelValue', false)"
          />
          <UButton
            label="Create Check"
            color="info"
            :loading="processingAs === 'check'"
            :disabled="!!processingAs || grandTotal < 0"
            @click="processAs('check')"
          />
          <UButton
            label="Create Deposit"
            color="warning"
            :loading="processingAs === 'deposit'"
            :disabled="!!processingAs || grandTotal < 0"
            @click="processAs('deposit')"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>

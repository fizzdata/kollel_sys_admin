<script setup>
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  rule: { type: Object, default: null },
  allGroups: { type: Array, default: () => [] },
  metricLabels: { type: Object, default: () => ({}) },
  operaterLabels: { type: Object, default: () => ({}) },
  scheduleQuestions: { type: Array, default: () => [] },
  loadingOptions: { type: Boolean, default: false },
});

const emit = defineEmits(["update:modelValue", "edit"]);

const daysOfWeekLabels = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const metricUnit = (metric) => {
  if (!metric) return "";
  if (metric.startsWith("session_time_percentage")) return "%";
  if (metric.includes("minute")) return "minutes";
  return "";
};

const sessionLabel = (session) => {
  const value = Number(session);
  if (!value) return "All Sessions";
  return `Session ${value}`;
};

const daysOfWeekLabel = (days) => {
  if (!days || !days.length) return "Any day";
  return [...days]
    .sort((a, b) => a - b)
    .map((d) => daysOfWeekLabels[d] ?? d)
    .join(", ");
};

const questionFor = (condition) =>
  props.scheduleQuestions.find((q) => q.id === condition.reference_id);

const answerLabelFor = (condition) => {
  const question = questionFor(condition);
  if (!question) return `Answer #${condition.x_value}`;
  return question[`button_text_${condition.x_value}`] || `Answer #${condition.x_value}`;
};

const effectiveStatus = computed(() => {
  if (!props.rule) return null;

  const todayStr = new Date().toISOString().slice(0, 10);
  const from = props.rule.effective_from?.slice(0, 10);
  const until = props.rule.effective_until?.slice(0, 10);

  if (!from && !until) return { label: "Always Active", color: "info" };

  const range = `${from || "..."} → ${until || "..."}`;

  if (until && until < todayStr) return { label: `Expired ${range}`, color: "error" };
  if (from && from > todayStr) return { label: `Starts ${range}`, color: "warning" };
  return { label: `Active ${range}`, color: "info" };
});

const groupNames = computed(() => {
  if (!props.rule) return [];
  const ids = Array.isArray(props.rule.group_ids) ? props.rule.group_ids : [];
  return ids.map(
    (gid) => props.allGroups.find((group) => group.id === gid)?.name || `Group ${gid}`,
  );
});

const close = () => emit("update:modelValue", false);
const edit = () => emit("edit", props.rule);
</script>

<template>
  <UModal :open="modelValue" :dismissible="false" @update:open="emit('update:modelValue', $event)">
    <template #header>
      <div class="flex justify-between w-full">
        <h2 class="text-xl font-bold text-primary">
          {{ rule?.reference_number ? `Rule #${rule.reference_number}` : "Rule Details" }}
        </h2>
        <UButton
          size="sm"
          variant="outline"
          color="primary"
          class="rounded-full p-2"
          icon="i-lucide-x"
          @click="close"
        />
      </div>
    </template>
    <template #body>
      <div v-if="loadingOptions" class="flex items-center justify-center pt-10 w-full">
        <BaseSpinner :show-loader="loadingOptions" size="md" />
      </div>

      <div v-else-if="rule" class="space-y-6">
        <div>
          <p class="text-xs uppercase tracking-wide text-gray-400 mb-1">Description</p>
          <p class="text-base font-medium">{{ rule.description }}</p>
          <UBadge :color="effectiveStatus.color" variant="soft" size="sm" class="mt-2">
            {{ effectiveStatus.label }}
          </UBadge>
        </div>

        <div>
          <h3 class="text-base font-semibold mb-1">What triggers this rule</h3>
          <p v-if="rule.conditions?.length > 1" class="text-sm text-gray-500 mb-3">
            <span class="text-gray-400">When multiple conditions:</span>
            {{ rule.match_mode === "any" ? "ANY condition can match" : "ALL conditions must match" }}
          </p>

          <div
            v-for="(condition, index) in rule.conditions || []"
            :key="index"
            class="border border-gray-200 dark:border-gray-800 rounded-xl p-4 mb-3"
          >
            <p class="font-semibold mb-3">Condition {{ index + 1 }}</p>
            <dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div class="col-span-2">
                <dt class="text-gray-400">Metric</dt>
                <dd class="font-medium">
                  {{ metricLabels[condition.metric] || condition.metric }}
                </dd>
              </div>

              <template v-if="condition.metric === 'answered_question'">
                <div>
                  <dt class="text-gray-400">Question</dt>
                  <dd class="font-medium">
                    {{ questionFor(condition)?.question_text || "—" }}
                  </dd>
                </div>
                <div>
                  <dt class="text-gray-400">Required Answer</dt>
                  <dd class="font-medium">{{ answerLabelFor(condition) }}</dd>
                </div>
              </template>
              <template v-else>
                <div>
                  <dt class="text-gray-400">Comparison</dt>
                  <dd class="font-medium">
                    {{ operaterLabels[condition.x_operator] || condition.x_operator }}
                  </dd>
                </div>
                <div>
                  <dt class="text-gray-400">Threshold</dt>
                  <dd class="font-medium">
                    {{ condition.x_value }}{{ metricUnit(condition.metric) ? ` ${metricUnit(condition.metric)}` : "" }}
                  </dd>
                </div>
              </template>

              <div>
                <dt class="text-gray-400">Session</dt>
                <dd class="font-medium">{{ sessionLabel(condition.session) }}</dd>
              </div>
              <div>
                <dt class="text-gray-400">Days of Week</dt>
                <dd class="font-medium">{{ daysOfWeekLabel(condition.days_of_week) }}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div class="border-t border-gray-200 dark:border-gray-800 pt-4">
          <h3 class="text-base font-semibold mb-3">What happens</h3>
          <dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt class="text-gray-400">Type</dt>
              <dd class="font-medium">
                {{ Number(rule.is_deduction) ? "Deduction" : "Bonus" }}
              </dd>
            </div>
            <div>
              <dt class="text-gray-400">Amount</dt>
              <dd class="font-medium">
                {{ rule.amount_type === "fixed" ? `$${rule.amount}` : `${rule.amount}%` }}
              </dd>
            </div>
            <div>
              <dt class="text-gray-400">Evaluation period</dt>
              <dd class="font-medium">
                {{ Number(rule.is_weekly) ? "Weekly (Sunday-Saturday)" : "Full payroll period" }}
              </dd>
            </div>
            <div>
              <dt class="text-gray-400">Applies</dt>
              <dd class="font-medium">
                {{ Number(rule.apply_once) ? "One time only" : "Every time it matches" }}
              </dd>
            </div>
            <div v-if="rule.y_value">
              <dt class="text-gray-400">Only after it happens</dt>
              <dd class="font-medium">
                {{ operaterLabels[rule.y_operator] || rule.y_operator }} {{ rule.y_value }} time(s)
              </dd>
            </div>
          </dl>
        </div>

        <div
          v-if="rule.effective_from || rule.effective_until"
          class="border-t border-gray-200 dark:border-gray-800 pt-4"
        >
          <h3 class="text-base font-semibold mb-3">Effective window</h3>
          <dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt class="text-gray-400">From</dt>
              <dd class="font-medium">{{ rule.effective_from?.slice(0, 10) || "No start date" }}</dd>
            </div>
            <div>
              <dt class="text-gray-400">Until</dt>
              <dd class="font-medium">{{ rule.effective_until?.slice(0, 10) || "No end date" }}</dd>
            </div>
          </dl>
        </div>

        <div v-if="groupNames.length" class="border-t border-gray-200 dark:border-gray-800 pt-4">
          <h3 class="text-base font-semibold mb-3">Groups</h3>
          <div class="flex flex-wrap gap-1">
            <UBadge v-for="name in groupNames" :key="name" color="primary" variant="soft" size="sm">
              {{ name }}
            </UBadge>
          </div>
        </div>

        <div class="mt-8 flex gap-2 justify-end">
          <UButton color="neutral" class="justify-center" label="Close" @click="close" />
          <UButton icon="i-lucide-square-pen" class="justify-center" label="Edit Rule" @click="edit" />
        </div>
      </div>
    </template>
  </UModal>
</template>

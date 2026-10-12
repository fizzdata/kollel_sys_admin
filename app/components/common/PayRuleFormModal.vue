<script setup>
import { object, string, number, array } from "yup";

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  rule: { type: Object, default: null },
  groupId: { type: [Number, String], default: null },
  allGroups: { type: Array, default: () => [] },
  metricOptions: { type: Array, default: () => [] },
  operatorOptions: { type: Array, default: () => [] },
  metricLabels: { type: Object, default: () => ({}) },
  operaterLabels: { type: Object, default: () => ({}) },
  scheduleQuestions: { type: Array, default: () => [] },
  loadingOptions: { type: Boolean, default: false },
  submitting: { type: Boolean, default: false },
});

const emit = defineEmits(["update:modelValue", "submit"]);

const matchModeItems = [
  { label: "ALL conditions must match", value: "all" },
  { label: "ANY condition can match", value: "any" },
];
const amountTypeItems = [
  { label: "Fixed", value: "fixed" },
  { label: "Percentage", value: "percentage" },
];
const deductionItems = [
  { label: "Deduction", value: true },
  { label: "Bonus", value: false },
];
const applyOnceItems = ["Apply Once", "Each Time"];
const sessionOptions = [
  { label: "Session 1", value: 1 },
  { label: "Session 2", value: 2 },
];
const daysOfWeekOptions = [
  { label: "Sunday", value: 0 },
  { label: "Monday", value: 1 },
  { label: "Tuesday", value: 2 },
  { label: "Wednesday", value: 3 },
  { label: "Thursday", value: 4 },
  { label: "Friday", value: 5 },
  { label: "Saturday", value: 6 },
];

const blankCondition = () => ({
  metric: "",
  x_operator: "",
  x_value: "",
  reference_id: "",
  session: [],
  days_of_week: [],
});

const conditionSchema = object({
  metric: string().required("Metric is required"),
  x_operator: string().required("Comparison is required"),
  x_value: string().required("Threshold is required"),
  reference_id: string().nullable(),
  session: array()
    .of(number())
    .min(1, "Session is required")
    .required("Session is required"),
  days_of_week: array().of(number()).nullable(),
});

const schema = object({
  description: string().required("Description is required"),
  reference_number: string().nullable().max(50, "Reference # is too long"),
  match_mode: string().required("Match mode is required"),
  conditions: array()
    .of(conditionSchema)
    .min(1, "At least one condition is required"),
  is_deduction: string().required("Deduction or Bonus is required"),
  amount_type: string().required("Amount Type is required"),
  amount: number()
    .typeError("Amount must be a number")
    .required("Amount is required")
    .min(0, "Amount cannot be negative"),
  apply_once: string().required("Apply Rules is required"),
  y_operator: string().nullable(),
  y_value: string().nullable(),
  effective_from: string().nullable(),
  effective_until: string()
    .nullable()
    .test("after-from", "Must be on or after Effective From", function (value) {
      const from = this.parent.effective_from;
      return !value || !from || value >= from;
    }),
});

const blankState = () => ({
  description: "",
  reference_number: "",
  match_mode: "all",
  conditions: [blankCondition()],
  is_deduction: "",
  amount_type: "",
  amount: "",
  apply_once: "",
  y_operator: "",
  y_value: "",
  effective_from: "",
  effective_until: "",
  group_ids: [],
});

const state = reactive(blankState());
const advancedOpen = ref(false);

const isEditing = computed(() => !!props.rule?.id);

const sessionsFromBackend = (session) =>
  session == null || Number(session) === 0 ? [1, 2] : [Number(session)];

const sessionsToBackend = (sessions = []) =>
  sessions.length === 1 ? Number(sessions[0]) : 0;

const normalizeGroupIds = (groupIds = []) =>
  Array.isArray(groupIds)
    ? groupIds.map((group) =>
        typeof group === "object" ? group.value : Number(group),
      )
    : [];

const questionOptions = computed(() =>
  props.scheduleQuestions.map((question) => ({
    label: question.question_text,
    value: question.id,
  })),
);

const answerOptionsFor = (condition) => {
  const question = props.scheduleQuestions.find(
    (q) => q.id === condition.reference_id,
  );

  if (!question) return [];

  return [1, 2, 3]
    .filter((n) => question[`button_text_${n}`])
    .map((n) => ({
      label: question[`button_text_${n}`],
      value: n,
    }));
};

const addCondition = () => state.conditions.push(blankCondition());

const removeCondition = (index) => {
  if (state.conditions.length > 1) {
    state.conditions.splice(index, 1);
  }
};

// Operator/value have no meaning for answered_question; keep validation happy
watch(
  () => state.conditions.map((condition) => condition.metric),
  () => {
    state.conditions.forEach((condition) => {
      if (
        condition.metric === "answered_question" &&
        condition.x_operator !== "="
      ) {
        condition.x_operator = "=";
      }
    });
  },
);

const populateFromRule = (rule) => {
  state.description = rule.description;
  state.reference_number = rule.reference_number ?? "";
  state.match_mode = rule.match_mode || "all";
  state.conditions = (rule.conditions || []).map((condition) => ({
    metric: condition.metric,
    x_operator: condition.x_operator,
    x_value:
      condition.metric === "answered_question"
        ? Number(condition.x_value)
        : condition.x_value,
    reference_id: condition.reference_id ?? "",
    session: sessionsFromBackend(condition.session),
    days_of_week: condition.days_of_week ?? [],
  }));

  if (!state.conditions.length) {
    state.conditions = [blankCondition()];
  }

  state.is_deduction = rule.is_deduction === 1 || rule.is_deduction === true;
  state.amount_type = rule.amount_type;
  state.amount = rule.amount;
  state.apply_once = Number(rule.apply_once) ? "Apply Once" : "Each Time";
  state.y_operator = rule.y_operator ?? "";
  state.y_value = rule.y_value ?? "";
  state.effective_from = rule.effective_from
    ? rule.effective_from.slice(0, 10)
    : "";
  state.effective_until = rule.effective_until
    ? rule.effective_until.slice(0, 10)
    : "";
  state.group_ids = normalizeGroupIds(rule.group_ids);
  advancedOpen.value = Boolean(
    state.y_value || state.effective_from || state.effective_until,
  );
};

const resetForm = () => {
  Object.assign(state, blankState());
  advancedOpen.value = false;
};

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;

    if (props.rule) {
      populateFromRule(props.rule);
    } else {
      resetForm();
    }
  },
);

// Plain-language unit shown next to Threshold for the common minute/percent metrics
const metricUnit = (metric) => {
  if (!metric) return "";
  if (metric.startsWith("session_time_percentage")) return "%";
  if (metric.includes("minute")) return "minutes";
  return "";
};

const describeCondition = (condition) => {
  const metricLabel = props.metricLabels[condition.metric] || condition.metric;

  if (condition.metric === "answered_question") {
    const question = props.scheduleQuestions.find(
      (q) => q.id === condition.reference_id,
    );
    const answer = question ? question[`button_text_${condition.x_value}`] : "";
    return answer ? `${metricLabel} with answer "${answer}"` : metricLabel;
  }

  const operatorLabel =
    props.operaterLabels[condition.x_operator] || condition.x_operator || "";
  const unit = metricUnit(condition.metric);
  const value =
    condition.x_value !== "" && condition.x_value != null
      ? condition.x_value
      : "?";
  const comparisonPhrase = `${operatorLabel} ${value}${unit ? ` ${unit}` : ""}`.trim();

  // Metric descriptions use a literal "X" placeholder (e.g. "Came in X minutes
  // relative to session start") for the comparison/threshold the user picks
  if (/\bX\b/.test(metricLabel)) {
    return metricLabel.replace(/\bX\b/, comparisonPhrase);
  }

  return `${metricLabel} ${comparisonPhrase}`.trim();
};

const previewText = computed(() => {
  const conditions = state.conditions.filter((condition) => condition.metric);

  if (
    !conditions.length ||
    !state.amount_type ||
    state.is_deduction === "" ||
    state.amount === "" ||
    state.amount === null ||
    !state.apply_once
  ) {
    return "";
  }

  const joiner = state.match_mode === "any" ? " OR " : " AND ";
  const conditionText = conditions.map(describeCondition).join(joiner);
  const kind =
    state.is_deduction === true || state.is_deduction === "true"
      ? "deduct"
      : "add";
  const amountText =
    state.amount_type === "fixed" ? `$${state.amount}` : `${state.amount}%`;
  const cadence =
    state.apply_once === "Apply Once" ? "one time only" : "every time it matches";
  const repeatText = state.y_value
    ? `, but only once it has happened ${props.operaterLabels[state.y_operator] || state.y_operator || ""} ${state.y_value} time(s)`
    : "";

  return `When ${conditionText}, ${kind} ${amountText}${repeatText} — applies ${cadence}.`;
});

const buildPayload = (data) => ({
  description: data.description,
  reference_number: data.reference_number || null,
  match_mode: data.conditions.length > 1 ? data.match_mode || "all" : "all",
  conditions: data.conditions.map((condition) => ({
    metric: condition.metric,
    x_operator: condition.x_operator,
    x_value: condition.x_value,
    session: sessionsToBackend(condition.session),
    days_of_week: condition.days_of_week?.length ? condition.days_of_week : null,
    reference_id:
      condition.metric === "answered_question"
        ? condition.reference_id || null
        : null,
  })),
  is_deduction: data.is_deduction === true || data.is_deduction === "true",
  amount_type: data.amount_type,
  amount: data.amount,
  apply_once: data.apply_once === "Apply Once",
  y_operator: data.y_operator || null,
  y_value: data.y_value || null,
  effective_from: data.effective_from || null,
  effective_until: data.effective_until || null,
  group_ids: props.groupId ? [] : normalizeGroupIds(data.group_ids),
});

const onFormSubmit = (event) => {
  emit("submit", buildPayload(event.data));
};

const close = () => emit("update:modelValue", false);
</script>

<template>
  <UModal
    :open="modelValue"
    :dismissible="false"
    @update:open="emit('update:modelValue', $event)"
  >
    <template #header>
      <div class="flex justify-between w-full">
        <h2 class="text-xl font-bold text-primary">
          {{ isEditing ? "Edit Pay Rule" : "Create New Pay Rule" }}
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
      <div
        v-if="loadingOptions"
        class="flex items-center justify-center pt-10 w-full"
      >
        <BaseSpinner :show-loader="loadingOptions" size="md" />
      </div>

      <UForm v-else :state="state" :schema="schema" @submit="onFormSubmit">
        <div class="space-y-6">
          <div class="grid grid-cols-3 gap-4">
            <UFormField label="Description" name="description" required class="col-span-2">
              <UInput
                v-model="state.description"
                placeholder="e.g. Late arrival deduction"
                class="w-full"
                size="lg"
              />
            </UFormField>
            <UFormField
              label="Reference #"
              name="reference_number"
              help="Optional — your own number for easy reference"
            >
              <UInput
                v-model="state.reference_number"
                placeholder="e.g. 101"
                class="w-full"
                size="lg"
              />
            </UFormField>
          </div>

          <div>
            <h3 class="text-base font-semibold mb-1">
              1. What triggers this rule
            </h3>
            <p class="text-sm text-gray-500 mb-4">
              Add one or more conditions that must be met for this rule to apply.
            </p>

            <div
              v-for="(condition, index) in state.conditions"
              :key="index"
              class="border border-gray-200 dark:border-gray-800 rounded-xl p-4 mb-4"
            >
              <div class="flex items-center justify-between mb-4">
                <span class="font-semibold">Condition {{ index + 1 }}</span>
                <UButton
                  v-if="state.conditions.length > 1"
                  size="xs"
                  color="error"
                  variant="ghost"
                  icon="i-lucide-trash-2"
                  @click="removeCondition(index)"
                />
              </div>
              <div class="grid grid-cols-2 gap-4">
                <UFormField
                  label="Metric"
                  :name="`conditions[${index}].metric`"
                  help="What attendance behavior should trigger this pay adjustment"
                  required
                  class="col-span-2"
                >
                  <USelect
                    v-model="condition.metric"
                    :items="metricOptions"
                    placeholder="Please Select"
                    class="w-full"
                    size="lg"
                  />
                </UFormField>
                <template v-if="condition.metric === 'answered_question'">
                  <UFormField
                    label="Question"
                    :name="`conditions[${index}].reference_id`"
                    required
                  >
                    <USelect
                      v-model="condition.reference_id"
                      :items="questionOptions"
                      placeholder="Select question"
                      class="w-full"
                      size="lg"
                    />
                  </UFormField>
                  <UFormField
                    label="Answer"
                    :name="`conditions[${index}].x_value`"
                    required
                  >
                    <USelect
                      v-model="condition.x_value"
                      :items="answerOptionsFor(condition)"
                      :disabled="!condition.reference_id"
                      placeholder="Select answer"
                      class="w-full"
                      size="lg"
                    />
                  </UFormField>
                </template>
                <template v-else>
                  <UFormField
                    label="Comparison"
                    :name="`conditions[${index}].x_operator`"
                    required
                  >
                    <USelect
                      v-model="condition.x_operator"
                      :items="operatorOptions"
                      placeholder="Please Select"
                      class="w-full"
                      size="lg"
                    />
                  </UFormField>
                  <UFormField
                    label="Threshold"
                    :name="`conditions[${index}].x_value`"
                    :help="
                      metricUnit(condition.metric)
                        ? `In ${metricUnit(condition.metric)}`
                        : undefined
                    "
                    required
                  >
                    <UInput
                      v-model="condition.x_value"
                      placeholder="Enter value"
                      class="w-full"
                      type="number"
                      size="lg"
                    />
                  </UFormField>
                </template>
                <UFormField
                  label="Sessions"
                  :name="`conditions[${index}].session`"
                  required
                  class="col-span-2"
                >
                  <USelect
                    v-model="condition.session"
                    :items="sessionOptions"
                    multiple
                    placeholder="Select sessions"
                    class="w-full"
                    size="lg"
                  />
                </UFormField>
                <UFormField
                  v-if="condition.metric !== 'session_time_percentage'"
                  label="Days of Week"
                  :name="`conditions[${index}].days_of_week`"
                  hint="Optional — leave empty to match any day"
                  class="col-span-2"
                >
                  <USelect
                    v-model="condition.days_of_week"
                    :items="daysOfWeekOptions"
                    multiple
                    placeholder="Any day"
                    class="w-full"
                    size="lg"
                  />
                </UFormField>
              </div>
            </div>

            <div class="flex items-end justify-between gap-4">
              <UButton
                icon="i-lucide-plus"
                variant="outline"
                label="Add Condition"
                @click="addCondition"
              />
              <UFormField
                v-if="state.conditions.length > 1"
                label="When multiple conditions"
                name="match_mode"
                required
                class="w-64"
              >
                <USelect
                  v-model="state.match_mode"
                  :items="matchModeItems"
                  class="w-full"
                  size="lg"
                />
              </UFormField>
            </div>
          </div>

          <div class="border-t border-gray-200 dark:border-gray-800 pt-4">
            <h3 class="text-base font-semibold mb-1">2. What happens</h3>
            <p class="text-sm text-gray-500 mb-4">
              Set the pay adjustment this rule applies.
            </p>
            <div class="grid grid-cols-2 gap-4">
              <UFormField label="Amount Type" name="amount_type" required>
                <URadioGroup
                  v-model="state.amount_type"
                  :items="amountTypeItems"
                  orientation="horizontal"
                />
              </UFormField>
              <UFormField label="Amount" name="amount" required>
                <UInput
                  v-model="state.amount"
                  placeholder="Enter amount"
                  class="w-full"
                  type="number"
                  size="lg"
                />
              </UFormField>
              <UFormField label="Deduction or Bonus" name="is_deduction" required>
                <URadioGroup
                  v-model="state.is_deduction"
                  :items="deductionItems"
                  orientation="horizontal"
                />
              </UFormField>
              <UFormField label="How often to apply" name="apply_once" required>
                <URadioGroup
                  v-model="state.apply_once"
                  :items="applyOnceItems"
                  orientation="horizontal"
                />
              </UFormField>
              <UFormField
                v-if="!groupId"
                label="Groups"
                name="group_ids"
                class="col-span-2"
                hint="Which payroll groups this rule applies to"
              >
                <USelectMenu
                  v-model="state.group_ids"
                  :items="
                    allGroups.map((group) => ({
                      label: group.name,
                      value: group.id,
                    }))
                  "
                  placeholder="Select groups"
                  class="w-full"
                  size="lg"
                  multiple
                />
              </UFormField>
            </div>
          </div>

          <UCollapsible
            v-model:open="advancedOpen"
            class="border-t border-gray-200 dark:border-gray-800 pt-4"
          >
            <button
              type="button"
              class="flex w-full items-center justify-between text-left"
            >
              <span>
                <span class="text-base font-semibold block">
                  3. Advanced settings (optional)
                </span>
                <span class="text-sm text-gray-500">
                  Repeat threshold &amp; date range — most rules don't need this
                </span>
              </span>
              <UIcon
                :name="advancedOpen ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                class="size-5 shrink-0"
              />
            </button>
            <template #content>
              <div class="grid grid-cols-2 gap-4 pt-4">
                <UFormField
                  label="Only apply after it happens"
                  name="y_operator"
                  help="Leave blank to apply every time the condition matches"
                >
                  <USelect
                    v-model="state.y_operator"
                    :items="operatorOptions"
                    placeholder="Matched at least once"
                    class="w-full"
                    size="lg"
                  />
                </UFormField>
                <UFormField label="Number of times" name="y_value">
                  <UInput
                    v-model="state.y_value"
                    placeholder="Enter threshold"
                    class="w-full"
                    type="number"
                    size="lg"
                  />
                </UFormField>
                <UFormField label="Effective From" name="effective_from" hint="Optional">
                  <UInput
                    v-model="state.effective_from"
                    type="date"
                    class="w-full"
                    size="lg"
                  />
                </UFormField>
                <UFormField label="Effective Until" name="effective_until" hint="Optional">
                  <UInput
                    v-model="state.effective_until"
                    type="date"
                    class="w-full"
                    size="lg"
                  />
                </UFormField>
              </div>
            </template>
          </UCollapsible>

          <div
            v-if="groupId"
            class="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600"
          >
            Group assignment is managed from the main payroll Rules tab.
          </div>

          <div
            class="rounded-xl border border-dashed border-primary/40 bg-primary/5 px-4 py-3 text-sm"
          >
            <p class="font-medium text-primary mb-1">Preview — confirm this reads correctly</p>
            <p v-if="previewText" class="text-gray-700 dark:text-gray-300">
              {{ previewText }}
            </p>
            <p v-else class="text-gray-400 italic">
              Fill in the fields above to preview this rule in plain English.
            </p>
          </div>
        </div>

        <div class="mt-8 flex gap-2 justify-end">
          <UButton color="neutral" class="justify-center" label="Cancel" @click="close" />
          <UButton
            type="submit"
            :loading="submitting"
            :disabled="submitting"
            class="justify-center"
            :label="isEditing ? 'Update' : 'Submit'"
          />
        </div>
      </UForm>
    </template>
  </UModal>
</template>

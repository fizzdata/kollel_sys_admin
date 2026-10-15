<!-- Create/Edit modal for an automatic group-transition rule: move a student
     from one wage group to another once they've spent N months in it. -->
<script setup>
import { number, object, string } from "yup";

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  rule: { type: Object, default: null },
  allGroups: { type: Array, default: () => [] },
  submitting: { type: Boolean, default: false },
});

const emit = defineEmits(["update:modelValue", "submit"]);

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit("update:modelValue", value),
});

const ANY_GROUP = "any";

const getInitialState = (rule) => ({
  from_group_id: rule?.from_group_id ? String(rule.from_group_id) : ANY_GROUP,
  to_group_id: rule?.to_group_id ? String(rule.to_group_id) : "",
  months_in_group: rule?.months_in_group ?? null,
  description: rule?.description || "",
  active: rule?.id ? Boolean(rule.active) : true,
});

const state = reactive(getInitialState(props.rule));

watch(
  () => props.rule,
  (newRule) => {
    Object.assign(state, getInitialState(newRule));
  },
);

const schema = object({
  to_group_id: string().required("Target group is required"),
  months_in_group: number()
    .typeError("Months must be a number")
    .required("Months in group is required")
    .min(1, "Must be at least 1 month"),
});

const fromGroupOptions = computed(() => [
  { label: "Any current group", value: ANY_GROUP },
  ...props.allGroups.map((g) => ({ label: g.name, value: String(g.id) })),
]);

const toGroupOptions = computed(() =>
  props.allGroups.map((g) => ({ label: g.name, value: String(g.id) })),
);

const handleSubmit = (event) => {
  emit("submit", {
    from_group_id:
      event.data.from_group_id === ANY_GROUP
        ? null
        : Number(event.data.from_group_id),
    to_group_id: Number(event.data.to_group_id),
    months_in_group: Number(event.data.months_in_group),
    description: event.data.description || null,
    active: event.data.active,
  });
};
</script>

<template>
  <UModal v-model:open="isOpen" :dismissible="false">
    <template #header>
      <div class="flex justify-between w-full">
        <h2 class="text-xl font-bold text-primary">
          {{ rule?.id ? "Edit Auto-Move Rule" : "Create Auto-Move Rule" }}
        </h2>
        <UButton
          size="sm"
          variant="outline"
          color="primary"
          class="rounded-full p-2"
          icon="i-lucide-x"
          @click="isOpen = false"
        />
      </div>
    </template>

    <template #body>
      <UForm :schema="schema" :state="state" class="space-y-4" @submit="handleSubmit">
        <div class="grid grid-cols-2 gap-4">
          <UFormField label="From Group" name="from_group_id">
            <USelect
              v-model="state.from_group_id"
              :items="fromGroupOptions"
              class="w-full"
              size="lg"
            />
          </UFormField>
          <UFormField label="To Group" name="to_group_id" required>
            <USelect
              v-model="state.to_group_id"
              :items="toGroupOptions"
              placeholder="Select target group"
              class="w-full"
              size="lg"
            />
          </UFormField>
        </div>

        <UFormField
          label="Months in Group"
          name="months_in_group"
          required
          description="Move the student once they've spent this many months in the from-group"
        >
          <UInput
            v-model="state.months_in_group"
            type="number"
            min="1"
            placeholder="e.g. 6"
            class="w-full"
            size="lg"
          />
        </UFormField>

        <UFormField label="Description" name="description">
          <UInput
            v-model="state.description"
            placeholder="Optional note about this rule"
            class="w-full"
            size="lg"
          />
        </UFormField>

        <UFormField label="Active" name="active">
          <USwitch v-model="state.active" />
        </UFormField>

        <div
          class="flex justify-end items-center gap-2 mt-4 border-t border-gray-200 pt-4"
        >
          <UButton
            color="neutral"
            variant="solid"
            label="Cancel"
            @click="isOpen = false"
          />
          <UButton
            type="submit"
            :loading="submitting"
            :disabled="submitting"
            :label="rule?.id ? 'Update Rule' : 'Create Rule'"
          />
        </div>
      </UForm>
    </template>
  </UModal>
</template>

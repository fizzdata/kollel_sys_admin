<script setup>
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  response: { type: Object, default: null },
  questionsById: { type: Object, default: () => ({}) },
});

const emit = defineEmits(["update:modelValue", "saved"]);

const api = useApi();
const toast = useToast();
const isSubmitting = ref(false);
const selectedButton = ref(undefined);

const question = computed(
  () => props.questionsById?.[props.response?.question_id],
);

const options = computed(() => {
  if (!question.value) return [];

  return [1, 2, 3]
    .filter((n) => question.value[`button_text_${n}`])
    .map((n) => ({ label: question.value[`button_text_${n}`], value: n }));
});

watch(
  () => props.response,
  (response) => {
    selectedButton.value = response?.response_button;
  },
  { immediate: true },
);

const close = () => emit("update:modelValue", false);

const onSubmit = async () => {
  if (!selectedButton.value) {
    toast.add({
      title: "Validation Error",
      description: "Please select an answer",
      color: "error",
    });
    return;
  }

  isSubmitting.value = true;

  try {
    const response = await api(
      `/api/students/${props.response.student_id}/responses/${props.response.id}`,
      {
        method: "PUT",
        body: { response_button: selectedButton.value },
      },
    );

    if (response?.success) {
      toast.add({
        title: "Success",
        description: response?.message || "Response updated",
        color: "success",
        duration: 2000,
      });
      emit("saved");
    } else {
      toast.add({
        title: "Failed",
        description: response?.message || "Unable to update response.",
        color: "error",
      });
    }
  } catch (error) {
    console.error("Submission error:", error);
    toast.add({
      title: "Error",
      description: "An unexpected error occurred. Please try again later.",
      color: "error",
    });
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <UModal :open="modelValue" :dismissible="false" @update:open="emit('update:modelValue', $event)">
    <template #header>
      <div class="flex justify-between w-full">
        <h2 class="text-xl font-bold text-primary">Edit Response</h2>
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
      <div class="space-y-4">
        <p class="text-sm font-medium text-gray-700">{{ response?.question }}</p>

        <template v-if="options.length">
          <UFormField label="Answer">
            <USelect
              v-model="selectedButton"
              :items="options"
              class="w-full"
              size="lg"
              placeholder="Select an answer"
            />
          </UFormField>
        </template>
        <p v-else class="text-sm text-gray-500">
          This response can't be edited.
        </p>

        <div
          class="flex justify-end items-center gap-2 mt-4 border-t border-gray-200 pt-4"
        >
          <UButton color="neutral" variant="solid" label="Cancel" @click="close" />
          <UButton
            v-if="options.length"
            :loading="isSubmitting"
            :disabled="isSubmitting"
            label="Save"
            @click="onSubmit"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>

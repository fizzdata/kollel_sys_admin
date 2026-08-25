<!-- Modal for Create/Edit Payee -->
<script setup>
import { object, string } from "yup";

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  selectedPayee: { type: Object, default: () => ({}) },
});

const emit = defineEmits(["update:modelValue", "submit", "cancel"]);

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit("update:modelValue", value),
});

const toast = useToast();
const api = useApi();
const isSubmitting = ref(false);

const getInitialState = (payee = {}) => ({
  id: payee?.id || null,
  name: payee?.name || "",
  default_memo: payee?.default_memo || "",
});

const schema = object({
  name: string().required("Name is required"),
  default_memo: string().nullable(),
});

const state = reactive(getInitialState(props?.selectedPayee));

watch(
  () => props.selectedPayee,
  (newVal) => {
    Object.assign(state, getInitialState(newVal || {}));
  },
  { immediate: true, deep: true },
);

const resetForm = () => {
  Object.assign(state, getInitialState({}));
};

const handleClose = () => {
  resetForm();
  emit("cancel");
};

const handleSubmit = async (event) => {
  isSubmitting.value = true;

  const endpoint = state.id ? `/api/payees/${state.id}` : `/api/payees`;
  const method = state.id ? "PUT" : "POST";

  try {
    const response = await api(endpoint, {
      method: method,
      body: {
        name: event.data.name,
        default_memo: event.data.default_memo,
      },
    });

    if (response?.success) {
      toast.add({
        title: "Success",
        description: response?.message
          ? response?.message
          : state.id
            ? "Payee Updated"
            : "Payee Created",
        color: "success",
        duration: 2000,
      });
      isOpen.value = false;
      emit("submit");
    } else {
      toast.add({
        title: "Failed",
        description:
          response?.message ||
          response?._data?.message ||
          "Something went wrong. Please try again.",
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
    resetForm();
    isSubmitting.value = false;
  }
};
</script>
<template>
  <UModal v-model:open="isOpen">
    <template #header>
      <div class="flex justify-between w-full">
        <h2 class="text-xl font-bold text-primary">
          {{ state?.id ? "Update Payee" : "Create New Payee" }}
        </h2>

        <UButton
          size="sm"
          variant="outline"
          color="primary"
          class="rounded-full p-2"
          icon="i-lucide-x"
          @click="
            () => {
              isOpen = false;
              handleClose();
            }
          "
        />
      </div>
    </template>

    <template #body>
      <UForm
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="handleSubmit"
      >
        <UFormField label="Name" name="name" required>
          <UInput
            v-model="state.name"
            placeholder="Payee Name"
            class="w-full"
            size="lg"
          />
        </UFormField>
        <UFormField label="Default Memo" name="default_memo">
          <UInput
            v-model="state.default_memo"
            placeholder="Default Memo"
            class="w-full"
            size="lg"
          />
        </UFormField>

        <div
          class="flex justify-end items-center gap-2 mt-4 border-t border-gray-200 pt-4"
        >
          <UButton
            color="neutral"
            variant="solid"
            label="Cancel"
            @click="
              () => {
                isOpen = false;
                handleClose();
              }
            "
          />

          <UButton
            type="submit"
            :loading="isSubmitting"
            :disabled="isSubmitting"
            :label="state?.id ? 'Update Payee' : 'Create Payee'"
          />
        </div>
      </UForm>
    </template>
  </UModal>
</template>

<script setup>
import { object, string } from "yup";

const props = defineProps({
  data: Object,
  fetchingSettings: Boolean,
});

const emit = defineEmits(["refresh"]);

const isSubmitting = ref(false);
const api = useApi();
const toast = useToast();

const schema = object({
  check_number: string()
    .required("Check number is required")
    .max(20, "Check number must be at most 20 characters"),

  account_number: string()
    .required("Account number is required")
    .max(30, "Account number must be at most 30 characters"),

  routing_number: string()
    .required("Routing number is required")
    .max(9, "Routing number must be at most 9 characters"),

  bank_name: string()
    .required("Bank name is required")
    .max(100, "Bank name must be at most 100 characters"),
});

const state = reactive({
  check_number: props?.data?.check_number || "",
  account_number: props?.data?.account_number || "",
  routing_number: props?.data?.routing_number || "",
  bank_name: props?.data?.bank_name || "",
});

const onSubmit = async (event) => {
  isSubmitting.value = true;

  const payload = {
    check_number: String(event.data.check_number),
    account_number: String(event.data.account_number),
    routing_number: String(event.data.routing_number),
    bank_name: event.data.bank_name,
  };

  try {
    const response = await api(`/api/payroll/settings`, {
      method: "POST",
      body: payload,
    });

    if (response?.success) {
      toast.add({
        title: "Success",
        description:
          response?.message || "Payroll settings updated successfully",
        color: "success",
        duration: 2000,
      });

      emit("refresh");
    } else if (response?._data?.message) {
      toast.add({
        title: "Failed",
        description: response._data.message,
        color: "error",
      });
    } else {
      toast.add({
        title: "Failed",
        description:
          response?.message || "Something went wrong. Please try again.",
        color: "error",
      });
    }
  } catch (error) {
    toast.add({
      title: "Error",
      description: "An unexpected error occurred.",
      color: "error",
    });
  } finally {
    isSubmitting.value = false;
  }
};

// Watch for changes in initialData
watch(
  () => props.data,
  (newVal) => {
    if (newVal) {
      Object.assign(state, newVal);
    }
  },
  { immediate: true, deep: true },
);
</script>
<template>
  <div
    v-if="fetchingSettings"
    class="flex items-center justify-center pt-10 w-full"
  >
    <BaseSpinner :show-loader="fetchingSettings" size="md" />
  </div>
  <div v-else class="mt-6 flex items-center justify-center px-4">
    <UCard class="w-full max-w-xl rounded-2xl py-6 sm:py-8">
      <h2 class="text-2xl font-semibold text-gray-800 mb-6 text-center">
        Bank Details
      </h2>

      <UForm
        :schema="schema"
        :state="state"
        class="space-y-5"
        @submit="onSubmit"
      >
        <UFormField label="Check Number" name="check_number">
          <UInput
            v-model="state.check_number"
            placeholder="Enter check number"
            size="lg"
            type="text"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Account Number" name="account_number">
          <UInput
            v-model="state.account_number"
            placeholder="Enter account number"
            size="lg"
            type="text"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Routing Number" name="routing_number">
          <UInput
            v-model="state.routing_number"
            placeholder="Enter routing number"
            size="lg"
            type="text"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Bank Name" name="bank_name">
          <UInput
            v-model="state.bank_name"
            placeholder="Enter bank name"
            size="lg"
            type="text"
            class="w-full"
          />
        </UFormField>

        <UButton
          type="submit"
          :loading="isSubmitting"
          :disabled="isSubmitting"
          size="lg"
          block
          class="mt-6"
          label="Submit"
        />
      </UForm>
    </UCard>
  </div>
</template>

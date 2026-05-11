<!-- Modal for Create New Student -->
<script setup>
import { array, mixed, object, string } from "yup";

const props = defineProps({
  modelValue: { type: Boolean, default: false }, // or whatever type
  selectedStudent: { type: Object, default: () => ({}) },
});

const emit = defineEmits(["update:modelValue", "submit", "cancel"]);

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit("update:modelValue", value),
});

const toast = useToast();
const api = useApi();
const fetchingWages = ref(false);
const wageItems = ref([]);
const isSubmitting = ref(false);

const mapStudentWageGroups = (student = {}) => {
  const rawGroups =
    student?.wage_group ||
    student?.wages_group ||
    student?.wages_groups ||
    student?.wage ||
    [];

  const groups = Array.isArray(rawGroups)
    ? rawGroups
    : rawGroups !== null && rawGroups !== undefined && rawGroups !== ""
      ? [rawGroups]
      : [];

  return groups
    .map((item) => {
      if (item && typeof item === "object") {
        return {
          label: item?.name || item?.label || `Group ${item?.id || item?.value}`,
          value: item?.id ?? item?.value,
        };
      }

      return {
        label: `Group ${item}`,
        value: item,
      };
    })
    .filter((item) => item.value !== undefined && item.value !== null);
};

const getInitialState = (student = {}) => ({
  id: student?.id || null,
  first_name: student?.first_name || "",
  last_name: student?.last_name || "",
  first_yiddish_name: student?.first_yiddish_name || "",
  last_yiddish_name: student?.last_yiddish_name || "",
  phone: student?.phone || "",
  address: student?.address || "",
  wage_groups: mapStudentWageGroups(student),
});

const schema = object({
  first_name: string().required("First Name is required"),
  last_name: string().required("Last Name is required"),
  first_yiddish_name: string().required("Yeddish First Name is required"),
  last_yiddish_name: string().required("Yeddish Last Name is required"),
  phone: string()
    .required("Phone is required")
    .matches(/^\d{10}$/, "Phone must be exactly 10 digits"),
  address: string().required("Address is required"),
  wage_groups: array()
    .of(mixed().required())
    .min(1, "At least one wage group is required")
    .required("Wage group is required"),
});

const state = reactive(getInitialState(props?.selectedStudent));

// Watch for changes in initialData
watch(
  () => props.selectedStudent,
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

  const endpoint = state.id ? `/api/students/${state.id}` : `/api/students`;
  const method = state.id ? "PUT" : "POST";
  const wageGroupIds = (event?.data?.wage_groups || [])
    .map((group) => group?.value ?? group)
    .filter((id) => id !== undefined && id !== null && id !== "");

  const payload = {
    ...event.data,
    wage_group: wageGroupIds,
    wage: wageGroupIds,
  };
  delete payload.id;
  delete payload.wage_groups;

  try {
    const response = await api(endpoint, {
      method: method,
      body: payload,
    });

    if (response?.success) {
      toast.add({
        title: "Success",
        description: response?.message
          ? response?.message
          : state.id
            ? "Updated Successfully"
            : "Student added successfully",
        color: "success",
        duration: 2000,
      });
      state.id = null;
      isOpen.value = false;
      emit("submit");
    } else {
      toast.add({
        title: "Failed",
        description:
          response?.message ||
          response._data.message ||
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

const fetchwages = async () => {
  try {
    fetchingWages.value = true;
    const data = await api(`/api/payroll/groups`);
    if (data?.success) {
      wageItems.value = data.wages_groups.map((item) => ({
        label: item.name,
        value: item.id,
      }));
    }
  } catch (err) {
    console.log("🚀 ~ fetchwages ~ err:", err);
    toast.add({
      title: "Error",
      description:
        "An error occurred while fetching payroll groups. Please try again later.",
      color: "error",
      duration: 2000,
    });
  } finally {
    fetchingWages.value = false;
  }
};

onMounted(async () => {
  await fetchwages();
});
</script>
<template>
  <UModal v-model:open="isOpen">
    <!-- Custom Header -->
    <template #header>
      <div class="flex justify-between w-full">
        <h2 class="text-xl font-bold text-primary">
          {{ state?.id ? "Update Student" : "Create New Student" }}
        </h2>

        <!-- Close Button -->
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
      <div
        v-if="fetchingWages"
        class="flex items-center justify-center pt-10 w-full"
      >
        <BaseSpinner :show-loader="fetchingWages" size="md" />
      </div>

      <div v-else>
        <UForm
          :schema="schema"
          :state="state"
          class="space-y-4"
          @submit="handleSubmit"
        >
          <div class="grid grid-cols-2 gap-4">
            <UFormField label="First Name" name="first_name" required>
              <UInput
                v-model="state.first_name"
                placeholder="First Name"
                class="w-full"
                size="lg"
              />
            </UFormField>
            <UFormField label="Last Name" name="last_name" required>
              <UInput
                v-model="state.last_name"
                placeholder="Last Name"
                class="w-full"
                size="lg"
              />
            </UFormField>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <UFormField
              label="Yiddish First Name"
              name="first_yiddish_name"
              required
            >
              <UInput
                v-model="state.first_yiddish_name"
                placeholder="First Name"
                class="w-full"
                size="lg"
              />
            </UFormField>
            <UFormField
              label="Yeddish Last Name"
              name="last_yiddish_name"
              required
            >
              <UInput
                v-model="state.last_yiddish_name"
                placeholder="Last Name"
                class="w-full"
                size="lg"
              />
            </UFormField>
          </div>
          <UFormField label="Phone" name="phone" required>
            <UInput
              v-model="state.phone"
              placeholder="Phone Number"
              class="w-full"
              size="lg"
            />
          </UFormField>
          <UFormField label="Address" name="address" required>
            <UInput
              v-model="state.address"
              placeholder="Address"
              class="w-full"
              size="lg"
            />
          </UFormField>
          <UFormField label="Wage Groups" name="wage_groups" required>
            <USelectMenu
              v-model="state.wage_groups"
              :items="wageItems"
              class="w-full"
              placeholder="Select Wage Groups"
              size="lg"
              multiple
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
              :label="state?.id ? 'Update Student' : 'Create Student'"
            />
          </div>
        </UForm>
      </div>
    </template>
  </UModal>
</template>

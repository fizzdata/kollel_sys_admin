<script setup>
import { object, string, number } from "yup";
import { sec_to_time, formatActualTime } from "~/common/common";

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  studentId: { type: Number, default: null },
  studentsData: { type: Array, default: () => [] },
});

const emit = defineEmits(["update:modelValue", "saved"]);

const api = useApi();
const toast = useToast();
const isSubmitting = ref(false);
const datePickerOpen = ref(false);

const state = reactive({
  id: undefined,
  student_id: undefined,
  day: undefined,
  in: undefined,
  out: undefined,
  user: undefined,
  actual_in: undefined,
  actual_out: undefined,
});

const resetForm = () => {
  state.id = undefined;
  state.student_id = undefined;
  state.day = undefined;
  state.in = undefined;
  state.out = undefined;
  state.user = undefined;
  state.actual_in = undefined;
  state.actual_out = undefined;
};

function timestampToHms(timestamp) {
  if (!timestamp) return null;
  const date = new Date(timestamp.replace(" ", "T"));
  if (isNaN(date.getTime())) return null;

  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

// Only worth showing when it differs from the currently-saved in/out
// (i.e. the record has since been edited away from the original punch).
const originalPunchLabel = computed(() => {
  if (!state.id) return null;

  const inEdited = state.actual_in && timestampToHms(state.actual_in) !== state.in;
  const outEdited = state.actual_out && timestampToHms(state.actual_out) !== state.out;

  if (!inEdited && !outEdited) return null;

  const parts = [];
  if (inEdited) parts.push(`In: ${formatActualTime(state.actual_in)}`);
  if (outEdited) parts.push(`Out: ${formatActualTime(state.actual_out)}`);

  return parts.join(", ");
});

const schema = object({
  student_id: number()
    .typeError("User is required")
    .required("User is required"),
  day: string()
    .matches(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
    .required("Date is required"),
  in: string()
    .matches(
      /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/,
      "In Time must be HH:mm:ss",
    )
    .required("In Time is required"),
  out: string()
    .matches(
      /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/,
      "Out Time must be HH:mm:ss",
    )
    .required("Out Time is required"),
});

// session: { id, in, out, student_id } or null (full create); day: "YYYY-MM-DD"; label: optional display text
const open = (session = null, day = null, label = "") => {
  state.id = session?.id ?? undefined;
  state.student_id = props.studentId ?? session?.student_id ?? undefined;
  state.day = day ?? session?.day ?? undefined;
  state.in = session?.in != null ? sec_to_time(session.in, false) : undefined;
  state.out =
    session?.out != null ? sec_to_time(session.out, false) : undefined;
  state.user = label;
  state.actual_in = session?.actual_in ?? undefined;
  state.actual_out = session?.actual_out ?? undefined;

  emit("update:modelValue", true);
};

defineExpose({ open });

const close = () => {
  emit("update:modelValue", false);
  resetForm();
};

const onSubmit = async (event) => {
  isSubmitting.value = true;

  const endpoint = state.id ? `/api/clockings/${state.id}` : `/api/clockings`;
  const method = state.id ? "PUT" : "POST";

  const payload = state.id
    ? {
        in: event.data.in,
        out: event.data.out,
      }
    : {
        in: event.data.in,
        out: event.data.out,
        student_id: event.data.student_id,
        day: event.data.day,
      };

  try {
    const response = await api(endpoint, {
      method,
      body: payload,
    });

    if (response?.success) {
      toast.add({
        title: "Success",
        description: response?.message
          ? response?.message
          : state.id
            ? "Successfully Updated"
            : "Successfully Created",
        color: "success",
        duration: 2000,
      });
      emit("saved");
      close();
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
    isSubmitting.value = false;
  }
};
</script>

<template>
  <UModal :open="modelValue" :dismissible="false" @update:open="emit('update:modelValue', $event)">
    <template #header>
      <div class="flex justify-between w-full">
        <h2 class="text-xl font-bold text-primary">
          {{ state?.id ? "Edit: " + state.user : "Create New Clockings" }}
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
      <UForm
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <div v-if="!studentId && !state.id" class="flex flex-col gap-4">
          <UFormField label="Student" name="student_id" required>
            <USelect
              v-model.number="state.student_id"
              :items="studentsData"
              class="w-full"
              size="lg"
              placeholder="Select Student"
              required
            />
          </UFormField>
          <UFormField label="Day" name="day">
            <UPopover class="w-full" v-model:open="datePickerOpen" required>
              <UButton
                color="neutral"
                variant="outline"
                icon="i-lucide-calendar"
                size="lg"
              >
                {{
                  state?.day
                    ? state.day
                    : "Select a date"
                }}
              </UButton>

              <template #content>
                <UCalendar
                  v-model="state.day"
                  class="p-2"
                  @update:model-value="datePickerOpen = false"
                />
              </template>
            </UPopover>
          </UFormField>
        </div>

        <div v-if="studentId" class="text-sm font-medium text-gray-500 -mb-2">
          {{ state.day }}
        </div>

        <div class="grid grid-cols-2 mb-6 place-items-center">
          <UFormField label="In" class="flex gap-4 items-center" required>
            <UInput
              v-model="state.in"
              type="time"
              step="1"
              class="w-full"
              size="lg"
              required
            />
          </UFormField>

          <UFormField label="Out" class="flex gap-4 items-center" required>
            <UInput
              v-model="state.out"
              type="time"
              step="1"
              class="w-full"
              size="lg"
              required
            />
          </UFormField>
        </div>

        <div v-if="originalPunchLabel" class="text-xs text-amber-600 -mt-4 mb-4">
          Originally recorded: {{ originalPunchLabel }}
        </div>

        <div
          class="flex justify-end items-center gap-2 mt-4 border-t border-gray-200 pt-4"
        >
          <UButton
            color="neutral"
            variant="solid"
            label="Cancel"
            @click="close"
          />

          <UButton
            type="submit"
            :loading="isSubmitting"
            :disabled="isSubmitting"
            :label="state?.id ? 'Edit Clockings' : 'Create Clockings'"
          />
        </div>
      </UForm>
    </template>
  </UModal>
</template>

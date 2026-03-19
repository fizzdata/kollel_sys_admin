<script setup>
const props = defineProps({
  modelValue: { type: Boolean, default: false },
});
const emit = defineEmits(["update:modelValue", "submit", "cancel"]);

const isOpen = computed({
  get: () => props.modelValue,
  set: (v) => emit("update:modelValue", v),
});

const api = useApi();
const toast = useToast();

const isSubmitting = ref(false);
const students = ref([]);
const loadingStudents = ref(false);

const state = reactive({
  pay_to: "",
  check_date: "",
  amount: null,
  memo: "",
  student_id: null,
});

const studentItems = computed(() =>
  students.value.map((s) => ({ label: `${s.first_name} ${s.last_name}`, value: s.id })),
);

const resetForm = () => {
  state.pay_to = "";
  state.check_date = "";
  state.amount = null;
  state.memo = "";
  state.student_id = null;
};

const fetchStudents = async () => {
  loadingStudents.value = true;
  try {
    const res = await api(`/api/students`);
    if (res?.success) {
      students.value = res.students || res.students || res;
    } else {
      students.value = [];
    }
  } catch (e) {
    students.value = [];
  } finally {
    loadingStudents.value = false;
  }
};

onMounted(() => {
  fetchStudents();
});

const handleCancel = () => {
  resetForm();
  isOpen.value = false;
  emit("cancel");
};

const handleSubmit = async () => {

if (!state.student_id) {
    toast.add({ title: "Error", description: "Please select a student.", color: "error" });
    return;
  }

    if (!state.pay_to) {
    toast.add({ title: "Error", description: "Please enter pay to.", color: "error" });
    return;
  }

  if(!state.check_date) {
    toast.add({ title: "Error", description: "Please select check date.", color: "error" });
    return;
  }

  if (!state.amount || isNaN(state.amount) || Number(state.amount) <= 0) {
    toast.add({ title: "Error", description: "Please enter a valid amount.", color: "error" });
    return;
  }

   

  isSubmitting.value = true;
  try {
    const body = {
      pay_to: state.pay_to,
      check_date: state.check_date,
      amount: Number(state.amount),
      memo: state.memo || null,
      student_id: state.student_id,
    };

    const response = await api(`/api/checks`, { method: "POST", body });

    if (response?.success) {
      toast.add({ title: "Success", description: response.message || "Check created", color: "success" });
      resetForm();
      isOpen.value = false;
      emit("submit", response);
    } else {
      toast.add({ title: "Error", description: response?.message || "Failed to create check", color: "error" });
    }
  } catch (e) {
    toast.add({ title: "Error", description: "Failed to create check", color: "error" });
  } finally {
    isSubmitting.value = false;
    //close modal
    isOpen.value = false;
    emit("cancel");

  }
};
</script>

<template>
  <UModal v-model:open="isOpen">
    <template #header>
      <div class="flex justify-between w-full items-center">
        <div class="flex items-center gap-3">
          <h3 class="text-lg font-semibold">Create Check</h3>
        </div>

        <UButton
          size="sm"
          variant="outline"
          color="primary"
          class="rounded-full p-2"
          icon="i-lucide-x"
          @click="handleCancel"
        />
      </div>
    </template>

    <template #body>

      <USelect
          v-model="state.student_id"
          :items="studentItems"
          label="Student"
          placeholder="Select student"
          :loading="loadingStudents"
        />
  

      <div class="space-y-4 p-4">
        <UInput v-model="state.pay_to" label="Pay To" placeholder="Pay To" />

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <UInput v-model="state.check_date" type="date" label="Check Date" />
          <UInput v-model="state.amount" type="number" label="Amount" placeholder="0.00" />
        </div>

        
        <UInput v-model="state.memo" label="Memo" placeholder="Optional memo" />
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton variant="outline" color="neutral" @click="handleCancel">Cancel</UButton>
        <UButton :loading="isSubmitting" color="primary" @click="handleSubmit">Create</UButton>
      </div>
    </template>
  </UModal>
</template>

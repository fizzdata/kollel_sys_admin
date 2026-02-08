<script setup>
const props = defineProps({
  students: { type: Array, default: [] }, // or whatever type
  fetchingGroupStudents: { type: Boolean, default: false },
  metricLabels: Object,
  operaterLabels: Object,
});

const emit = defineEmits(["refresh", "preview", "check", "deposit"]);
const route = useRoute();

const selectedStudent = ref(null);
const isStudentDeleting = ref(false);

const api = useApi();
const toast = useToast();
const isDeleteStudentModalOpen = ref(false);

const handleRemoveStudent = async (student) => {
  selectedStudent.value = student;
  isDeleteStudentModalOpen.value = true;
};

const confirmDeleteStudent = async () => {
  try {
    isStudentDeleting.value = true;
    const response = await api(
      `/api/payroll/students/${selectedStudent.value.id}/group/${route.params.id}`,
      {
        method: "DELETE",
      },
    );

    if (response?.success) {
      toast.add({
        title: "Success",
        description:
          response?.message || "Student removed from group successfully",
        color: "success",
        duration: 2000,
      });
      isDeleteStudentModalOpen.value = false;
      emit("refresh");
    } else {
      toast.add({
        title: "Failed",
        description:
          response?._data.errors ||
          response?._data.message ||
          "Failed to delete Rules",
        color: "error",
        duration: 2000,
      });
    }
  } catch (error) {
    console.error("Error deleting Rules:", error);
    toast.add({
      title: "Error",
      description:
        "An error occurred while removing student from group. Please try again later.",
      color: "error",
      duration: 2000,
    });
  } finally {
    isStudentDeleting.value = false;
  }
};

const studentColumns = [
  { accessorKey: "first_yiddish_name", header: "First Yiddish Name" },
  { accessorKey: "last_yiddish_name", header: "Last Yiddish Name" },
  {
    header: "Quick Actions",
    cell: ({ row }) =>
      h("div", { class: "flex gap-2 items-center" }, [
        // Preview Student Button
        h(
          resolveComponent("UTooltip"),
          { text: "Preview Student" },
          {
            default: () =>
              h(resolveComponent("UButton"), {
                icon: "i-lucide-user-check",
                size: "md",
                color: "success",
                variant: "soft",
                onClick: () => emit("preview", row.original),
              }),
          },
        ),

        // Process Check Button
        h(
          resolveComponent("UTooltip"),
          { text: "Process Check" },
          {
            default: () =>
              h(resolveComponent("UButton"), {
                icon: "i-lucide-check-square",
                size: "md",
                color: "info",
                variant: "soft",
                onClick: () => emit("check", row.original),
              }),
          },
        ),

        // Process Depost Button
        h(
          resolveComponent("UTooltip"),
          { text: "Process Depost" },
          {
            default: () =>
              h(resolveComponent("UButton"), {
                icon: "i-lucide-wallet",
                size: "md",
                color: "warning",
                variant: "soft",
                onClick: () => emit("deposit", row.original),
              }),
          },
        ),

        // Edit Student Button
        h(
          resolveComponent("UTooltip"),
          { text: "Remove Student" },
          {
            default: () =>
              h(resolveComponent("UButton"), {
                icon: "i-lucide-trash-2",
                size: "md",
                color: "error",
                variant: "soft",
                loading:
                  isStudentDeleting.value &&
                  selectedStudent.value === row.original.id,
                disabled: isStudentDeleting.value,
                onClick: () => handleRemoveStudent(row.original),
              }),
          },
        ),
      ]),
  },
];
</script>

<template>
  <!-- Students Table -->

  <UTable
    :columns="studentColumns"
    :loading="fetchingGroupStudents"
    :data="students"
    class="flex-1 mt-6"
  />

  <!-- Delete Student confirm modal -->
  <UModal
    v-model:open="isDeleteStudentModalOpen"
    title="Confirm Delete Student"
    :close="{
      color: 'primary',
      variant: 'outline',
      class: 'rounded-full',
    }"
  >
    <template #body>
      <div>
        <p>
          Are you sure you want to delete this
          <strong v-if="selectedStudent">
            {{
              selectedStudent?.first_yiddish_name +
              " " +
              selectedStudent?.last_yiddish_name
            }}
          </strong>
          student from this group?
        </p>
      </div>
      <div
        class="flex gap-2 justify-end items-center border-t border-gray-200 mt-4"
      >
        <UButton
          color="neutral"
          variant="solid"
          class="mt-4"
          label="Cancel"
          @click="isDeleteStudentModalOpen = false"
        />

        <UButton
          color="error"
          variant="solid"
          class="mt-4"
          label="Delete"
          :loading="isStudentDeleting"
          :disabled="isStudentDeleting"
          @click="confirmDeleteStudent()"
        />
      </div>
    </template>
  </UModal>
</template>

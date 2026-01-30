<script setup>
import { today, getLocalTimeZone } from "@internationalized/date";
const props = defineProps({
  students: { type: Array, default: [] }, // or whatever type
  fetchingGroupStudents: { type: Boolean, default: false },
  metricLabels: Object,
  operaterLabels: Object,
});

const { $printJS } = useNuxtApp();

const emit = defineEmits(["refresh"]);
// Get today's date
const todayDate = today(getLocalTimeZone());

// Get date 7 days ago
const fromDate = todayDate.subtract({ days: 7 });

const calendarRange = ref({
  start: fromDate,
  end: todayDate,
});

const route = useRoute();

const selectedStudent = ref(null);
const isStudentDeleting = ref(false);

const api = useApi();
const toast = useToast();
const studentPreviewRulesAllGroupModal = ref(false);
const processStudentAllGroupCheckModal = ref(false);
const processStudentAllGroupDepositModal = ref(false);
const previewStudentRulesAllGroupLoading = ref(false);
const processChecksAllGroupLoading = ref(false);
const processDepostAllGroupLoading = ref(false);
const previewStudentRulesAllGroups = ref([]);
const isDeleteStudentModalOpen = ref(false);

const fetchStudentPreviewRulesAllGroups = async (data) => {
  try {
    if (selectedStudent.value) {
      previewStudentRulesAllGroupLoading.value = true;
      const response = await api(
        `/api/payroll/students/${selectedStudent.value.id}/preview`,
        {
          method: "GET",
          params: {
            from_date: data?.from_date,
            till_date: data?.till_date,
          },
        },
      );

      if (response?.success) {
        previewStudentRulesAllGroups.value = Array.isArray(response.data)
          ? response.data
          : Object.values(response.data || {}).flatMap((item) =>
              Object.values(item || {}),
            );
        console.log(
          "🚀 ~ fetchStudentPreviewRulesAllGroups ~ previewStudentRulesAllGroups.value:",
          previewStudentRulesAllGroups.value,
        );
      }
    }
  } catch (error) {
    console.error("Error deleting Rules:", error);
  } finally {
    previewStudentRulesAllGroupLoading.value = false;
  }
};

const fetchStudentAllGroupCheck = async (data) => {
  try {
    if (selectedStudent.value) {
      processChecksAllGroupLoading.value = true;
      const response = await api(
        `/api/payroll/students/${selectedStudent.value.id}/process/check`,
        {
          method: "POST",
          params: {
            from_date: data?.from_date,
            till_date: data?.till_date,
          },
        },
      );

      if (response?.success) {
        const fileURL = response.data["1"];
        console.log("🚀 ~ fetchStudentAllGroupCheck ~ fileURL:", fileURL);

        $printJS({
          printable: fileURL,
          type: "pdf",
          base64: true,
        });

        processStudentAllGroupCheckModal.value = false;
      }
    }
  } catch (error) {
    console.error("Error deleting Rules:", error);
  } finally {
    processChecksAllGroupLoading.value = false;
  }
};

const fetchStudentAllGroupDeposit = async (data) => {
  try {
    if (selectedStudent.value) {
      processDepostAllGroupLoading.value = true;
      const response = await api(
        `/api/payroll/students/${selectedStudent.value.id}/process/deposit`,
        {
          method: "POST",
          params: {
            from_date: data?.from_date,
            till_date: data?.till_date,
          },
        },
      );

      if (response?.success) {
        toast.add({
          title: "Success",
          description: response?.message || "Direct deposit processing started",
          color: "success",
          duration: 2000,
        });
        processStudentAllGroupDepositModal.value = false;
      } else {
        toast.add({
          title: "Failed",
          description:
            response?.message ||
            response?._data.errors ||
            response?._data.message ||
            "Failed to delete group",
          color: "error",
          duration: 2000,
        });
      }
    }
  } catch (error) {
    console.error("Error deleting Rules:", error);
  } finally {
    processDepostAllGroupLoading.value = false;
  }
};

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
  } finally {
    isStudentDeleting.value = false;
  }
};

const handlePreviewStudentRulesAllGroup = async (student) => {
  selectedStudent.value = student;
  studentPreviewRulesAllGroupModal.value = true;
  await fetchStudentPreviewRulesAllGroups({
    from_date: calendarRange.value.start?.toString(),
    till_date: calendarRange.value.end?.toString(),
  });
};

const handleStudentAllGroupProcessCheckClick = async (student) => {
  selectedStudent.value = student;
  processStudentAllGroupCheckModal.value = true;
};

const handleStudentAllGroupProcessDepositClick = async (student) => {
  selectedStudent.value = student;
  processStudentAllGroupDepositModal.value = true;
};

const onDateChange = async (val) => {
  if (!val?.start || !val?.end) return;

  await fetchStudentPreviewRulesAllGroups({
    from_date: val.start.toString(),
    till_date: val.end.toString(),
  });
};

const onAllGroupCheckDateChange = async (val) => {
  if (!val?.from_date || !val?.till_date) {
    toast.add({
      title: "Error",
      description: "Please select a valid date range.",
      color: "error",
    });
  }

  await fetchStudentAllGroupCheck({
    ...val,
  });
};

const onAllGroupDepositFormSubmit = async (val) => {
  if (!val?.from_date || !val?.till_date) {
    toast.add({
      title: "Error",
      description: "Please select a valid date range.",
      color: "error",
    });
  }

  await fetchStudentAllGroupDeposit({
    ...val,
  });
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
                onClick: () => handlePreviewStudentRulesAllGroup(row.original),
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
                onClick: () =>
                  handleStudentAllGroupProcessCheckClick(row.original),
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
                onClick: () =>
                  handleStudentAllGroupProcessDepositClick(row.original),
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
  <div>
    <UTable
      :columns="studentColumns"
      :loading="fetchingGroupStudents"
      :data="students"
      class="flex-1 mt-6"
    />
  </div>

  <!-- Student Processing Rules Modal -->
  <CommonRulesModal
    v-model="studentPreviewRulesAllGroupModal"
    :title="
      selectedStudent
        ? `${selectedStudent.first_yiddish_name} ${selectedStudent.last_yiddish_name} : All Groups Student Processing Rules`
        : 'All Groups Student Processing Rules'
    "
    :rules="previewStudentRulesAllGroups"
    :loading="previewStudentRulesAllGroupLoading"
    :metric-labels="metricLabels"
    :operater-labels="operaterLabels"
    type="process"
    @date-change="onDateChange"
  />

  <!-- Student Processing Check Modal -->
  <CommonChecksDepositModal
    v-model="processStudentAllGroupCheckModal"
    :title="
      selectedStudent
        ? `${selectedStudent.first_yiddish_name} ${selectedStudent.last_yiddish_name} : All Groups Student Process Checks`
        : 'All Groups Student Process Checks'
    "
    :loading="processChecksAllGroupLoading"
    type="check"
    isStudent
    @submit="onAllGroupCheckDateChange"
  />

  <!-- Student Processing Deposit Modal -->
  <CommonChecksDepositModal
    v-model="processStudentAllGroupDepositModal"
    :title="
      selectedStudent
        ? `${selectedStudent.first_yiddish_name} ${selectedStudent.last_yiddish_name} : All Groups Student Process Deposit`
        : 'All Groups Student Process Deposit'
    "
    :loading="processDepostAllGroupLoading"
    type="deposit"
    isStudent
    @submit="onAllGroupDepositFormSubmit"
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

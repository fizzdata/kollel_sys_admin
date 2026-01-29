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
const payrollId = route.params.id;
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

const processGroupStudentModal = ref(false);
const processGroupRules = ref([]);
const singleStudentCheckModal = ref(false);
const processCheckSingleStudentLoading = ref(false);
const singleStudentDepositModal = ref(false);
const processDepositSingleStudentLoading = ref(false);

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

// single student check
const fetchSingleStudentCheck = async (data) => {
  try {
    if (selectedStudent.value) {
      processCheckSingleStudentLoading.value = true;
      const response = await api(
        `/api/payroll/group/${payrollId}/student/${selectedStudent.value.id}/process/checks`,
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

        $printJS({
          printable: fileURL,
          type: "pdf",
          base64: true,
        });

        singleStudentCheckModal.value = false;
      }
    }
  } catch (error) {
    console.error("Error deleting Rules:", error);
  } finally {
    processCheckSingleStudentLoading.value = false;
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

const fetchSingleStudentDeposit = async (data) => {
  try {
    if (selectedStudent.value) {
      processDepositSingleStudentLoading.value = true;
      const response = await api(
        `/api/payroll/group/${payrollId}/student/${selectedStudent.value.id}/process/deposit`,
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
        singleStudentDepositModal.value = false;
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
    processDepositSingleStudentLoading.value = false;
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
    isDeleteStudentModalOpen.value = false;
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

const handleSingleStudentCheckClick = async (student) => {
  selectedStudent.value = student;
  singleStudentCheckModal.value = true;
};

const handleSingleStudentDepositClick = async (student) => {
  selectedStudent.value = student;
  singleStudentDepositModal.value = true;
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

// single student check date change
const onSingleGroupCheckDateChange = async (val) => {
  if (!val?.from_date || !val?.till_date) {
    toast.add({
      title: "Error",
      description: "Please select a valid date range.",
      color: "error",
    });
  }

  await fetchSingleStudentCheck({
    ...val,
  });
};

// single student deposit date change
const onSingleGroupDepositDateChange = async (val) => {
  if (!val?.from_date || !val?.till_date) {
    toast.add({
      title: "Error",
      description: "Please select a valid date range.",
      color: "error",
    });
  }

  await fetchSingleStudentDeposit({
    ...val,
  });
};
</script>

<template>
  <!-- Students Table -->
  <div>
    <div
      v-if="fetchingGroupStudents"
      class="flex items-center justify-center pt-10 w-full"
    >
      <BaseSpinner :show-loader="fetchingGroupStudents" size="md" />
    </div>

    <div
      v-else-if="students?.length > 0"
      class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5"
    >
      <UCard
        v-for="student in students"
        :key="student.id"
        class="group relative"
      >
        <!-- Header -->
        <template #header>
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-base font-semibold text-gray-900">
                {{ student.first_yiddish_name }} {{ student.last_yiddish_name }}
              </h3>
              <p class="text-xs text-gray-500">Student Processing</p>
            </div>

            <UButton
              icon="i-lucide-trash-2"
              size="xs"
              color="error"
              variant="ghost"
              :loading="isStudentDeleting && selectedStudent === student.id"
              :disabled="isStudentDeleting"
              @click="handleRemoveStudent(student)"
            />
          </div>
        </template>

        <!-- All Groups -->
        <div class="space-y-2">
          <p class="text-xs font-medium text-gray-500 uppercase">All Groups</p>

          <div class="grid grid-cols-1 gap-2">
            <UButton
              icon="i-lucide-user-check"
              variant="soft"
              size="sm"
              label="Preview Rules"
              @click="handlePreviewStudentRulesAllGroup(student)"
            />

            <div class="grid grid-cols-2 gap-2">
              <UButton
                icon="i-lucide-check-square"
                variant="soft"
                size="sm"
                color="info"
                label="Check"
                @click="handleStudentAllGroupProcessCheckClick(student)"
              />

              <UButton
                icon="i-lucide-wallet"
                variant="soft"
                size="sm"
                color="warning"
                label="Deposit"
                @click="handleStudentAllGroupProcessDepositClick(student)"
              />
            </div>
          </div>
        </div>

        <USeparator class="my-4" />

        <!-- Single Student -->
        <div class="space-y-2">
          <p class="text-xs font-medium text-gray-500 uppercase">
            Single Student
          </p>

          <UButton
            icon="i-lucide-user-check"
            variant="soft"
            size="sm"
            class="w-full"
            label="Preview Rules"
            disabled
          />

          <div class="grid grid-cols-2 gap-2">
            <UButton
              icon="i-lucide-check-square"
              variant="soft"
              size="sm"
              color="info"
              label="Check"
              @click="handleSingleStudentCheckClick(student)"
            />

            <UButton
              icon="i-lucide-wallet"
              variant="soft"
              size="sm"
              color="warning"
              label="Deposit"
              @click="handleSingleStudentDepositClick(student)"
            />
          </div>
        </div>
      </UCard>
    </div>

    <div v-else class="text-center text-gray-500">
      No Student found in this group. Click <strong>Add Student</strong> button
      to add student in this group.
    </div>
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

  <!-- Single Student Processing Check Modal -->
  <CommonChecksDepositModal
    v-model="singleStudentCheckModal"
    :title="
      selectedStudent
        ? `${selectedStudent.first_yiddish_name} ${selectedStudent.last_yiddish_name} : Single Student Process Checks`
        : 'Single Student Process Checks'
    "
    :loading="processCheckSingleStudentLoading"
    type="check"
    isStudent
    @submit="onSingleGroupCheckDateChange"
  />

  <!-- Single Student Processing Deposit Modal -->
  <CommonChecksDepositModal
    v-model="singleStudentDepositModal"
    :title="
      selectedStudent
        ? `${selectedStudent.first_yiddish_name} ${selectedStudent.last_yiddish_name} : Single  Student Process Deposit`
        : 'Single  Student Process Deposit'
    "
    :loading="processDepositSingleStudentLoading"
    type="deposit"
    isStudent
    @submit="onSingleGroupDepositDateChange"
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

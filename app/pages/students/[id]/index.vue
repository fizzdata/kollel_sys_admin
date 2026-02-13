<script setup>
import { secondsToAmPm, secondsToPercent } from "~/common/common";

definePageMeta({
  layout: "sidebar",
  middleware: ["auth"],
});

const route = useRoute();
const studentId = route.params.id;
const loading = ref(false);
const api = useApi();
const student = ref({});
const showModal = ref(false);
const selectedStudent = ref(null);
const activeTab = ref("0");
const toast = useToast();

const clockingsData = ref([]);
const transactionsData = ref([]);
const responsesData = ref([]);
const checksData = ref([]);

const tabs = [
  { label: "Clockings", key: "clockings", icon: "i-lucide-clock" },
  { label: "Deposits", key: "transactions", icon: "i-lucide-credit-card" },
  { label: "Checks", key: "checks", icon: "i-lucide-file-check" },
  { label: "Responses", key: "responses", icon: "i-lucide-help-circle" },
];

const normalizeClockings = (clockings) => {
  if (!clockings) return [];

  return Object.values(clockings).map((dayEntry) => {
    // Normalize clocking to array
    const sessions = Array.isArray(dayEntry.clocking)
      ? dayEntry.clocking
      : Object.values(dayEntry.clocking || {});

    const row = {
      day: dayEntry.day,

      morning_in: "-",
      morning_out: "-",
      retzifus_morning: "-",
      total_morning: "-",

      afternoon_in: "-",
      afternoon_out: "-",
      retzifus_evening: "-",
      total_afternoon: "-",
    };

    sessions.forEach((s) => {
      if (s.session === 1) {
        row.morning_in = secondsToAmPm(s.in);
        row.morning_out = secondsToAmPm(s.out);
        row.retzifus_morning = s.retzifus === 0 ? "NO" : "-";
        row.total_morning = secondsToPercent(s.out - s.in, s.schedule_total);
      }

      if (s.session === 2) {
        row.afternoon_in = secondsToAmPm(s.in);
        row.afternoon_out = secondsToAmPm(s.out);
        row.retzifus_evening = s.retzifus === 0 ? "NO" : "-";
        row.total_afternoon = secondsToPercent(s.out - s.in, s.schedule_total);
      }
    });

    return row;
  });
};

const fetchStudentDetail = async (refresh = false) => {
  try {
    if (refresh) {
      loading.value = true;
    }

    const response = await api(`/api/students/${studentId}`);

    if (response) {
      student.value = response;
      clockingsData.value = normalizeClockings(response?.clockings);
      transactionsData.value = response?.transactions;
      responsesData.value = response?.Student_responses;
      checksData.value = response?.checks;
    }
  } catch (err) {
    console.log("🚀 ~ fetchStudentDetail ~ err:", err);
    toast.add({
      description: "Error fetching students. Please try again later.",
      color: "error",
      timeout: 3000,
    });
  } finally {
    if (refresh) {
      loading.value = false;
    }
  }
};

const onSubmit = async () => {
  await fetchStudentDetail(true);
};

const handleCancel = () => {
  showModal.value = false;
};

const transactionsColumns = [
  { accessorKey: "date", header: "Date" },
  {
    accessorKey: "amount",
    header: "Amount",
    cell: ({ row }) => {
      const val = row.original.amount;
      return `$${val}`;
    },
  },
  { accessorKey: "description", header: "Description" },
];
const checksColumns = [
  {
    accessorKey: "student_id",
    header: "Name",
    cell: ({ row }) => {
      return (
        student.value?.Student?.first_name +
        " " +
        student.value?.Student?.last_name
      );
    },
  },
  {
    accessorKey: "amount",
    header: "Amount",
    cell: ({ row }) => {
      const val = row.original.amount;
      return `$${val}`;
    },
  },
  { accessorKey: "check_date", header: "Check Date" },
  { accessorKey: "check_number", header: "Check Number" },
  {
    accessorKey: "cleared",
    header: "Cleared",
    cell: ({ row }) =>
      h(
        resolveComponent("UBadge"),
        {
          color: row.original.cleared ? "success" : "warning",
          variant: "solid",
          size: "sm",
        },
        () => (row.original.cleared === 1 ? "Paid" : "Not Paid"),
      ),
  },
  { accessorKey: "pay_to", header: "Pay To" },
];

const responsesColumns = [
  { accessorKey: "date", header: "Date" },
  { accessorKey: "question", header: "Question" },
  { accessorKey: "answer", header: "Answer" },
];

const handleEditClick = (student) => {
  selectedStudent.value = student;
  showModal.value = true;
};

const toggleStudentStatus = async (student) => {
  // toggle locally
  const newStatus = !student.active;
  student.active = newStatus;

  try {
    const response = await api(`/api/students/${student.id}/status`, {
      method: "PATCH",
      body: {
        active: newStatus,
      },
    });

    if (response?.success) {
      toast.add({
        title: "Success",
        description:
          response?.message ||
          `Student ${newStatus ? "activated" : "deactivated"} successfully.`,
        color: "success",
        duration: 2000,
      });

      await fetchStudentDetail(false);
    } else {
      toast.add({
        title: "Failed",
        description: response?.message || "Unable to switch state.",
        color: "error",
        duration: 2000,
      });

      await fetchStudentDetail(false);
    }
  } catch (error) {
    console.error("Submission error:", error);
    toast.add({
      title: "Error",
      description: "An unexpected error occurred. Please try again later.",
      color: "error",
    });
  }
};

const handleResetPasswordClick = async (student) => {
  try {
    const response = await api(`/api/students/reset-passwords`, {
      method: "POST",
      body: {
        id: student.id,
      },
    });

    if (response?.success) {
      toast.add({
        title: "Success",
        description: response?.message || "Password reset successfully.",
        color: "success",
        duration: 2000,
      });
    } else {
      toast.add({
        title: "Failed",
        description:
          response?.message ||
          response?._data.message ||
          "Unable to reset password. Please try again later.",
        color: "error",
        duration: 2000,
      });
    }
  } catch (error) {
    console.error("Submission error:", error);
    toast.add({
      title: "Error",
      description: "An unexpected error occurred. Please try again later.",
      color: "error",
    });
  }
};
onMounted(async () => {
  await fetchStudentDetail(true);
});
</script>

<template>
  <div>
    <div
      class="flex flex-col md:flex-row md:justify-between items-center gap-4"
    >
      <div class="flex items-start w-full md:w-fit">
        <UButton
          variant="outline"
          color="primary"
          to="/students"
          icon="i-lucide-arrow-left"
          class="w-fit"
          label="Back to Students"
        />
      </div>
      <div class="flex items-center">
        <div class="flex items-center divide-x divide-gray-300">
          <div class="px-1">
            <UButton
              v-if="student?.previous"
              variant="link"
              color="neutral"
              :to="`/students/${student?.previous?.id}`"
              icon="i-lucide-arrow-left"
              :label="
                student?.previous?.first_yiddish_name +
                ' ' +
                student?.previous?.last_yiddish_name
              "
            />
          </div>

          <div class="px-1">
            <UButton
              v-if="student?.next"
              variant="link"
              color="neutral"
              :to="`/students/${student?.next?.id}`"
              trailing-icon="i-lucide-arrow-right"
              :label="
                student?.next?.first_yiddish_name +
                ' ' +
                student?.next?.last_yiddish_name
              "
            />
          </div>
        </div>
      </div>
    </div>

    <div v-if="loading" class="flex items-center justify-center pt-10 w-full">
      <BaseSpinner :show-loader="loading" size="md" />
    </div>
    <div
      v-else-if="student?.Student && Object.keys(student?.Student).length > 0"
    >
      <UCard class="rounded-2xl shadow-sm mt-6">
        <div class="flex items-center gap-6">
          <UAvatar
            size="3xl"
            :alt="
              student?.Student?.first_name + ' ' + student?.Student?.last_name
            "
          />

          <div class="flex-1">
            <div class="flex justify-between">
              <h2 class="md:text-xl text-base font-semibold">
                {{
                  student?.page_title ||
                  student?.Student?.first_name +
                    " " +
                    student?.Student?.last_name
                }}
              </h2>
              <UBadge
                :color="student?.Student?.active === 0 ? 'error' : 'success'"
                variant="soft"
              >
                {{ student?.Student?.active === 0 ? "Inactive" : "Active" }}
              </UBadge>
            </div>

            <p class="text-sm text-gray-500">
              {{
                student?.Student?.first_yiddish_name +
                " " +
                student?.Student?.last_yiddish_name
              }}
            </p>

            <div class="mt-2 grid grid-cols-1 gap-2 text-sm">
              <p>
                <span class="font-medium">Phone:</span>
                {{ student?.Student?.phone }}
              </p>
              <p>
                <span class="font-medium">Address:</span>
                {{ student?.Student?.address }}
              </p>
              <p>
                <span class="font-medium">Wage Group:</span>
                {{ student?.wage_group?.map((group) => group.name).join(", ") }}
              </p>
            </div>
            <div class="flex gap-1 mt-2 items-center">
              <div class="flex gap-2 items-center">
                <!-- Edit Student -->
                <UTooltip text="Edit student">
                  <button
                    @click="handleEditClick(student?.Student)"
                    class="cursor-pointer"
                  >
                    <UIcon name="i-lucide-square-pen" class="size-5" />
                  </button>
                </UTooltip>

                <!-- Register Fingerprint -->
                <UTooltip text="Register fingerprint">
                  <ULink :to="`/students/${student?.Student?.id}/fingerprint`">
                    <UIcon name="i-lucide-fingerprint-pattern" class="size-5" />
                  </ULink>
                </UTooltip>

                <!-- Activate / Deactivate -->
                <UTooltip
                  :text="
                    student?.Student?.active === 1
                      ? 'Deactivate student'
                      : 'Activate student'
                  "
                >
                  <button
                    @click="toggleStudentStatus(student?.Student)"
                    class="cursor-pointer"
                  >
                    <UIcon
                      name="i-lucide-toggle-left"
                      class="size-5 transition-transform"
                      :class="{ 'rotate-180': student?.Student?.active === 1 }"
                    />
                  </button>
                </UTooltip>

                <!-- Reset Password -->
                <UTooltip text="Reset password">
                  <button @click="handleResetPasswordClick(student?.Student)">
                    <UIcon name="i-lucide-lock-keyhole-open" class="size-5" />
                  </button>
                </UTooltip>
              </div>
            </div>
          </div>
        </div>
      </UCard>

      <div class="grid md:grid-cols-3 gap-4 my-6">
        <!-- Account Balance -->
        <UCard class="rounded-2xl">
          <div class="flex gap-4">
            <div
              class="flex h-10 w-10 items-center justify-center rounded-full bg-primary-50 shrink-0 self-center"
            >
              <UIcon name="i-lucide-wallet" class="size-5 text-primary-600" />
            </div>

            <!-- Content -->
            <div class="flex-1">
              <p class="text-sm text-gray-500 mb-2">Account Balance</p>
              <div class="flex justify-between items-center">
                <p class="text-sm text-gray-600">Current</p>
                <p class="text-xl font-semibold">${{ student?.balance }}</p>
              </div>
            </div>
          </div>
        </UCard>

        <!-- Morning % -->
        <UCard class="rounded-2xl">
          <div class="flex gap-4">
            <div
              class="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 shrink-0 self-center"
            >
              <UIcon name="i-lucide-sun" class="size-5 text-amber-600" />
            </div>

            <!-- Content -->
            <div class="flex-1">
              <p class="text-sm text-gray-500 mb-2">Morning %</p>
              <div class="flex justify-between items-center mb-1">
                <p class="text-sm text-gray-600">This Month</p>
                <p class="text-lg font-semibold">{{ student?.percent_m }}%</p>
              </div>
              <div class="flex justify-between items-center">
                <p class="text-sm text-gray-600">Last Month</p>
                <p class="text-lg font-semibold">
                  {{ student?.percent_m_last }}%
                </p>
              </div>
            </div>
          </div>
        </UCard>

        <!-- Afternoon % -->
        <UCard class="rounded-2xl">
          <div class="flex gap-4">
            <div
              class="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 shrink-0 self-center"
            >
              <UIcon name="i-lucide-moon" class="size-5 text-indigo-600" />
            </div>

            <!-- Content -->
            <div class="flex-1">
              <p class="text-sm text-gray-500 mb-2">Afternoon %</p>
              <div class="flex justify-between items-center mb-1">
                <p class="text-sm text-gray-600">This Month</p>
                <p class="text-lg font-semibold">{{ student?.percent_a }}%</p>
              </div>
              <div class="flex justify-between items-center">
                <p class="text-sm text-gray-600">Last Month</p>
                <p class="text-lg font-semibold">
                  {{ student?.percent_a_last }}%
                </p>
              </div>
            </div>
          </div>
        </UCard>
      </div>

      <UTabs v-model="activeTab" :items="tabs" class="mt-6" />

      <UCard v-if="activeTab === '0'" class="rounded-2xl shadow-sm mt-6">
        <StudentCalender :items="clockingsData" />
      </UCard>

      <UCard v-if="activeTab === '1'" class="rounded-2xl shadow-sm mt-6">
        <div
          class="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-0"
        >
          <h2 class="md:text-lg text-base font-bold">Manage Deposits</h2>
        </div>
        <UTable
          :columns="transactionsColumns"
          :loading="loading"
          :data="transactionsData"
          class="flex-1 md:mt-6 mt-2 max-h-112"
          sticky
        />
      </UCard>
      <UCard v-if="activeTab === '2'" class="rounded-2xl shadow-sm mt-6">
        <div
          class="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-0"
        >
          <h2 class="md:text-lg text-base font-bold">Manage Checks</h2>
        </div>
        <UTable
          :columns="checksColumns"
          :loading="loading"
          :data="checksData"
          class="flex-1 md:mt-6 mt-2 max-h-112"
          sticky
        />
      </UCard>
      <UCard v-if="activeTab === '3'" class="rounded-2xl shadow-sm mt-6">
        <div
          class="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-0"
        >
          <h2 class="md:text-lg text-base font-bold">
            Manage Student Responses
          </h2>
        </div>
        <UTable
          :columns="responsesColumns"
          :loading="loading"
          :data="responsesData"
          class="flex-1 md:mt-6 mt-2 max-h-112"
          sticky
        />
      </UCard>
    </div>

    <div v-else>No student found</div>

    <CommonStudentCreateEditModal
      v-model="showModal"
      :selectedStudent="selectedStudent"
      @submit="onSubmit"
      @cancel="handleCancel"
    />
  </div>
</template>

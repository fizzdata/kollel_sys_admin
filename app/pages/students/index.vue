<script setup>
definePageMeta({
  layout: "sidebar",
  middleware: ["auth"],
});

const file = ref(null);
const api = useApi();
const showModal = ref(false);
const importStudentModal = ref(false);
const isSubmitting = ref(false);
const toast = useToast();
const students = ref([]);
const loading = ref(false);
const isActive = ref(false);
const searchTerm = ref("");

const selectedStudent = ref(null);

const handleClose = () => {
  selectedStudent.value = null;
};

const requiredColumns = [
  "first_name",
  "last_name",
  "first_yiddish_name",
  "last_yiddish_name",
  "phone",
  "address",
  "wage_group",
  "old_id",
];

const columns = [
  {
    accessorKey: "first_name",
    header: "Full Name",
    cell: ({ row }) =>
      h(
        resolveComponent("NuxtLink"),
        {
          to: `/students/${row.original.id}`, // dynamic route to student detail page
          class: "text-primary hover:underline cursor-pointer",
        },
        () => row.original.first_name + " " + row.original.last_name,
      ),
  },
  { accessorKey: "fingerprints", header: "Fingerprints" },
  { accessorKey: "first_yiddish_name", header: "First Yiddish Name" },
  { accessorKey: "last_yiddish_name", header: "Last Yiddish Name" },
  { accessorKey: "phone", header: "Phone" },
  {
    header: "Quick Actions",
    cell: ({ row }) =>
      h("div", { class: "flex gap-2 items-center" }, [
        // Edit Student Button
        h(
          resolveComponent("UTooltip"),
          { text: "Edit Student" },
          {
            default: () =>
              h(resolveComponent("UButton"), {
                icon: "i-lucide-square-pen",
                size: "md",
                color: "success",
                variant: "soft",
                onClick: () => editStudent(row.original),
              }),
          },
        ),

        // Toggle Active/Inactive Status Button
        h(resolveComponent("USwitch"), {
          modelValue: row.original.active,
          "onUpdate:modelValue": (val) =>
            toggleStudentStatus(row.original, val),
          color: "primary",
          size: "md",
          ui: {
            base: "cursor-pointer",
          },
        }),
      ]),
  },
];

const editStudent = (student) => {
  selectedStudent.value = student;
  // Open modal instantly
  showModal.value = true;
  // Fetch wages in background (non-blocking)
  fetchwages();
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

      await fetchStudents();
    } else {
      toast.add({
        title: "Failed",
        description: response?.message || "Unable to switch state.",
        color: "error",
        duration: 2000,
      });

      await fetchStudents();
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

const fetchStudents = async () => {
  const fetch = isActive.value
    ? `/api/students?active_only=true`
    : `/api/students?active_only=false`;
  try {
    loading.value = true;
    const response = await api(fetch);

    if (response?.success) {
      students.value = response?.students;
    }
  } catch (err) {
    console.log("🚀 ~ fetchStudents ~ err:", err);
    toast.add({
      description: "Error fetching students. Please try again later.",
      color: "error",
      timeout: 3000,
    });
  } finally {
    loading.value = false;
  }
};

// Add computed property to filter student based on search term
const filteredStudents = computed(() => {
  if (!searchTerm.value) return students.value;
  const term = searchTerm.value.toLowerCase();

  return students.value.filter((student) => {
    return (
      student.first_name?.toLowerCase().includes(term) ||
      student.last_name?.toLowerCase().includes(term) ||
      student.last_yiddish_name?.toLowerCase().includes(term) ||
      student.first_yiddish_name?.toLowerCase().includes(term)
    );
  });
});

const isModalOpen = async () => {
  showModal.value = true;
};
const exportStudent = async () => {
  importStudentModal.value = true;
};

const handleSubmit = () => {
  fetchStudents();
};

const downloadTemplate = () => {
  // Create CSV template
  const headers = requiredColumns.join(",");
  const exampleRow = "Yehudah,Adler,יודל,אדלער,3476757883,0,8,10638";
  const csvContent = [headers, exampleRow].join("\n");

  // Create blob and download
  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "student_template.csv";
  link.click();
  window.URL.revokeObjectURL(url);

  toast.add({
    title: "Success",
    description: "Template downloaded successfully",
    color: "success",
    duration: 2000,
  });
};

const handleFileSubmit = async () => {
  if (!file.value) {
    toast.add({
      title: "Failed",
      description: "Please Select File.",
      color: "error",
    });

    return;
  }

  isSubmitting.value = true;

  const formData = new FormData();
  formData.append("file", file.value);
  try {
    const response = await api(`/api/students/import`, {
      method: "POST",
      body: formData,
    });

    if (response?.success) {
      importStudentModal.value = false;
      toast.add({
        title: "Success",
        description: response?.message
          ? response?.message
          : "Data will be imported shortly",
        color: "success",
        duration: 2000,
      });
      file.value = null;
      importStudentModal.value = false;
      await fetchStudents();
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
onMounted(async () => {
  await fetchStudents();
});

const toggleSwitch = async () => {
  isActive.value = !isActive.value;
  await fetchStudents();
};
</script>

<template>
  <UCard class="rounded-2xl shadow-sm">
    <div
      class="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-4 md:mb-0"
    >
      <h2 class="text-xl font-bold">All Students</h2>
      <div class="flex justify-end gap-2">
        <UButton
          @click="isModalOpen"
          icon="i-lucide-circle-plus"
          label="Create New Student"
        />
        <UButton
          @click="exportStudent"
          icon="i-lucide-file-text"
          label="Import Students"
        />
      </div>
    </div>
  </UCard>
  <div class="flex gap-4 items-center my-6">
    <UInput
      v-model="searchTerm"
      icon="i-lucide-search"
      size="lg"
      variant="outline"
      placeholder="Search..."
      :ui="{ trailing: 'pe-1' }"
    >
      <template v-if="searchTerm?.length" #trailing>
        <UButton
          color="neutral"
          variant="link"
          size="sm"
          icon="i-lucide-circle-x"
          aria-label="Clear input"
          @click="searchTerm = ''"
        />
      </template>
    </UInput>

    <USwitch
      :model-value="isActive"
      @update:model-value="toggleSwitch"
      label="Active Only"
    />
  </div>
  <!-- Students Table -->
  <UCard class="rounded-2xl shadow-sm mt-6">
    <div
      class="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-4 md:mb-0"
    >
      <h2 class="text-lg font-bold">Manage students and their access</h2>
    </div>
    <UTable
      :columns="columns"
      :loading="loading"
      :data="filteredStudents"
      class="flex-1 mt-6"
    />
  </UCard>
  <!-- Modal for Create New Student -->
  <CommonStudentCreateEditModal
    v-model="showModal"
    :selectedStudent="selectedStudent || {}"
    @submit="handleSubmit"
    @cancel="handleClose"
  />

  <!-- Modal for Export Students -->
  <UModal v-model:open="importStudentModal">
    <template #header>
      <div class="flex justify-between w-full">
        <h2 class="text-xl font-bold text-primary">Import Students</h2>

        <!-- Close Button -->
        <UButton
          size="sm"
          variant="outline"
          color="primary"
          class="rounded-full p-2"
          icon="i-lucide-x"
          @click="
            () => {
              handleClose();
              importStudentModal = false;
            }
          "
        />
      </div>
    </template>
    <template #body>
      <!-- Required Columns Section -->
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-3">
        <h3 class="font-semibold text-blue-900 mb-3">Required Columns</h3>
        <div class="grid grid-cols-2 gap-2">
          <div
            v-for="(column, index) in requiredColumns"
            :key="index"
            class="flex items-center gap-2 text-sm text-blue-800"
          >
            <UIcon name="i-lucide-check" class="text-blue-600" />
            {{ column }}
          </div>
        </div>
      </div>

      <!-- Download Template Section -->
      <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <p class="text-sm text-gray-600 mb-3">
          Download the CSV template to get started with the correct format:
        </p>
        <UButton
          @click="downloadTemplate"
          icon="i-lucide-download"
          label="Download Template"
          variant="outline"
          color="neutral"
        />
      </div>

      <UFileUpload
        v-model="file"
        icon="i-lucide-file-text"
        label="Drop your file here"
        description="xlsx,xls or csv (max. 2MB)"
        layout="list"
        :multiple="false"
        accept=".xlsx,.xls,.csv"
        :interactive="false"
        class="w-full min-h-48"
      >
        <template #actions="{ open }">
          <UButton
            label="Select File"
            icon="i-lucide-upload"
            color="neutral"
            variant="outline"
            @click="open()"
          />
        </template>
      </UFileUpload>

      <UButton
        type="submit"
        :loading="isSubmitting"
        :disabled="isSubmitting"
        label="Import Student"
        class="w-full flex justify-center items-center mt-4"
        @click="handleFileSubmit"
      />
    </template>
  </UModal>
</template>

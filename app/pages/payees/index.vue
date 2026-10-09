<script setup>
definePageMeta({
  layout: "sidebar",
  middleware: ["auth"],
});

const api = useApi();
const toast = useToast();

const payees = ref([]);
const loading = ref(false);
const searchTerm = ref("");
const showModal = ref(false);
const selectedPayee = ref(null);
const isDeletePayeeModalOpen = ref(false);
const isPayeeDeleting = ref(false);

const fetchingSettings = ref(false);
const isSavingSettings = ref(false);
const settingsForm = reactive({
  min_check_amount: 5,
});

const columns = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "default_memo", header: "Default Memo" },
  { accessorKey: "times_used", header: "Times Used" },
  {
    header: "Quick Actions",
    cell: ({ row }) =>
      h("div", { class: "flex gap-2 items-center" }, [
        h(
          resolveComponent("UTooltip"),
          { text: "Edit Payee" },
          {
            default: () =>
              h(resolveComponent("UButton"), {
                icon: "i-lucide-square-pen",
                size: "md",
                color: "success",
                variant: "soft",
                onClick: () => handleEditClick(row.original),
              }),
          },
        ),
        h(
          resolveComponent("UTooltip"),
          { text: "Delete Payee" },
          {
            default: () =>
              h(resolveComponent("UButton"), {
                icon: "i-lucide-trash-2",
                size: "md",
                color: "error",
                variant: "soft",
                onClick: () => handleDeleteClick(row.original),
              }),
          },
        ),
      ]),
  },
];

const fetchPayees = async () => {
  try {
    loading.value = true;
    const response = await api(`/api/payees`, { method: "GET" });

    if (response?.success) {
      payees.value = response?.payees || [];
    }
  } catch (err) {
    console.log("🚀 ~ fetchPayees ~ err:", err);
    toast.add({
      title: "Error",
      description:
        "An unexpected error occurred while fetching payees. Please try again later.",
      color: "error",
    });
  } finally {
    loading.value = false;
  }
};

const filteredPayees = computed(() => {
  if (!searchTerm.value) return payees.value;
  const term = searchTerm.value.toLowerCase();

  return payees.value.filter((payee) =>
    payee.name?.toLowerCase().includes(term),
  );
});

const openCreateModal = () => {
  selectedPayee.value = null;
  showModal.value = true;
};

const handleEditClick = (payee) => {
  selectedPayee.value = payee;
  showModal.value = true;
};

const handleClose = () => {
  selectedPayee.value = null;
};

const handleSubmit = () => {
  fetchPayees();
};

const handleDeleteClick = (payee) => {
  selectedPayee.value = payee;
  isDeletePayeeModalOpen.value = true;
};

const confirmDeletePayee = async () => {
  try {
    isPayeeDeleting.value = true;
    const response = await api(`/api/payees/${selectedPayee.value.id}`, {
      method: "DELETE",
    });

    if (response?.success) {
      toast.add({
        title: "Success",
        description: response?.message || "Payee Deleted.",
        color: "success",
        duration: 2000,
      });
      isDeletePayeeModalOpen.value = false;
      selectedPayee.value = null;
      await fetchPayees();
    } else {
      toast.add({
        title: "Failed",
        description: response?.message || "Error deleting Payee",
        color: "error",
        duration: 2000,
      });
    }
  } catch (error) {
    console.error("Error deleting payee:", error);
    toast.add({
      description: "Error deleting payee. Please try again later.",
      color: "error",
      timeout: 3000,
    });
  } finally {
    isPayeeDeleting.value = false;
  }
};

const fetchSettings = async () => {
  try {
    fetchingSettings.value = true;
    const response = await api(`/api/payees/settings`, { method: "GET" });

    if (response?.success) {
      settingsForm.min_check_amount = response?.settings?.min_check_amount ?? 5;
    }
  } catch (err) {
    console.log("🚀 ~ fetchSettings ~ err:", err);
    toast.add({
      title: "Error",
      description: "Failed to load payee settings",
      color: "error",
    });
  } finally {
    fetchingSettings.value = false;
  }
};

const submitSettings = async () => {
  isSavingSettings.value = true;

  try {
    const response = await api(`/api/payees/settings`, {
      method: "POST",
      body: {
        min_check_amount: Number(settingsForm.min_check_amount),
      },
    });

    if (response?.success) {
      toast.add({
        title: "Success",
        description: response?.message || "Settings updated",
        color: "success",
        duration: 2000,
      });
    } else {
      toast.add({
        title: "Failed",
        description:
          response?.message ||
          response?._data?.message ||
          "Failed to update settings",
        color: "error",
      });
    }
  } catch (error) {
    console.error("Error updating payee settings:", error);
    toast.add({
      title: "Error",
      description: "An unexpected error occurred. Please try again later.",
      color: "error",
    });
  } finally {
    isSavingSettings.value = false;
  }
};

onMounted(async () => {
  await fetchPayees();
  await fetchSettings();
});
</script>

<template>
  <UCard class="rounded-2xl shadow-sm">
    <div
      class="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-4 md:mb-0"
    >
      <h2 class="text-xl font-bold">All Payees</h2>
      <div class="flex justify-end gap-2">
        <UButton
          @click="openCreateModal"
          icon="i-lucide-circle-plus"
          label="New Payee"
        />
      </div>
    </div>
  </UCard>
  <UCard class="rounded-2xl shadow-sm mt-6 max-w-2xl">
    <div
      v-if="fetchingSettings"
      class="flex items-center justify-center py-6 w-full"
    >
      <BaseSpinner :show-loader="fetchingSettings" size="md" />
    </div>
    <UForm
      v-else
      :state="settingsForm"
      class="space-y-4"
      @submit="submitSettings"
    >
      <h3 class="text-base font-semibold text-gray-700">Request Settings</h3>
      <UFormField
        label="Minimum Request Amount ($)"
        description="Smallest amount a student can request from their balance"
      >
        <UInput
          v-model="settingsForm.min_check_amount"
          type="number"
          min="0"
          class="w-full max-w-xs"
          size="lg"
        />
      </UFormField>

      <UButton
        type="submit"
        color="primary"
        size="lg"
        :loading="isSavingSettings"
        :disabled="isSavingSettings"
      >
        Update Settings
      </UButton>
    </UForm>
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
  </div>
  <!-- Payees Table -->
  <UCard class="rounded-2xl shadow-sm mt-6">
    <div
      class="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-4 md:mb-0"
    >
      <h2 class="text-lg font-bold">Manage payees</h2>
    </div>
    <UTable
      :columns="columns"
      :loading="loading"
      :data="filteredPayees"
      class="flex-1 mt-6"
    />
  </UCard>

  <CommonPayeeCreateEditModal
    v-model="showModal"
    :selectedPayee="selectedPayee || {}"
    @submit="handleSubmit"
    @cancel="handleClose"
  />

  <UModal
    v-model:open="isDeletePayeeModalOpen"
    title="Confirm Delete Payee"
    :close="{ color: 'primary', variant: 'outline', class: 'rounded-full' }"
  >
    <template #body>
      <p>Are you sure you want to delete this payee?</p>
      <div
        class="flex gap-2 justify-end items-center border-t border-gray-200 mt-4"
      >
        <UButton
          color="neutral"
          variant="solid"
          class="mt-4"
          label="Cancel"
          @click="isDeletePayeeModalOpen = false"
        />

        <UButton
          color="error"
          variant="solid"
          class="mt-4"
          label="Delete"
          :loading="isPayeeDeleting"
          :disabled="isPayeeDeleting"
          @click="confirmDeletePayee()"
        />
      </div>
    </template>
  </UModal>
</template>

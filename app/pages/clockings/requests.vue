<script setup>
import { sec_to_time } from "~/common/common";

definePageMeta({
  layout: "sidebar",
  middleware: ["auth"],
});

const api = useApi();
const toast = useToast();

const requests = ref([]);
const loading = ref(false);
const processingId = ref(null);
const isApproveAllOpen = ref(false);
const isDeclineAllOpen = ref(false);
const isBulkProcessing = ref(false);

const renderTimeCell = (row, session, field) => {
  if (row.session !== session) return "";

  const oldVal = row[`old_${field}`];
  const newVal = row[`new_${field}`];
  const changed = oldVal !== newVal;

  return h("div", [
    h("div", { class: "text-xs text-gray-400" }, sec_to_time(oldVal)),
    h(
      "div",
      { class: changed ? "font-bold" : "" },
      sec_to_time(newVal),
    ),
  ]);
};

const renderRetzifusCell = (row, session) => {
  if (row.session !== session) return "";

  const oldVal = row.old_retzifus ? "Yes" : "No";
  const newVal = row.new_retzifus ? "Yes" : "No";
  const changed = oldVal !== newVal;

  return h("div", [
    h("div", { class: "text-xs text-gray-400" }, oldVal),
    h("div", { class: changed ? "font-bold" : "" }, newVal),
  ]);
};

const columns = [
  {
    accessorKey: "request",
    header: "Request",
    cell: ({ row }) =>
      h("div", [
        h(
          "div",
          { class: "font-medium" },
          `${row.original.first_name} ${row.original.last_name}`,
        ),
        h(
          "div",
          { class: "text-xs text-gray-500" },
          `Requested change for ${row.original.day}`,
        ),
        row.original.notes
          ? h(
              "div",
              { class: "text-xs text-gray-400 italic" },
              `Reason: ${row.original.notes}`,
            )
          : null,
      ]),
  },
  {
    id: "morning_in",
    header: "Morning In",
    cell: ({ row }) => renderTimeCell(row.original, 1, "in"),
  },
  {
    id: "morning_out",
    header: "Morning Out",
    cell: ({ row }) => renderTimeCell(row.original, 1, "out"),
  },
  {
    id: "morning_retzifus",
    header: "Morning Retzifus",
    cell: ({ row }) => renderRetzifusCell(row.original, 1),
  },
  {
    id: "afternoon_in",
    header: "Afternoon In",
    cell: ({ row }) => renderTimeCell(row.original, 2, "in"),
  },
  {
    id: "afternoon_out",
    header: "Afternoon Out",
    cell: ({ row }) => renderTimeCell(row.original, 2, "out"),
  },
  {
    id: "afternoon_retzifus",
    header: "Afternoon Retzifus",
    cell: ({ row }) => renderRetzifusCell(row.original, 2),
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) =>
      h("div", { class: "flex gap-2 items-center" }, [
        h(
          resolveComponent("UTooltip"),
          { text: "Approve" },
          {
            default: () =>
              h(resolveComponent("UButton"), {
                icon: "i-lucide-check",
                size: "md",
                color: "success",
                variant: "soft",
                loading: processingId.value === row.original.id,
                disabled: processingId.value !== null,
                onClick: () => approve(row.original.id),
              }),
          },
        ),
        h(
          resolveComponent("UTooltip"),
          { text: "Decline" },
          {
            default: () =>
              h(resolveComponent("UButton"), {
                icon: "i-lucide-x",
                size: "md",
                color: "error",
                variant: "soft",
                loading: processingId.value === row.original.id,
                disabled: processingId.value !== null,
                onClick: () => decline(row.original.id),
              }),
          },
        ),
      ]),
  },
];

const fetchRequests = async () => {
  try {
    loading.value = true;
    const response = await api("/api/requests", { method: "GET" });

    if (response?.success) {
      requests.value = response?.requests || [];
    }
  } catch (err) {
    console.log("🚀 ~ fetchRequests ~ err:", err);
    toast.add({
      title: "Error",
      description:
        "An unexpected error occurred while fetching requests. Please try again later.",
      color: "error",
    });
  } finally {
    loading.value = false;
  }
};

const approve = async (id) => {
  processingId.value = id;
  try {
    const response = await api(`/api/requests/approve/${id}`, {
      method: "POST",
    });

    if (response?.success) {
      toast.add({
        title: "Success",
        description: response?.message || "Request Approved",
        color: "success",
        duration: 2000,
      });
      await fetchRequests();
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
  } catch (err) {
    console.log("🚀 ~ approve ~ err:", err);
    toast.add({
      title: "Error",
      description: "An unexpected error occurred. Please try again later.",
      color: "error",
    });
  } finally {
    processingId.value = null;
  }
};

const decline = async (id) => {
  processingId.value = id;
  try {
    const response = await api(`/api/requests/decline/${id}`, {
      method: "POST",
    });

    if (response?.success) {
      toast.add({
        title: "Success",
        description: response?.message || "Request Declined",
        color: "success",
        duration: 2000,
      });
      await fetchRequests();
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
  } catch (err) {
    console.log("🚀 ~ decline ~ err:", err);
    toast.add({
      title: "Error",
      description: "An unexpected error occurred. Please try again later.",
      color: "error",
    });
  } finally {
    processingId.value = null;
  }
};

const confirmApproveAll = async () => {
  isBulkProcessing.value = true;
  try {
    const response = await api("/api/requests/approve/all", {
      method: "POST",
    });

    if (response?.success) {
      toast.add({
        title: "Success",
        description: response?.message || "All requests approved",
        color: "success",
        duration: 2000,
      });
      isApproveAllOpen.value = false;
      await fetchRequests();
    } else {
      toast.add({
        title: "Failed",
        description: response?.message || "Something went wrong.",
        color: "error",
      });
    }
  } catch (err) {
    console.log("🚀 ~ confirmApproveAll ~ err:", err);
    toast.add({
      title: "Error",
      description: "An unexpected error occurred. Please try again later.",
      color: "error",
    });
  } finally {
    isBulkProcessing.value = false;
  }
};

const confirmDeclineAll = async () => {
  isBulkProcessing.value = true;
  try {
    const response = await api("/api/requests/decline/all", {
      method: "POST",
    });

    if (response?.success) {
      toast.add({
        title: "Success",
        description: response?.message || "All requests declined",
        color: "success",
        duration: 2000,
      });
      isDeclineAllOpen.value = false;
      await fetchRequests();
    } else {
      toast.add({
        title: "Failed",
        description: response?.message || "Something went wrong.",
        color: "error",
      });
    }
  } catch (err) {
    console.log("🚀 ~ confirmDeclineAll ~ err:", err);
    toast.add({
      title: "Error",
      description: "An unexpected error occurred. Please try again later.",
      color: "error",
    });
  } finally {
    isBulkProcessing.value = false;
  }
};

onMounted(async () => {
  await fetchRequests();
});
</script>
<template>
  <div class="mb-4">
    <UButton
      variant="outline"
      color="primary"
      to="/clockings"
      icon="i-lucide-arrow-left"
      label="Back to Clockings"
    />
  </div>
  <UCard class="rounded-2xl shadow-sm">
    <div class="flex justify-between items-center gap-4">
      <h2 class="text-xl font-bold">Requests</h2>
      <div class="flex justify-end gap-2">
        <UButton
          label="Approve All"
          color="success"
          variant="solid"
          :disabled="!requests.length"
          @click="isApproveAllOpen = true"
        />
        <UButton
          label="Decline All"
          color="error"
          variant="solid"
          :disabled="!requests.length"
          @click="isDeclineAllOpen = true"
        />
      </div>
    </div>
  </UCard>
  <!-- Requests Table -->
  <UCard class="my-8">
    <UTable
      :columns="columns"
      :loading="loading"
      :data="requests"
      class="flex-1 mt-6"
    />
    <p v-if="!loading && !requests.length" class="text-center text-gray-500 py-6">
      No pending requests.
    </p>
  </UCard>

  <UModal
    v-model:open="isApproveAllOpen"
    title="Confirm Approve All"
    :close="{ color: 'primary', variant: 'outline', class: 'rounded-full' }"
  >
    <template #body>
      <p>
        Are you sure you want to approve all {{ requests.length }} pending
        request(s)?
      </p>
      <div
        class="flex gap-2 justify-end items-center border-t border-gray-200 mt-4"
      >
        <UButton
          color="neutral"
          variant="solid"
          class="mt-4"
          label="Cancel"
          @click="isApproveAllOpen = false"
        />
        <UButton
          color="success"
          variant="solid"
          class="mt-4"
          label="Approve All"
          :loading="isBulkProcessing"
          :disabled="isBulkProcessing"
          @click="confirmApproveAll()"
        />
      </div>
    </template>
  </UModal>

  <UModal
    v-model:open="isDeclineAllOpen"
    title="Confirm Decline All"
    :close="{ color: 'primary', variant: 'outline', class: 'rounded-full' }"
  >
    <template #body>
      <p>
        Are you sure you want to decline all {{ requests.length }} pending
        request(s)?
      </p>
      <div
        class="flex gap-2 justify-end items-center border-t border-gray-200 mt-4"
      >
        <UButton
          color="neutral"
          variant="solid"
          class="mt-4"
          label="Cancel"
          @click="isDeclineAllOpen = false"
        />
        <UButton
          color="error"
          variant="solid"
          class="mt-4"
          label="Decline All"
          :loading="isBulkProcessing"
          :disabled="isBulkProcessing"
          @click="confirmDeclineAll()"
        />
      </div>
    </template>
  </UModal>
</template>

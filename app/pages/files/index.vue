<script setup>
definePageMeta({
  layout: "sidebar",
  middleware: ["auth"],
});

const api = useApi();
const toast = useToast();
const files = ref([]);
const loading = ref(false);
const searchTerm = ref("");

const formatFileSize = (bytes) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
};

const formatDate = (timestamp) => {
  return new Date(timestamp * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const columns = [
  {
    accessorKey: "name",
    header: "File Name",
    cell: ({ row }) =>
      h("div", { class: "flex items-center gap-2" }, [
        h("span", { class: "i-lucide-file text-gray-400" }),
        h("span", { class: "text-primary font-medium" }, row.original.name),
      ]),
  },
  {
    accessorKey: "size",
    header: "Size",
    cell: ({ row }) => formatFileSize(row.original.size),
  },
  {
    accessorKey: "created_at",
    header: "Created",
    cell: ({ row }) => formatDate(row.original.created_at),
  },
  {
    header: "Actions",
    cell: ({ row }) =>
      h("div", { class: "flex gap-2 items-center" }, [
        h(
          resolveComponent("UTooltip"),
          { text: "Download File" },
          {
            default: () =>
              h(resolveComponent("UButton"), {
                icon: "i-lucide-download",
                size: "md",
                color: "primary",
                variant: "soft",
                onClick: () => downloadFile(row.original),
              }),
          },
        ),
      ]),
  },
];

const downloadFile = (file) => {
  try {
    // Create a temporary anchor element and trigger download
    const link = document.createElement("a");
    link.href = file.download_url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.add({
      title: "Success",
      description: `${file.name} download started`,
      color: "success",
      duration: 2000,
    });
  } catch (error) {
    console.error("Download error:", error);
    toast.add({
      title: "Error",
      description: "Failed to download file",
      color: "error",
    });
  }
};

const fetchFiles = async () => {
  try {
    loading.value = true;
    const response = await api(`/api/files`, {
      method: "GET",
    });

    if (response?.success) {
      files.value = response?.files || [];
    } else {
      toast.add({
        title: "Error",
        description: response?.message || "Failed to fetch files",
        color: "error",
      });
    }
  } catch (error) {
    console.error("Fetch error:", error);
    toast.add({
      title: "Error",
      description: "An unexpected error occurred while fetching files",
      color: "error",
    });
  } finally {
    loading.value = false;
  }
};

const filteredFiles = computed(() => {
  if (!searchTerm.value) return files.value;
  const term = searchTerm.value.toLowerCase();
  return files.value.filter((file) => file.name.toLowerCase().includes(term));
});

onMounted(async () => {
  await fetchFiles();
});
</script>

<template>
  <UCard class="rounded-2xl shadow-sm">
    <div class="flex justify-between items-center gap-4">
      <h2 class="text-xl font-bold">Available Files</h2>
      <UButton
        @click="fetchFiles"
        icon="i-lucide-rotate-cw"
        label="Refresh"
        variant="outline"
      />
    </div>
  </UCard>

  <div class="flex gap-4 items-center my-6">
    <UInput
      v-model="searchTerm"
      icon="i-lucide-search"
      variant="outline"
      placeholder="Search files..."
      :ui="{ trailing: 'pe-1' }"
      size="lg"
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

  <!-- Files Table -->
  <UCard>
    <UTable
      :columns="columns"
      :loading="loading"
      :data="filteredFiles"
      class="flex-1 mt-6"
    />
  </UCard>
</template>

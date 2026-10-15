<script setup>
import { secondsToAmPm } from "~/common/common";

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  users: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
});

const emit = defineEmits(["update:modelValue"]);

const close = () => emit("update:modelValue", false);

const userLabel = (user) =>
  `${secondsToAmPm(user.time)} - ${user.first_yiddish_name || user.first_name || ""} ${
    user.last_yiddish_name || user.last_name || ""
  }`.trim();

const columns = [
  {
    accessorKey: "checkbox",
    header: "",
    cell: () => h("input", { type: "checkbox" }),
  },
  {
    accessorKey: "name",
    header: "Since - Name",
    cell: ({ row }) => userLabel(row.original),
  },
];

// Mirrors the legacy admin dashboard's print view: splits the list into 3
// columns on a print-only popup window.
const printTable = () => {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const columnCount = 3;
  const itemsPerColumn = Math.ceil(props.users.length / columnCount) || 1;

  let printContent = '<div class="print-container">';
  for (let i = 0; i < columnCount; i++) {
    const chunk = props.users.slice(
      i * itemsPerColumn,
      (i + 1) * itemsPerColumn,
    );
    printContent += `
      <div class="print-column">
        <table>
          <thead><tr><th>Since - Name</th></tr></thead>
          <tbody>${chunk.map((u) => `<tr><td>${userLabel(u)}</td></tr>`).join("")}</tbody>
        </table>
      </div>
    `;
  }
  printContent += "</div>";

  printWindow.document.write(`
    <html>
      <head>
        <title>Users List</title>
        <style>
          @page { margin: 0.5in; size: letter; }
          body { margin: 0; font-family: Arial, sans-serif; }
          .print-container { display: flex; gap: 20px; width: 100%; }
          .print-column { flex: 1; page-break-inside: avoid; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #000; padding: 4px; text-align: left; }
        </style>
      </head>
      <body>${printContent}</body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 500);
};
</script>

<template>
  <UModal :open="modelValue" @update:open="emit('update:modelValue', $event)">
    <template #header>
      <div class="flex justify-between w-full">
        <h2 class="text-xl font-bold text-primary">Users Currently In</h2>
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
      <div v-if="loading" class="flex items-center justify-center pt-10 w-full">
        <BaseSpinner :show-loader="loading" size="md" />
      </div>
      <UTable v-else :columns="columns" :data="users" class="max-h-96" sticky>
        <template #empty>
          <p class="text-sm text-gray-500 text-center py-4">
            No one is currently clocked in.
          </p>
        </template>
      </UTable>

      <div
        class="flex justify-end items-center gap-2 mt-4 border-t border-gray-200 pt-4"
      >
        <UButton color="neutral" variant="solid" label="Close" @click="close" />
        <UButton
          icon="i-lucide-printer"
          label="Print"
          :disabled="!users.length"
          @click="printTable"
        />
      </div>
    </template>
  </UModal>
</template>

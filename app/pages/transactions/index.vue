<script setup>
definePageMeta({
  layout: "sidebar",
  middleware: ["auth"],
});
import {
  today,
  DateFormatter,
  getLocalTimeZone,
  Time,
} from "@internationalized/date";
const df = new DateFormatter("en-US", {
  dateStyle: "medium",
});
const todayDate = today(getLocalTimeZone());
const open = ref(false);
const newTransactionModal = ref(false);
const fromDate = todayDate.subtract({ days: 7 });
const loading = ref(false);

const state = reactive({
  user: "",
  amount: "",
  password: "",
});

const calendarRange = ref({
  start: fromDate,
  end: todayDate,
});

const transactionsColumns = [
  {
    accessorKey: "name",
    header: "Name",
    // cell: ({ row }) =>
    //   h(
    //     resolveComponent("NuxtLink"),
    //     {
    //       to: `/payroll/${row.original.id}`, // dynamic route to user detail page
    //       class: "text-primary hover:underline",
    //     },
    //     row.original.name
    //   ),
  },
  { accessorKey: "date", header: "Date" },
  { accessorKey: "description", header: "Description" },
  { accessorKey: "deposit", header: "Deposit" },
  { accessorKey: "check", header: "Check" },
  {
    header: "Quick Actions",
    cell: ({ row }) =>
      h("div", { class: "flex gap-2 items-center" }, [
        // Edit User Button
        h(
          resolveComponent("UTooltip"),
          { text: "Edit User" },
          {
            default: () =>
              h(resolveComponent("UButton"), {
                icon: "i-lucide-square-pen",
                size: "md",
                color: "success",
                variant: "soft",
              }),
          }
        ),

        h(
          resolveComponent("UTooltip"),
          { text: "Delete User" },
          {
            default: () =>
              h(resolveComponent("UButton"), {
                icon: "i-lucide-trash-2",
                size: "md",
                color: "error",
                variant: "soft",
              }),
          }
        ),
      ]),
  },
];
const transactionsData = [
  {
    id: 1,
    name: "Claudia Montgomer",
    date: "2026-01-05",
    description: "Monthly stipend deposit",
    deposit: "$1,200.00",
    check: "-",
  },
  {
    id: 2,
    name: "David Rosen",
    date: "2026-01-04",
    description: "Check payment issued",
    deposit: "-",
    check: "$450.00",
  },
  {
    id: 3,
    name: "Sarah Levine",
    date: "2026-01-03",
    description: "Adjustment credit",
    deposit: "$150.00",
    check: "-",
  },
  {
    id: 4,
    name: "Michael Cohen",
    date: "2026-01-02",
    description: "Penalty deduction",
    deposit: "-",
    check: "$200.00",
  },
];

// watch for datepicker changes
watch(
  () => calendarRange.value,
  async (val) => {
    if (!val?.start || !val?.end) return;

    // close popover
    open.value = false;

    // call API
    await fetchClockings({
      date_from: val.start.toString(),
      date_to: val.end.toString(),
    });
  },
  { deep: true }
);
</script>
<template>
  <UCard class="rounded-2xl shadow-sm">
    <div class="flex justify-between items-center gap-4">
      <h2 class="text-xl font-bold">All Transactions</h2>
      <div class="flex justify-end gap-2">
        <UButton
          @click="newTransactionModal = true"
          trailing-icon="i-lucide-arrow-right"
          label="New Transaction"
        >
        </UButton>

        <UButton @click="" icon="i-lucide-file-text" label="Export"> </UButton>
      </div>
    </div>
  </UCard>
  <div class="flex justify-between my-6">
    <div class="flex gap-4 items-center">
      <UPopover v-model:open="open">
        <UButton
          color="neutral"
          variant="outline"
          size="lg"
          icon="i-lucide-calendar"
        >
          <template v-if="calendarRange.start">
            <template v-if="calendarRange.end">
              {{ df.format(calendarRange.start.toDate(getLocalTimeZone())) }}
              -
              {{ df.format(calendarRange.end.toDate(getLocalTimeZone())) }}
            </template>
            <template v-else>
              {{ df.format(calendarRange.start.toDate(getLocalTimeZone())) }}
            </template>
          </template>
          <template v-else> Pick a date </template>
        </UButton>

        <template #content>
          <UCalendar
            v-model="calendarRange"
            range
            :number-of-months="2"
            class="p-2"
          />
        </template>
      </UPopover>
    </div>
  </div>

  <!-- Clockings Table -->
  <UCard>
    <UTable
      :columns="transactionsColumns"
      :loading="loading"
      :data="transactionsData"
      class="flex-1 mt-6"
    />
  </UCard>
  <UModal v-model:open="newTransactionModal">
    <!-- Custom Header -->
    <template #header>
      <div class="flex justify-between w-full">
        <h2 class="text-xl font-bold text-primary">Create Transaction</h2>

        <!-- Close Button -->
        <UButton
          size="sm"
          variant="outline"
          color="primary"
          class="rounded-full p-2"
          icon="i-lucide-x"
          @click="newTransactionModal = false"
        >
        </UButton>
      </div>
    </template>

    <template #body>
      <div>
        <UForm class="space-y-4">
          <UFormField label="User" name="user">
            <USelect
              v-model="state.user"
              :items="items"
              class="w-full"
              size="lg"
              placeholder="Select User"
            />
          </UFormField>
          <UFormField label="Amount" name="amount">
            <UInput
              v-model="state.amount"
              class="w-full"
              type="number"
              size="lg"
              placeholder="Enter amount"
            />
          </UFormField>
          <UFormField label="Description" name="description">
            <UInput
              v-model="state.description"
              class="w-full"
              type="text"
              size="lg"
              placeholder="Enter description"
            />
          </UFormField>
          <div
            class="flex justify-end items-center gap-2 mt-4 border-t border-gray-200 pt-4"
          >
            <UButton
              color="neutral"
              variant="solid"
              @click="newTransactionModal = false"
            >
              Cancel
            </UButton>
            <UButton type="submit"> Create </UButton>
          </div>
        </UForm>
      </div>
    </template>
  </UModal>
</template>

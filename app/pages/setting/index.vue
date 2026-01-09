<script setup>
definePageMeta({
  layout: "sidebar",
  middleware: ["auth"],
});
const editScheduleModal = ref(false);
const state = reactive({
  check_number: "",
  early_checkin: "",
  late_checkout: "",
  time_zone: "",
  min_check_amount: "",
  account_number: "",
  routing_number: "",
  display_msg: "",
});
const scheduleState = reactive({
  seder_A_begin: "",
  seder_A_end: "",
  seder_B_begin: "",
  seder_B_end: "",
});
const activeTab = ref("0");

const show = ref(false);
const newshow = ref(false);
const confirmshow = ref(false);
const items = ref([
  {
    label: "General",
    key: "general",
  },
  {
    label: "Clocking Questions",
    key: "clocking_questions",
  },
  {
    label: "See Default Schedule",
    key: "schedule",
  },
  {
    label: "Pages",
    key: "pages",
  },
  {
    label: "Wages Group",
    key: "wages_group",
  },
  {
    label: "Import",
    key: "import",
  },
  {
    label: "Half Hour Exception",
    key: "exception",
  },
]);
const columns = [
  {
    accessorKey: "day",
    header: "Day of week",
  },
  {
    accessorKey: "seder1_begins",
    header: "Seder 1 Begins",
  },
  {
    accessorKey: "seder1_ends",
    header: "Seder 1 Ends",
  },
  {
    accessorKey: "seder2_begins",
    header: "Seder 2 Begins",
  },
  {
    accessorKey: "seder2_ends",
    header: "Seder 2 Ends",
  },
  {
    accessorKey: "action",
    header: "Edit / Set",
    cell: ({ row }) =>
      h("div", { class: "flex gap-2 items-center" }, [
        // Edit User Button
        h(
          resolveComponent("UTooltip"),
          { text: "Edit Schedule" },
          {
            default: () =>
              h(resolveComponent("UButton"), {
                icon: "i-lucide-square-pen",
                size: "md",
                color: "success",
                variant: "soft",
                onClick: () => {
                  editScheduleModal.value = true;
                },
              }),
          }
        ),
      ]),
  },
];
const rows = [
  {
    day: "Sunday",
    seder1_begins: "10:00:00 AM",
    seder1_ends: "02:00:00 PM",
    seder2_begins: "03:00:00 PM",
    seder2_ends: "06:00:00 PM",
  },
  {
    day: "Monday",
    seder1_begins: "09:30:00 AM",
    seder1_ends: "01:30:00 PM",
    seder2_begins: "02:30:00 PM",
    seder2_ends: "05:30:00 PM",
  },
  {
    day: "Tuesday",
    seder1_begins: "10:00:00 AM",
    seder1_ends: "02:00:00 PM",
    seder2_begins: "03:00:00 PM",
    seder2_ends: "06:00:00 PM",
  },
  {
    day: "Wednesday",
    seder1_begins: "08:00:00 AM",
    seder1_ends: "12:00:00 PM",
    seder2_begins: "01:00:00 PM",
    seder2_ends: "04:00:00 PM",
  },
  {
    day: "Thursday",
    seder1_begins: "09:00:00 AM",
    seder1_ends: "01:00:00 PM",
    seder2_begins: "02:00:00 PM",
    seder2_ends: "05:00:00 PM",
  },
  {
    day: "Friday",
    seder1_begins: "10:00:00 AM",
    seder1_ends: "01:00:00 PM",
    seder2_begins: "02:00:00 PM",
    seder2_ends: "04:00:00 PM",
  },
  {
    day: "Saturday",
    seder1_begins: "—",
    seder1_ends: "—",
    seder2_begins: "—",
    seder2_ends: "—",
    action: "Set",
  },
];
</script>

<template>
  <UTabs
    v-model="activeTab"
    color="neutral"
    variant="link"
    :items="items"
    class="w-full"
  />

  <template v-if="activeTab === '0'">
    <div class="divide-y divide-gray-200">
      <div
        class="grid grid-cols-1 gap-y-10 px-4 py-8 sm:px-6 md:grid-cols-3 lg:px-8"
      >
        <div>
          <h2 class="text-base/7 font-semibold text-gray-900">
            Personal Information
          </h2>
          <p class="mt-1 text-sm/6 text-gray-500">
            Manage your personal details and contact information.
          </p>
        </div>

        <form class="md:col-span-2">
          <div class="">
            <h2 class="text-2xl font-semibold text-gray-900 my-6">
              General Settings
            </h2>

            <UForm :state="state" class="" @submit="onSubmit">
              <!-- Check Settings -->
              <div>
                <h3 class="text-lg font-medium text-gray-800 mb-4">
                  Check Details
                </h3>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <UFormField label="Check Number" name="check_number">
                    <UInput
                      v-model="state.check_number"
                      placeholder="Enter check number"
                      size="lg"
                      class="w-full"
                    />
                  </UFormField>

                  <UFormField
                    label="Minimum Check Amount"
                    name="min_check_amount"
                  >
                    <UInput
                      v-model="state.min_check_amount"
                      placeholder="e.g. 100.00"
                      size="lg"
                      type="number"
                      class="w-full"
                    />
                  </UFormField>
                </div>
              </div>

              <!-- Time Settings -->
              <div>
                <h3 class="text-lg font-medium text-gray-800 my-4">
                  Time & Policy
                </h3>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <UFormField label="Early Check-in" name="early_checkin">
                    <UInput
                      v-model="state.early_checkin"
                      placeholder="e.g. 10:00 AM"
                      size="lg"
                      class="w-full"
                    />
                  </UFormField>

                  <UFormField label="Late Checkout" name="late_checkout">
                    <UInput
                      v-model="state.late_checkout"
                      placeholder="e.g. 2:00 PM"
                      size="lg"
                      class="w-full"
                    />
                  </UFormField>

                  <UFormField label="Time Zone" name="time_zone">
                    <UInput
                      v-model="state.time_zone"
                      placeholder="e.g. UTC +05:00"
                      size="lg"
                      class="w-full"
                    />
                  </UFormField>
                </div>
              </div>

              <!-- Banking Info -->
              <div>
                <h3 class="text-lg font-medium text-gray-800 my-4">
                  Banking Information
                </h3>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <UFormField label="Account Number" name="account_number">
                    <UInput
                      v-model="state.account_number"
                      placeholder="Enter bank account number"
                      size="lg"
                      class="w-full"
                    />
                  </UFormField>

                  <UFormField label="Routing Number" name="routing_number">
                    <UInput
                      v-model="state.routing_number"
                      placeholder="Enter routing number"
                      size="lg"
                      class="w-full"
                    />
                  </UFormField>
                </div>
              </div>

              <!-- Display Message -->
              <div>
                <UFormField label="Display Message" name="display_msg">
                  <UInput
                    v-model="state.display_msg"
                    placeholder="e.g. Thank you for choosing our service"
                    size="lg"
                    class="w-full"
                  />
                </UFormField>
              </div>

              <!-- Submit -->
              <div class="pt-4">
                <UButton type="submit" block size="lg"> Save Settings </UButton>
              </div>
            </UForm>
          </div>
        </form>
      </div>
    </div>
  </template>

  <UCard v-if="activeTab === '1'">
    <div><h1>b</h1></div>
  </UCard>
  <template v-if="activeTab === '2'">
    <div class="divide-y divide-gray-200">
      <div
        class="grid grid-cols-1 gap-y-10 px-4 py-8 sm:px-6 md:grid-cols-3 lg:px-8"
      >
        <div>
          <h2 class="text-base/7 font-semibold text-gray-900">
            See Default Schedule
          </h2>
          <p class="mt-1 text-sm/6 text-gray-500">
            View the default weekly schedule with predefined start and end
            times.
          </p>
        </div>

        <form class="md:col-span-2">
          <div class="">
            <h2 class="text-2xl font-semibold text-gray-900 my-6">
              Weekly Schedule
            </h2>

            <UTable :columns="columns" :data="rows" />
          </div>
        </form>
      </div>
    </div>
  </template>
  <UCard v-if="activeTab === '3'">
    <div><h1>d</h1></div>
  </UCard>
  <UCard v-if="activeTab === '4'">
    <div><h1>e</h1></div>
  </UCard>
  <UCard v-if="activeTab === '5'">
    <div><h1>f</h1></div>
  </UCard>
  <UCard v-if="activeTab === '6'">
    <div><h1>g</h1></div>
  </UCard>
  <UCard v-if="activeTab === '7'">
    <div><h1>h</h1></div>
  </UCard>

  <UModal v-model:open="editScheduleModal">
    <!-- Custom Header -->
    <template #header>
      <div class="flex justify-between w-full">
        <h2 class="text-xl font-bold text-primary">Edit Schedule</h2>

        <!-- Close Button -->
        <UButton
          size="sm"
          variant="outline"
          color="primary"
          class="rounded-full p-2"
          icon="i-lucide-x"
          @click="editScheduleModal = false"
        >
        </UButton>
      </div>
    </template>
    <!-- :schema="schema" -->
    <template #body>
      <div>
        <UForm :state="scheduleState" class="space-y-4">
          <div class="flex flex-col gap-4">
            <div class="mt-2">
              <h3 class="text-base font-bold text-gray-800 mb-2">Seder A</h3>
              <div class="flex gap-2 justify-between">
                <UFormField label="Begin" class="flex gap-4 items-center">
                  <input
                    v-model="scheduleState.seder_A_begin"
                    type="time"
                    name="in"
                    id="in"
                    step="1"
                    class="bg-gray-50 w-40 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary focus:border-primary p-2.5"
                    required
                  />
                </UFormField>
                <UFormField label="End" class="flex gap-4 items-center">
                  <input
                    v-model="scheduleState.seder_A_end"
                    type="time"
                    name="in"
                    id="in"
                    step="1"
                    class="bg-gray-50 border w-40 border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary focus:border-primary p-2.5"
                    required
                  />
                </UFormField>
              </div>
            </div>
            <div class="mt-2">
              <h3 class="text-base font-bold text-gray-800 mb-2">Seder B</h3>
              <div class="flex gap-2 justify-between">
                <UFormField label="Begin" class="flex gap-4 items-center">
                  <input
                    v-model="scheduleState.seder_B_begin"
                    type="time"
                    name="in"
                    id="in"
                    step="1"
                    class="bg-gray-50 w-40 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary focus:border-primary p-2.5"
                    required
                  />
                </UFormField>
                <UFormField label="End" class="flex gap-4 items-center">
                  <input
                    v-model="scheduleState.seder_B_end"
                    type="time"
                    name="in"
                    id="in"
                    step="1"
                    class="bg-gray-50 w-40 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary focus:border-primary p-2.5"
                    required
                  />
                </UFormField>
              </div>
            </div>
          </div>
          <div
            class="flex justify-end items-center gap-2 mt-4 border-t border-gray-200 pt-4"
          >
            <UButton
              color="neutral"
              variant="solid"
              @click="editScheduleModal = false"
            >
              Cancel
            </UButton>
            <UButton
              type="submit"
              :loading="isSubmitting"
              :disabled="isSubmitting"
            >
              Update
            </UButton>
          </div>
        </UForm>
      </div>
    </template>
  </UModal>
</template>

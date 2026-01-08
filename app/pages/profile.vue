<script setup>
definePageMeta({
  layout: "sidebar",
  middleware: ["auth"],
});

const show = ref(false);
const showConfirm = ref(false);
</script>

<template>
  <div class="p-6 bg-gray-50">
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- LEFT PROFILE CARD -->
      <UCard class="rounded-2xl">
        <div class="border-t-4 border-primary-500 pt-4">
          <h2 class="text-xl font-semibold mb-4">Test Admin</h2>

          <div class="space-y-2 text-sm text-gray-700">
            <p><strong>Email:</strong> yahya.ibrahim1044@gmail.com</p>
            <p><strong>Phone:</strong> 0123456789</p>
            <p><strong>Kollel Name:</strong> yoely@fizzdata.com</p>
            <p><strong>Account ID:</strong> 948427527</p>
          </div>

          <div class="mt-6 pt-4 space-y-3 bg-gray-200 p-1.5 rounded-xl">
            <div class="flex justify-between items-center">
              <span class="text-gray-500 text-sm">Type</span>
              <UBadge color="primary">Super Admin</UBadge>
            </div>

            <div class="text-sm text-gray-500">
              Thu Jan 01 2026 <br />
              Member since 05:08:52 GMT+0500 <br />
              (Pakistan Standard Time)
            </div>
          </div>
        </div>
      </UCard>

      <!-- RIGHT EDIT FORM -->
      <UCard class="rounded-2xl lg:col-span-2">
        <div class="flex items-center gap-2 mb-6">
          <UIcon name="i-lucide-user" class="size-5" />
          <h2 class="text-lg font-semibold">Edit Me</h2>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <UFormField label="Name">
            <UInput model-value="Test Admin" class="w-full" />
          </UFormField>

          <UFormField label="Email">
            <UInput model-value="yahya.ibrahim1044@gmail.com" class="w-full" />
          </UFormField>

          <UFormField label="Address">
            <UInput class="w-full" />
          </UFormField>

          <UFormField label="Contact No.">
            <UInput model-value="0123456789" class="w-full" />
          </UFormField>

          <UFormField label="Kollel Name">
            <UInput model-value="yoely@fizzdata.com" class="w-full" />
          </UFormField>

          <UFormField label="Kollel Logo">
            <UInput type="file" class="w-full" />
          </UFormField>

          <UFormField label="Signature">
            <UInput type="file" class="w-full" />
          </UFormField>

          <UFormField label="Password">
            <UInput
              placeholder="Password"
              :type="show ? 'text' : 'password'"
              :ui="{ trailing: 'pe-1' }"
              class="w-full"
            >
              <template #trailing>
                <UButton
                  color="neutral"
                  variant="link"
                  size="sm"
                  :icon="show ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                  :aria-label="show ? 'Hide password' : 'Show password'"
                  :aria-pressed="show"
                  aria-controls="password"
                  @click="show = !show"
                />
              </template>
            </UInput>
          </UFormField>

          <UFormField label="Retype Password">
            <UInput
              placeholder="Retype Password"
              :type="showConfirm ? 'text' : 'password'"
              :ui="{ trailing: 'pe-1' }"
              class="w-full"
            >
              <template #trailing>
                <UButton
                  color="neutral"
                  variant="link"
                  size="sm"
                  :icon="showConfirm ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                  :aria-label="showConfirm ? 'Hide password' : 'Show password'"
                  :aria-pressed="showConfirm"
                  aria-controls="password"
                  @click="showConfirm = !showConfirm"
                />
              </template>
            </UInput>
          </UFormField>

          <UFormField label="Kollel Address" class="md:col-span-2">
            <UTextarea class="w-full" />
          </UFormField>
        </div>

        <div class="mt-8">
          <UButton color="primary" size="lg" block> Update </UButton>
        </div>
      </UCard>
    </div>
  </div>
</template>

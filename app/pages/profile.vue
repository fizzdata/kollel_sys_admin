<script setup>
definePageMeta({
  layout: "sidebar",
  middleware: ["auth"],
});

const api = useApi();
const toast = useToast();
const userCookie = useCookie("kollel_sys_user");
const orgCookie = useCookie("kollel_sys_org");

const show = ref(false);
const showConfirm = ref(false);
const isLoading = ref(true);
const isSavingUser = ref(false);
const isSavingKollel = ref(false);

const userForm = reactive({
  id: null,
  name: "",
  email: "",
  phone: "",
  created_at: null,
  password1: "",
  password2: "",
});

const kollelForm = reactive({
  id: null,
  kollel_name: "",
  account_id: "",
  address: "",
  logo: "",
  signature: "",
});

const memberSince = computed(() => {
  if (!userForm.id) return "";
  const userDate = new Date(userForm.created_at || Date.now());
  return userDate.toString();
});

const loadProfile = async () => {
  isLoading.value = true;

  try {
    const response = await api("/api/profile/load", {
      method: "GET",
    });

    const payload = response?.success ? response : response?._data;

    if (!payload?.success) {
      toast.add({
        title: "Error",
        description: payload?.message || "Failed to load profile",
        color: "error",
        timeout: 2500,
      });
      return;
    }

    userForm.id = payload.admin.id;
    userForm.name = payload.admin.name || "";
    userForm.email = payload.admin.email || "";
    userForm.phone = payload.admin.phone || "";
    userForm.created_at = payload.admin.created_at || null;

    kollelForm.id = payload.org.id;
    kollelForm.kollel_name = payload.org.kollel_name || "";
    kollelForm.account_id = payload.org.account_id || "";
    kollelForm.address = payload.org.address || "";
    kollelForm.logo = payload.org.logo || "";
    kollelForm.signature = payload.org.signature || "";
  } catch (error) {
    toast.add({
      title: "Error",
      description: "Failed to load profile",
      color: "error",
      timeout: 2500,
    });
  } finally {
    isLoading.value = false;
  }
};

const toDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("File reading failed"));
    reader.readAsDataURL(file);
  });

const onLogoChange = async (event) => {
  const file = event?.target?.files?.[0];
  if (!file) return;
  kollelForm.logo = await toDataUrl(file);
};

const onSignatureChange = async (event) => {
  const file = event?.target?.files?.[0];
  if (!file) return;
  kollelForm.signature = await toDataUrl(file);
};

const submitUser = async () => {
  if (userForm.password1 || userForm.password2) {
    if (userForm.password1 !== userForm.password2) {
      toast.add({
        title: "Validation",
        description: "Passwords do not match",
        color: "error",
        timeout: 2500,
      });
      return;
    }
  }

  isSavingUser.value = true;

  try {
    const response = await api("/api/profile/user/update", {
      method: "POST",
      body: {
        name: userForm.name,
        phone: userForm.phone,
        password1: userForm.password1,
        password2: userForm.password2,
      },
    });

    const payload = response?.success ? response : response?._data;

    if (!payload?.success) {
      toast.add({
        title: "Failed",
        description: payload?.message || "Failed to update user info",
        color: "error",
        timeout: 2500,
      });
      return;
    }

    userCookie.value = {
      ...(userCookie.value || {}),
      ...(payload.user || {}),
    };

    userForm.password1 = "";
    userForm.password2 = "";

    toast.add({
      title: "Success",
      description: payload?.message || "User info updated",
      color: "success",
      timeout: 2500,
    });
  } catch (error) {
    toast.add({
      title: "Error",
      description: "Failed to update user info",
      color: "error",
      timeout: 2500,
    });
  } finally {
    isSavingUser.value = false;
  }
};

const submitKollel = async () => {
  isSavingKollel.value = true;

  try {
    const response = await api("/api/profile/kollel/update", {
      method: "POST",
      body: {
        kollel_name: kollelForm.kollel_name,
        address: kollelForm.address,
        logo: kollelForm.logo,
        signature: kollelForm.signature,
      },
    });

    const payload = response?.success ? response : response?._data;

    if (!payload?.success) {
      toast.add({
        title: "Failed",
        description: payload?.message || "Failed to update kollel info",
        color: "error",
        timeout: 2500,
      });
      return;
    }

    orgCookie.value = {
      ...(orgCookie.value || {}),
      org_name: kollelForm.kollel_name,
      address: kollelForm.address,
      org_logo: kollelForm.logo,
    };

    toast.add({
      title: "Success",
      description: payload?.message || "Kollel info updated",
      color: "success",
      timeout: 2500,
    });
  } catch (error) {
    toast.add({
      title: "Error",
      description: "Failed to update kollel info",
      color: "error",
      timeout: 2500,
    });
  } finally {
    isSavingKollel.value = false;
  }
};

onMounted(loadProfile);
</script>

<template>
  <div class="p-6 bg-gray-50">
    <div v-if="isLoading" class="py-20 flex justify-center">
      <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-primary" />
    </div>

    <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- LEFT PROFILE CARD -->
      <UCard class="rounded-2xl">
        <div class="border-t-4 border-primary-500 pt-4">
          <h2 class="text-xl font-semibold mb-4">{{ userForm.name }}</h2>

          <div class="space-y-2 text-sm text-gray-700">
            <p><strong>Email:</strong> {{ userForm.email || "-" }}</p>
            <p><strong>Phone:</strong> {{ userForm.phone || "-" }}</p>
            <p><strong>Kollel Name:</strong> {{ kollelForm.kollel_name || "-" }}</p>
            <p><strong>Account ID:</strong> {{ kollelForm.account_id || "-" }}</p>
          </div>

          <div class="mt-6 pt-4 space-y-3 bg-gray-200 p-1.5 rounded-xl">
            <div class="flex justify-between items-center">
              <span class="text-gray-500 text-sm">Type</span>
              <UBadge color="primary">Super Admin</UBadge>
            </div>

            <div class="text-sm text-gray-500">
              {{ memberSince }}
            </div>
          </div>
        </div>
      </UCard>

      <!-- RIGHT FORMS -->
      <UCard class="rounded-2xl lg:col-span-2">
        <div class="flex items-center gap-2 mb-4">
          <UIcon name="i-lucide-user" class="size-5" />
          <h2 class="text-lg font-semibold">Edit Profile</h2>
        </div>

        <form class="space-y-6" @submit.prevent="submitUser">
          <h3 class="text-base font-semibold text-gray-700">User Info</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <UFormField label="Name">
              <UInput v-model="userForm.name" class="w-full" size="lg" />
            </UFormField>

            <UFormField label="Contact No.">
              <UInput v-model="userForm.phone" class="w-full" size="lg" />
            </UFormField>

            <UFormField label="Password">
              <UInput
                v-model="userForm.password1"
                placeholder="Password"
                :type="show ? 'text' : 'password'"
                :ui="{ trailing: 'pe-1' }"
                class="w-full"
                size="lg"
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
                v-model="userForm.password2"
                placeholder="Retype Password"
                :type="showConfirm ? 'text' : 'password'"
                :ui="{ trailing: 'pe-1' }"
                class="w-full"
                size="lg"
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
          </div>

          <UButton
            color="primary"
            size="lg"
            :loading="isSavingUser"
            :disabled="isSavingUser"
            type="submit"
            block
          >
            Update User Info
          </UButton>
        </form>

        <UDivider class="my-8" />

        <form class="space-y-6" @submit.prevent="submitKollel">
          <h3 class="text-base font-semibold text-gray-700">Kollel Info</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <UFormField label="Kollel Name">
              <UInput v-model="kollelForm.kollel_name" class="w-full" size="lg" />
            </UFormField>

            <UFormField label="Kollel Address">
              <UTextarea v-model="kollelForm.address" class="w-full" />
            </UFormField>

            <UFormField label="Kollel Logo">
              <div class="space-y-2">
                <img
                  v-if="kollelForm.logo"
                  :src="kollelForm.logo"
                  alt="Kollel logo"
                  class="h-14 w-14 rounded border object-contain bg-white"
                />
                <input type="file" accept=".svg,image/*" @change="onLogoChange" />
              </div>
            </UFormField>

            <UFormField label="Signature">
              <div class="space-y-2">
                <img
                  v-if="kollelForm.signature"
                  :src="kollelForm.signature"
                  alt="Kollel signature"
                  class="h-14 w-20 rounded border object-contain bg-white"
                />
                <input type="file" accept=".svg,image/*" @change="onSignatureChange" />
              </div>
            </UFormField>
          </div>

          <UButton
            color="primary"
            size="lg"
            :loading="isSavingKollel"
            :disabled="isSavingKollel"
            type="submit"
            block
          >
            Update Kollel Info
          </UButton>
        </form>
      </UCard>
    </div>
  </div>
</template>

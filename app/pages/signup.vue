<script setup>
import * as yup from "yup";

definePageMeta({
  layout: false,
});
const show = ref(false);
const confirmshow = ref(false);
const toast = useToast();
const api = useApi();
const isSubmitting = ref(false);
const router = useRouter();
const route = useRoute();
const token = useCookie("kollel_sys_token");
const org = useCookie("kollel_sys_org");
const user = useCookie("kollel_sys_user");
const hasAccess = useCookie("kollel_sys_has_access");
const inviteToken = computed(() => route.query.invite_token);
const inviteLoading = ref(false);
const inviteOrgName = ref("");

const schema = yup.object({
  name: yup
    .string()
    .matches(/^[a-zA-Z\s]+$/, "Invalid name")
    .required("Name is required"),
  password: yup
    .string()
    .min(6, "Password must be at least 6 characters")
    .required("Password is required"),
  password_confirmation: yup
    .string()
    .oneOf([yup.ref("password")], "Passwords must match")
    .required("Confirm Password is required"),
});

const state = reactive({
  name: undefined,
  email: undefined,
  password: undefined,
  password_confirmation: undefined,
  invite_token: undefined,
});

onMounted(async () => {
  if (!inviteToken.value) {
    toast.add({
      title: "Invite required",
      description: "Please use the invite link from your email.",
      color: "error",
      duration: 3000,
    });
    router.push("/login");
    return;
  }

  inviteLoading.value = true;

  try {
    const response = await api(`/api/invites/${inviteToken.value}`, {
      method: "GET",
    });

    if (response?.success) {
      state.email = response.email;
      state.invite_token = inviteToken.value;
      inviteOrgName.value = response.org?.org_name || "";
    } else {
      toast.add({
        title: "Invalid Invite",
        description:
          response?.message ||
          response?._data?.message ||
          "Invite link is invalid or has already been used",
        color: "error",
        duration: 3000,
      });
      router.push("/login");
    }
  } catch (error) {
    console.error("Error loading invite:", error);
    toast.add({
      title: "Error",
      description: "Unable to load invite",
      color: "error",
      duration: 3000,
    });
  } finally {
    inviteLoading.value = false;
  }
});

async function onSubmit(event) {
  try {
    isSubmitting.value = true;
    const body = {
      invite_token: inviteToken.value,
      name: event.data.name,
      password: event.data.password,
      password_confirmation: event.data.password_confirmation,
    };
    const response = await api("/api/register", {
      method: "POST",
      body,
    });

    if (response?.success) {
      token.value = response?.access_token || "";
      org.value = response?.org || null;
      user.value = response?.user || null;
      hasAccess.value = response?.has_access || [];
      router.push(`/${response?.has_access?.[0] || "dashboard"}`);

      toast.add({
        title: "Success",
        description: response?.message || "Signup Successfully",
        color: "success",
        duration: 2000,
      });
    } else {
      toast.add({
        title: "Failed",
        description:
          response?._data?.errors ||
          response?._data?.message ||
          response?.message ||
          "Failed to complete account",
        color: "error",
        duration: 2000,
      });
    }
  } catch (error) {
    console.error("Error completing signup:", error);
    toast.add({
      title: "Error",
      description: "An error occurred while completing signup. Please try again later.",
      color: "error",
      duration: 2000,
    });
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <div
    class="relative flex min-h-screen items-center justify-center bg-gray-50 px-4"
  >
    <!-- Animated background blobs (like hero section) -->
    <div class="absolute inset-0 overflow-hidden pointer-events-none">
      <div
        class="absolute -top-40 -left-40 w-64 h-64 bg-indigo-200 rounded-full mix-blend-multiply filter blur-xl opacity-40 animate-pulse-slow"
      ></div>
      <div
        class="absolute -bottom-40 -right-40 w-64 h-64 bg-indigo-200 rounded-full mix-blend-multiply filter blur-xl opacity-40 animate-pulse-slow animation-delay-2000"
      ></div>
    </div>
    <UCard class="w-full max-w-lg rounded-2xl shadow-xl py-6 sm:py-8">
      <!-- Brand -->
      <div class="mb-6 text-center">
        <ULink to="/">
          <h2 class="text-3xl font-bold text-primary">Kollel System</h2>
        </ULink>
        <ULink to="http://fizzdata.com/" target="_blank" class="block">
          <p class="mt-1 text-sm text-gray-500">by Fizz Data</p>
        </ULink>
      </div>

      <!-- Title -->
      <p class="my-6 text-center text-lg font-medium text-gray-800">
        Complete your account
      </p>
      <p
        v-if="inviteOrgName"
        class="mb-6 text-center text-sm text-gray-500"
      >
        {{ state.email }} was invited to {{ inviteOrgName }}
      </p>

      <!-- Form -->
      <UForm
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <div class="space-y-4">
          <UFormField label="Name" name="name" required>
            <UInput
              v-model="state.name"
              placeholder="Enter your name"
              size="lg"
              class="w-full"
              :disabled="inviteLoading"
            />
          </UFormField>
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <UFormField label="Password" name="password" required>
              <UInput
                v-model="state.password"
                placeholder="Password"
                :type="show ? 'text' : 'password'"
                :ui="{ trailing: 'pe-1' }"
                class="w-full"
                size="lg"
                :disabled="inviteLoading"
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
            <UFormField
              label="Confirm Password"
              name="password_confirmation"
              required
            >
              <UInput
                v-model="state.password_confirmation"
                placeholder="Confirm password"
                :type="confirmshow ? 'text' : 'password'"
                :ui="{ trailing: 'pe-1' }"
                class="w-full"
                size="lg"
                :disabled="inviteLoading"
              >
                <template #trailing>
                  <UButton
                    color="neutral"
                    variant="link"
                    size="sm"
                    :icon="confirmshow ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                    :aria-label="confirmshow ? 'Hide password' : 'Show password'"
                    :aria-pressed="confirmshow"
                    aria-controls="password"
                    @click="confirmshow = !confirmshow"
                  />
                </template>
              </UInput>
            </UFormField>
          </div>
        </div>
        <UButton
          type="submit"
          :loading="isSubmitting"
          :disabled="isSubmitting || inviteLoading"
          block
          size="lg"
          label="Complete Account"
        />
      </UForm>

      <!-- Footer -->
      <p class="mt-8 text-center text-sm text-gray-500">
        Already have an account?
        <ULink
          to="/login"
          class="font-semibold text-primary hover:text-gray-500"
        >
          Login!
        </ULink>
      </p>
    </UCard>
  </div>
</template>

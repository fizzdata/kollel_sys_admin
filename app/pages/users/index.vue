<script setup>
import { h } from "vue";
import * as yup from "yup";

definePageMeta({
  layout: "sidebar",
  middleware: ["auth"],
});

const api = useApi();
const toast = useToast();
const org_id = useCookie("org_id");

// Reactive state
const loading = ref(false);
const usersData = ref([]);
const inviteModalOpen = ref(false);
const inviteLoading = ref(false);
const inviteState = reactive({
  email: undefined,
  role: "admin",
});
const roleOptions = [
  { label: "Admin", value: "admin" },
  { label: "Super Admin", value: "super_admin" },
];
const inviteSchema = yup.object({
  email: yup.string().email("Invalid email").required("Email is required"),
  role: yup
    .string()
    .oneOf(roleOptions.map((role) => role.value))
    .required("Role is required"),
});

const formatRole = (role) => {
  return role === "super_admin" ? "Super Admin" : "Admin";
};

// Fetch users and departments on mount
onMounted(async () => {
  await fetchData();
});

// Fetch users data with departments and access info
const fetchData = async () => {
  loading.value = true;
  try {
    const response = await api("/api/users", {
      method: "GET",
      query: { org_id: org_id.value },
    });

    if (response.success) {
      // Handle different response structures
      usersData.value = response.users || response.data || response || [];
    } else {
      console.error("API Error:", response);
      toast.add({
        description: response.message || "Failed to fetch users",
        color: "error",
        timeout: 3000,
      });
    }
  } catch (error) {
    console.error("Error fetching data:", error);
    toast.add({
      description: "Error fetching data",
      color: "error",
      timeout: 3000,
    });
  } finally {
    loading.value = false;
  }
};

const inviteUser = async (event) => {
  inviteLoading.value = true;

  try {
    const response = await api("/api/users/invite", {
      method: "POST",
      body: {
        email: event.data.email,
        role: event.data.role,
        org_id: org_id.value,
      },
    });

    if (response?.success) {
      toast.add({
        title: "Success",
        description: response.message || "Invite sent successfully",
        color: "success",
        timeout: 2000,
      });
      inviteState.email = undefined;
      inviteState.role = "admin";
      inviteModalOpen.value = false;
      await fetchData();
    } else {
      toast.add({
        title: "Failed",
        description:
          response?.message ||
          response?._data?.message ||
          "Failed to send invite",
        color: "error",
        timeout: 3000,
      });
    }
  } catch (error) {
    console.error("Error inviting user:", error);
    toast.add({
      title: "Error",
      description: "Error sending invite",
      color: "error",
      timeout: 3000,
    });
  } finally {
    inviteLoading.value = false;
  }
};

// Toggle user access to department
const toggleAccess = async (userId, departmentId, currentAccess) => {
  try {
    const endpoint = currentAccess
      ? "/api/users/departments/detach"
      : "/api/users/departments/attach";
    const method = currentAccess ? "DELETE" : "POST";

    const response = await api(endpoint, {
      method: method,
      body: { user_id: userId, department_id: departmentId },
    });
    console.log("response", response);

    if (response?.success) {
      toast.add({
        title: "Success",
        description: response?.message
          ? response?.message
          : currentAccess
            ? "Access removed successfully"
            : "Access granted successfully",
        color: "success",
        timeout: 2000,
      });

      await fetchData(); // Refresh data
    } else {
      toast.add({
        title: "Failded",
        description: response.message || "Operation failed",
        color: "error",
        timeout: 3000,
      });
    }
  } catch (error) {
    console.error("Error toggling access:", error);
    toast.add({
      description: "Error updating access",
      color: "error",
      timeout: 3000,
    });
  }
};

// User columns for the table
const userColumns = [
  {
    accessorKey: "user_name",
    header: "Name",
    cell: ({ row }) => {
      return h("div", { class: "flex items-center space-x-3" }, [
        h(
          "div",
          {
            class:
              "flex-shrink-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center",
          },
          [
            h(resolveComponent("UIcon"), {
              name: "i-heroicons-user",
              class: "w-4 h-4 text-white",
            }),
          ],
        ),
        h("div", {}, [
          h(
            "div",
            {
              class: "font-medium text-gray-900 ",
            },
            row.original.user_name || "Invited user",
          ),
          h(
            "div",
            {
              class: "text-sm text-gray-500 ",
            },
            `ID: ${row.original.user_id}`,
          ),
        ]),
      ]);
    },
  },
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ row }) => {
      const email = row.original.email;
      return email
        ? h(
            "a",
            {
              href: `mailto:${email}`,
              class: "text-primary-600 hover:underline",
            },
            email,
          )
        : h(
            "span",
            {
              class: "text-gray-400 italic",
            },
            "No email provided",
          );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const isInvited = row.original.status === "invited";
      return h(
        resolveComponent("UBadge"),
        {
          color: isInvited ? "warning" : "success",
          variant: "soft",
          size: "xs",
        },
        {
          default: () => (isInvited ? "Invited" : "Active"),
        },
      );
    },
  },
  {
    accessorKey: "role",
    header: "Role",
    cell: ({ row }) => {
      const isSuperAdmin = row.original.role === "super_admin";

      return h(
        resolveComponent("UBadge"),
        {
          color: isSuperAdmin ? "primary" : "neutral",
          variant: "soft",
          size: "xs",
        },
        {
          default: () => formatRole(row.original.role),
        },
      );
    },
  },
  {
    accessorKey: "departments",
    header: "Department Access",
    cell: ({ row }) => {
      const departments = row.original.departments || [];

      if (departments.length === 0) {
        return h("div", { class: "text-center py-4" }, [
          h(resolveComponent("UIcon"), {
            name: "i-lucide-building",
            class: "w-6 h-6 mx-auto text-gray-400 mb-1",
          }),
          h(
            "p",
            {
              class: "text-sm text-gray-500 italic",
            },
            "No departments available",
          ),
        ]);
      }

      return h(
        "div",
        { class: "space-y-2  grid xl:grid-cols-2 gap-2" },
        departments.map((department) =>
          h(
            "div",
            {
              key: department.id,
              class: `flex items-center justify-between py-2 px-3 rounded-lg border transition-colors ${
                department.has_access
                  ? "border-green-200 bg-green-50"
                  : "border-gray-200 bg-gray-50"
              }`,
            },
            [
              h("div", { class: "flex items-center space-x-2" }, [
                h(resolveComponent("UIcon"), {
                  name: "i-lucide-building",
                  class: `w-4 h-4 ${department.has_access ? "text-green-600" : "text-gray-500"}`,
                }),
                h(
                  "span",
                  {
                    class: `text-sm font-medium capitalize ${department.has_access ? "text-green-800" : "text-gray-700"}`,
                  },
                  department.name,
                ),
                h(
                  resolveComponent("UBadge"),
                  {
                    color: department.has_access ? "success" : "primary",
                    variant: "soft",
                    size: "xs",
                  },
                  {
                    default: () =>
                      department.has_access ? "Access" : "No Access",
                  },
                ),
              ]),
              h(
                resolveComponent("UButton"),
                {
                  color: department.has_access ? "error" : "success",
                  variant: department.has_access ? "outline" : "solid",
                  size: "xs",
                  class: "ml-2 cursor-pointer flex items-center",
                  onClick: () =>
                    toggleAccess(
                      row.original.user_id,
                      department.id,
                      department.has_access,
                    ),
                },
                {
                  default: () => [
                    h(resolveComponent("UIcon"), {
                      name: department.has_access
                        ? "i-heroicons-minus-circle"
                        : "i-heroicons-plus-circle",
                      class: "w-3 h-3 mr-1",
                    }),
                    department.has_access ? "Remove" : "Grant",
                  ],
                },
              ),
            ],
          ),
        ),
      );
    },
  },
];
</script>

<template>
  <UCard class="rounded-2xl shadow-sm">
    <div
      class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <h1 class="text-lg sm:text-xl font-bold">User Management</h1>
        <p class="text-gray-600">Manage user access to departments</p>
      </div>
      <div class="flex flex-wrap gap-2 sm:gap-2 sm:justify-end">
        <UBadge
          v-if="usersData.length > 0"
          color="primary"
          variant="soft"
          size="lg"
        >
          {{ usersData.length }} Users
        </UBadge>
        <UButton
          label="Invite User"
          icon="i-lucide-mail-plus"
          color="primary"
          variant="solid"
          @click="inviteModalOpen = true"
        />
        <UButton
          label="Refresh"
          icon="i-heroicons-arrow-path"
          :loading="loading"
          :disabled="loading"
          @click="fetchData"
        />
      </div>
    </div>
  </UCard>

  <!-- Users Table -->
  <UCard class="rounded-2xl shadow-sm mt-6">
    <div
      class="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-0"
    >
      <h2 class="md:text-lg text-base font-bold">Users & Department Access</h2>
    </div>

    <!-- Users Table -->
    <UTable
      :columns="userColumns"
      :data="usersData"
      :loading="loading"
      sticky
      class="flex-1 md:mt-6 mt-2 max-h-160"
    />
  </UCard>

  <UModal v-model:open="inviteModalOpen" title="Invite User">
    <template #body>
      <UForm
        :schema="inviteSchema"
        :state="inviteState"
        class="space-y-4"
        @submit="inviteUser"
      >
        <UFormField label="Email" name="email" required>
          <UInput
            v-model="inviteState.email"
            placeholder="user@example.com"
            type="email"
            class="w-full"
            size="lg"
          />
        </UFormField>
        <UFormField label="Role" name="role" required>
          <USelect
            v-model="inviteState.role"
            :items="roleOptions"
            class="w-full"
            size="lg"
          />
        </UFormField>

        <div class="flex justify-end gap-2 border-t border-gray-200 pt-4">
          <UButton
            label="Cancel"
            color="neutral"
            variant="outline"
            :disabled="inviteLoading"
            @click="inviteModalOpen = false"
          />
          <UButton
            type="submit"
            label="Send Invite"
            icon="i-lucide-send"
            :loading="inviteLoading"
            :disabled="inviteLoading"
          />
        </div>
      </UForm>
    </template>
  </UModal>
</template>

<style scoped>
/* Ensure the table cells don't collapse and improve spacing */
:deep(.departments-data) {
  min-width: 400px;
}

:deep(td) {
  vertical-align: top;
  padding-top: 1rem;
  padding-bottom: 1rem;
}

:deep(.user_name-data) {
  min-width: 150px;
}

:deep(.email-data) {
  min-width: 200px;
}
</style>

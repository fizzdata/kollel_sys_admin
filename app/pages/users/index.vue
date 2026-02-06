<script setup>
import { h } from 'vue';

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

// Fetch users and departments on mount
onMounted(async () => {
  await fetchData();
});

// Fetch users data with departments and access info
const fetchData = async () => {
  loading.value = true;
  try {
    const response = await api('/api/users', {
      method: 'GET',
      query: { org_id: org_id.value }
    });
    
    console.log('Full API Response:', response);
    
    if (response.success) {
      // Handle different response structures
      usersData.value = response.users || response.data || response || [];
      console.log('Users loaded:', usersData.value);
      console.log('Users data structure:', usersData.value[0]);
    } else {
      console.error('API Error:', response);
      toast.add({
        description: response.message || 'Failed to fetch users',
        color: 'red',
        timeout: 3000,
      });
    }
  } catch (error) {
    console.error('Error fetching data:', error);
    toast.add({
      description: 'Error fetching data',
      color: 'red',
      timeout: 3000,
    });
  } finally {
    loading.value = false;
  }
};

// Toggle user access to department
const toggleAccess = async (userId, departmentId, currentAccess) => {
  try {
    const endpoint = currentAccess ? '/api/users/departments/detach' : '/api/users/departments/attach';
    const method = currentAccess ? 'DELETE' : 'POST';
    
    const response = await api(endpoint, {
      method: method,
      body: { user_id: userId, department_id: departmentId }
    });

    if (response.success) {
      toast.add({
        description: currentAccess ? 'Access removed successfully' : 'Access granted successfully',
        color: 'green',
        timeout: 2000,
      });
      await fetchData(); // Refresh data
    } else {
      toast.add({
        description: response.message || 'Operation failed',
        color: 'red',
        timeout: 3000,
      });
    }
  } catch (error) {
    console.error('Error toggling access:', error);
    toast.add({
      description: 'Error updating access',
      color: 'red',
      timeout: 3000,
    });
  }
};

// User columns for the table
const userColumns = [
  { 
    accessorKey: 'user_name', 
    header: 'Name',
    cell: ({ row }) => {
      return h('div', { class: 'flex items-center space-x-3' }, [
        h('div', { 
          class: 'flex-shrink-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center' 
        }, [
          h('UIcon', { 
            name: 'i-heroicons-user', 
            class: 'w-4 h-4 text-white' 
          })
        ]),
        h('div', {}, [
          h('div', { 
            class: 'font-medium text-gray-900 dark:text-white' 
          }, row.original.user_name),
          h('div', { 
            class: 'text-sm text-gray-500 dark:text-gray-400' 
          }, `ID: ${row.original.user_id}`)
        ])
      ]);
    }
  },
  { 
    accessorKey: 'email', 
    header: 'Email',
    cell: ({ row }) => {
      return h('span', { 
        class: 'text-gray-600 dark:text-gray-400' 
      }, row.original.email || 'No email provided');
    }
  },
  { 
    accessorKey: 'departments', 
    header: 'Department Access',
    cell: ({ row }) => {
      const departments = row.original.departments || [];
      
      if (departments.length === 0) {
        return h('div', { class: 'text-center py-4' }, [
          h('UIcon', { 
            name: 'i-heroicons-building-office-2', 
            class: 'w-6 h-6 mx-auto text-gray-400 mb-1' 
          }),
          h('p', { 
            class: 'text-sm text-gray-500 dark:text-gray-400 italic' 
          }, 'No departments available')
        ]);
      }
      
      return h('div', { class: 'space-y-2 max-w-lg' }, 
        departments.map((department) => 
          h('div', { 
            key: department.id,
            class: `flex items-center justify-between py-2 px-3 rounded-lg border transition-colors ${
              department.has_access 
                ? 'border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800' 
                : 'border-gray-200 bg-gray-50 dark:bg-gray-800 dark:border-gray-700'
            }`
          }, [
            h('div', { class: 'flex items-center space-x-2 flex-1' }, [
              h('UIcon', { 
                name: 'i-heroicons-building-office-2', 
                class: `w-4 h-4 ${department.has_access ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`
              }),
              h('span', { 
                class: `text-sm font-medium ${department.has_access ? 'text-green-800 dark:text-green-200' : 'text-gray-700 dark:text-gray-300'}`
              }, department.name),
              h('UBadge', { 
                color: department.has_access ? 'green' : 'gray',
                variant: 'soft',
                size: 'xs'
              }, department.has_access ? 'Access' : 'No Access')
            ]),
            h('UButton', {
              onClick: () => toggleAccess(row.original.user_id, department.id, department.has_access),
              color: department.has_access ? 'red' : 'green',
              variant: department.has_access ? 'outline' : 'solid',
              size: 'xs',
              class: 'ml-2 cursor-pointer'
            }, [
              h('UIcon', { 
                name: department.has_access ? 'i-heroicons-minus-circle' : 'i-heroicons-plus-circle', 
                class: 'w-3 h-3 mr-1' 
              }),
              department.has_access ? 'Remove' : 'Grant'
            ])
          ])
        )
      );
    }
  }
];
</script>

<template>
  <div class="max-w-6xl mx-auto px-6 py-8">
    <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 class="text-3xl font-semibold text-primary">User Management</h1>
        <p class="text-gray-600">
          Manage user access to departments
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <UBadge color="primary" variant="soft" size="lg">{{ usersData.length }} Users</UBadge>
        <UButton 
          label="Refresh" 
          icon="i-heroicons-arrow-path" 
          :loading="loading"
          @click="fetchData"
        />
      </div>
    </div>

    <!-- Users Table -->
    <UCard class="rounded-2xl shadow-sm mt-6">
      <div class="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-4 md:mb-0">
        <h2 class="text-xl font-bold">Users & Department Access</h2>
      </div>

      <!-- Users Table -->
      <UTable
        :columns="userColumns"
        :data="usersData"
        :loading="loading"
        class="flex-1 mt-6"
      />

    </UCard>

    <!-- Loading State -->
    <div v-if="loading && !usersData.length" class="flex justify-center items-center py-20">
      <BaseSpinner />
    </div>
  </div>
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
  
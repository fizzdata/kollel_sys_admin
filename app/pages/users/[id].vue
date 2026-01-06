<script setup>
const route = useRoute();
console.log("🚀 ~ route:", route);
const studentId = route.params.id;
const loading = ref(false);
const api = useApi();
const org_id = 10869442;

const fetchStudentDetail = async () => {
  try {
    loading.value = true;
    const response = await api(`/api/${org_id}/students/${studentId}`);
    console.log("🚀 ~ fetchStudentDetail ~ response:", response);

    return;
    if (response?.success) {
      users.value = response?.Students;
      console.log(users.value);
    } else if (!response?.success) {
      // isValidId.value = false;
      // errorMessage.value = response?.msg || "Org not found";
    }
  } catch (err) {
    console.log("🚀 ~ fetchStudents ~ err:", err);
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  await fetchStudentDetail();
});
</script>

<template>
  <div>User Detail Page</div>
</template>

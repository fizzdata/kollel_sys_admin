<script setup>
import { sec_to_time } from "~/common/common";

const props = defineProps({
  modelValue: { type: Boolean, default: false },
});

const emit = defineEmits(["update:modelValue"]);

const api = useApi();
const searchTerm = ref("");
const loading = ref(false);
const groups = ref([]);
let debounceTimer = null;

const studentName = (s) =>
  `${s.first_yiddish_name || s.first_name || ""} ${
    s.last_yiddish_name || s.last_name || ""
  }`.trim();

const goTo = (path) => {
  emit("update:modelValue", false);
  navigateTo(path);
};

const runSearch = async (q) => {
  if (!q || q.trim().length < 2) {
    groups.value = [];
    return;
  }

  loading.value = true;

  try {
    const response = await api("/api/search", {
      method: "GET",
      params: { q },
    });

    const results = response?.results || {};

    groups.value = [
      {
        id: "students",
        label: "Students",
        ignoreFilter: true,
        items: (results.students || []).map((s) => ({
          label: studentName(s),
          suffix: s.phone,
          icon: "i-lucide-user",
          onSelect: () => goTo(`/students/${s.id}`),
        })),
      },
      {
        id: "schedule",
        label: "Schedule",
        ignoreFilter: true,
        items: (results.schedule || []).map((d) => ({
          label: d.day,
          suffix: `Session ${d.session} · ${sec_to_time(d.start, false)} - ${sec_to_time(d.end, false)}`,
          icon: "i-lucide-calendar",
          onSelect: () => goTo("/schedule"),
        })),
      },
      {
        id: "payees",
        label: "Payees",
        ignoreFilter: true,
        items: (results.payees || []).map((p) => ({
          label: p.name,
          icon: "i-lucide-building-2",
          onSelect: () => goTo("/payees"),
        })),
      },
      {
        id: "transactions",
        label: "Transactions",
        ignoreFilter: true,
        items: (results.transactions || []).map((t) => ({
          label: `${studentName(t)} — $${t.amount}`,
          suffix: t.description,
          icon: "i-lucide-credit-card",
          onSelect: () => goTo(`/students/${t.student_id}`),
        })),
      },
      {
        id: "checks",
        label: "Checks",
        ignoreFilter: true,
        items: (results.checks || []).map((c) => ({
          label: `${studentName(c)} — Check #${c.check_number}`,
          suffix: `$${c.amount} to ${c.pay_to}`,
          icon: "i-lucide-file-check",
          onSelect: () => goTo(`/students/${c.student_id}`),
        })),
      },
    ].filter((group) => group.items.length);
  } catch (error) {
    console.error("Search error:", error);
  } finally {
    loading.value = false;
  }
};

watch(searchTerm, (value) => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => runSearch(value), 300);
});

watch(
  () => props.modelValue,
  (open) => {
    if (!open) {
      searchTerm.value = "";
      groups.value = [];
    }
  },
);
</script>

<template>
  <UModal :open="modelValue" @update:open="emit('update:modelValue', $event)">
    <template #content>
      <UCommandPalette
        v-model:search-term="searchTerm"
        :groups="groups"
        :loading="loading"
        placeholder="Search students, transactions, checks, payees, schedule..."
        close
        @update:open="emit('update:modelValue', $event)"
      >
        <template #empty>
          <p class="text-sm text-gray-500 text-center py-6">
            {{
              searchTerm.trim().length < 2
                ? "Type at least 2 characters to search"
                : "No results found"
            }}
          </p>
        </template>
      </UCommandPalette>
    </template>
  </UModal>
</template>

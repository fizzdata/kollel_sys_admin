<script setup>
const route = useRoute();

const navigation = [
  { name: "Payroll", href: `/payroll` },
  { name: "Transaction", href: `#` },
  { name: "User Management", href: `#` },
  { name: "Clocking Department", href: `#` },
  { name: "Payment Management", href: `#` },
  { name: "Collage Management", href: `#` },
  { name: "Profile", href: `#` },
  { name: "Login", href: `/login` },
];
</script>

<template>
  <header class="border-b border-gray-200 bg-primary">
    <UContainer>
      <nav
        class="flex flex-col items-center justify-between py-6 gap-4"
        aria-label="Global"
      >
        <div class="flex lg:flex-1">
          <ULink to="/" class="-m-1.5 p-1.5">
            <span class="font-bold text-white">KollelSys Admin </span>
          </ULink>
        </div>
        <div class="flex gap-x-4 lg:gap-x-8">
          <ULink
            v-for="item in navigation"
            :key="item.name"
            :to="item.href"
            :class="[
              'nav-link text-white hover:text-white font-medium',
              route.path === item.href ? 'font-bold' : '',
            ]"
          >
            {{ item.name }}
          </ULink>
        </div>
      </nav>
    </UContainer>
  </header>
</template>

<style scoped>
.nav-link {
  position: relative;
}
.nav-link::after {
  content: "";
  position: absolute;
  bottom: -2px;
  left: 0;
  width: 0;
  height: 2px;
  background: #ffffff;
  transition: width 0.3s ease;
}
.nav-link:hover::after {
  width: 100%;
  color: white;
}
</style>

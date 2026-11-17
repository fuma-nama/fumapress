<script setup lang="ts">
import { ref } from "vue";
import HomeLayout from "@fumapress/vue/theme/HomeLayout.vue";

const count = ref(0);
</script>

<template>
  <HomeLayout>
    <div class="page">
      <h1>About</h1>
      <p>A custom page: a Vue file under <code>src/pages</code>.</p>
      <button type="button" @click="count++">Clicked {{ count }} times</button>
    </div>
  </HomeLayout>
</template>

<!-- the colors and sizes of the UI are CSS variables, so a page of your own matches it -->
<style scoped>
.page {
  width: 100%;
  max-width: var(--fd-layout-width);
  margin: 0 auto;
  padding: 3rem 1rem;
}

h1 {
  margin-bottom: 1rem;
  font-size: 1.875rem;
  font-weight: 600;
}

p {
  margin-bottom: 1.5rem;
  color: var(--color-fd-muted-foreground);
}

button {
  padding: 0.375rem 0.75rem;
  border: 1px solid var(--color-fd-border);
  border-radius: 0.375rem;
  background: var(--color-fd-secondary);
  color: var(--color-fd-secondary-foreground);
  font-size: 0.875rem;
  font-weight: 500;
}
</style>

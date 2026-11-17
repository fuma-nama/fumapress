<script setup lang="ts">
import { Link } from "@fumapress/vue/client";
import HomeLayout from "@fumapress/vue/theme/HomeLayout.vue";

// the props of the `releases` view, from the plugin in `press.config.ts`
defineProps<{ releases: { title: string; url: string }[] }>();
</script>

<template>
  <HomeLayout>
    <div class="page">
      <h1>Releases</h1>
      <ul>
        <li v-for="release in releases" :key="release.url">
          <Link :href="release.url" class="release">{{ release.title }}</Link>
        </li>
      </ul>
    </div>
  </HomeLayout>
</template>

<style scoped>
.page {
  width: 100%;
  max-width: var(--fd-layout-width);
  margin: 0 auto;
  padding: 3rem 1rem;
}

h1 {
  margin-bottom: 1.5rem;
  font-size: 1.875rem;
  font-weight: 600;
}

ul {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.release {
  display: block;
  padding: 1rem;
  border: 1px solid var(--color-fd-border);
  border-radius: 0.5rem;
  background: var(--color-fd-card);
  color: var(--color-fd-card-foreground);
  font-weight: 500;
}

.release:hover {
  background: var(--color-fd-accent);
}
</style>

<script setup lang="ts">
import type { PageOf } from "@fumapress/vue/client";
import HomeLayout from "@fumapress/vue/theme/layouts/home";
import type app from "../../press.config";

// a post of `blog/`: its frontmatter, typed by the schema of the collection, and its content
defineProps<{ page: PageOf<typeof app, "blog"> }>();
</script>

<template>
  <HomeLayout>
    <article class="page">
      <h1>{{ page.data.title }}</h1>
      <p class="info">{{ page.data.date }} · {{ page.data.tags.join(", ") }}</p>
      <!-- the compiled Markdown, with the components of the theme -->
      <div class="prose">
        <component :is="page.Content" />
      </div>
    </article>
  </HomeLayout>
</template>

<style scoped>
.page {
  width: 100%;
  max-width: 48rem;
  margin: 0 auto;
  padding: 3rem 1rem;
}

h1 {
  margin-bottom: 0.5rem;
  font-size: 1.875rem;
  font-weight: 600;
}

.info {
  margin-bottom: 2rem;
  color: var(--color-fd-muted-foreground);
  font-size: 0.875rem;
}
</style>

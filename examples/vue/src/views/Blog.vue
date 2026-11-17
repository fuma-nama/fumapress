<script setup lang="ts">
import { Link } from "@fumapress/vue/client";
import HomeLayout from "@fumapress/vue/theme/HomeLayout.vue";

// the props of the `blog.index` view, from `press.config.ts`
defineProps<{ posts: { title: string; url: string; date: string; tags: string[] }[] }>();
</script>

<template>
  <HomeLayout>
    <div class="page">
      <h1>Blog</h1>
      <ul>
        <li v-for="post in posts" :key="post.url">
          <Link :href="post.url" class="post">
            <span class="title">{{ post.title }}</span>
            <span class="info">{{ post.date }} · {{ post.tags.join(", ") }}</span>
          </Link>
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

.post {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 1rem;
  border: 1px solid var(--color-fd-border);
  border-radius: 0.5rem;
  background: var(--color-fd-card);
  color: var(--color-fd-card-foreground);
}

.post:hover {
  background: var(--color-fd-accent);
}

.title {
  font-weight: 500;
}

.info {
  color: var(--color-fd-muted-foreground);
  font-size: 0.875rem;
}
</style>

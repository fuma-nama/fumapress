<script setup lang="ts">
import { Link } from "@fumapress/vue/client";
import HomeLayout from "@fumapress/vue/theme/HomeLayout.vue";

// the props of the `releases` view, from the plugin in `press.config.ts`
defineProps<{ releases: { title: string; url: string }[] }>();
</script>

<template>
  <HomeLayout>
    <div class="mx-auto w-full max-w-(--fd-layout-width) px-4 py-12">
      <h1 class="mb-6 text-3xl font-semibold">Releases</h1>
      <ul class="flex flex-col gap-2">
        <li v-for="release in releases" :key="release.url">
          <Link
            :href="release.url"
            class="block rounded-lg border bg-fd-card p-4 font-medium text-fd-card-foreground hover:bg-fd-accent"
          >
            {{ release.title }}
          </Link>
        </li>
      </ul>
    </div>
  </HomeLayout>
</template>

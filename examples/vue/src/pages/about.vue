<script setup lang="ts">
import { ref } from "vue";
import HomeLayout from "@fumapress/vue/theme/HomeLayout.vue";

const count = ref(0);
</script>

<template>
  <HomeLayout>
    <div class="mx-auto w-full max-w-(--fd-layout-width) px-4 py-12">
      <h1 class="mb-4 text-3xl font-semibold">About</h1>
      <p class="mb-6 text-fd-muted-foreground">
        A custom page: a Vue file under <code>src/pages</code>.
      </p>
      <button
        type="button"
        class="rounded-md border bg-fd-secondary px-3 py-1.5 text-sm font-medium text-fd-secondary-foreground"
        @click="count++"
      >
        Clicked {{ count }} times
      </button>
    </div>
  </HomeLayout>
</template>

<script setup lang="ts">
import { useLayoutProps } from "@fumapress/vue/client";
import { HomeLayout } from "../ui/layouts/home";

// the home layout of Fumadocs UI with the navbar of the site, for custom pages
const { nav, links, githubUrl } = useLayoutProps();
</script>

<template>
  <HomeLayout :nav="nav" :links="links" :github-url="githubUrl">
    <slot />
  </HomeLayout>
</template>

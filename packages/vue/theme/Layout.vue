<script setup lang="ts">
import { defineAsyncComponent } from "vue";
import { useLayoutProps, usePage, usePageTree, usePress } from "@fumapress/vue/client";
import { DocsLayout } from "../ui/layouts/docs";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  EditOnGitHub,
  PageLastUpdate,
} from "../ui/layouts/docs/page";

// another layout, which only a URL without a page needs
const NotFound = defineAsyncComponent(() => import("./NotFound.vue"));

const page = usePage();
const tree = usePageTree();
const { components } = usePress();
const { nav, links, githubUrl } = useLayoutProps();
</script>

<template>
  <!-- the page of a plugin: its component renders the layout it wants -->
  <component :is="page.Content" v-if="page?.view" :key="page.url" />
  <DocsLayout v-else-if="page" :tree="tree" :nav="nav" :links="links" :github-url="githubUrl">
    <DocsPage :key="page.url" :toc="page.toc" :full="page.data.full">
      <DocsTitle>{{ page.data.title }}</DocsTitle>
      <DocsDescription>{{ page.data.description }}</DocsDescription>
      <DocsBody>
        <component :is="page.Content" :components="components" />
      </DocsBody>
      <div class="flex flex-row flex-wrap items-center justify-between gap-4 empty:hidden">
        <EditOnGitHub v-if="page.data.githubUrl" :href="page.data.githubUrl" />
        <PageLastUpdate v-if="page.data.lastModified" :date="new Date(page.data.lastModified)" />
      </div>
    </DocsPage>
  </DocsLayout>
  <NotFound v-else />
</template>

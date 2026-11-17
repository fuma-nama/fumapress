<script setup lang="ts">
import { computed, unref } from "vue";
import { useIsDocsLayout } from "../layouts/docs/client";
import * as Docs from "../layouts/docs/page";
import * as Notebook from "../layouts/notebook/page";
import type { EditOnGitHubOptions } from "./context";

// the other props of the page of the layout reach it as attributes
const props = defineProps<{
  editOnGithub?: EditOnGitHubOptions;
  lastUpdate?: Date | string | number;
}>();
const isDocsLayout = useIsDocsLayout();
const layout = computed(() => (unref(isDocsLayout) ? Docs : Notebook));
const editHref = computed(() => {
  const editOnGithub = props.editOnGithub;
  if (!editOnGithub) return;

  return `https://github.com/${editOnGithub.owner}/${editOnGithub.repo}/blob/${editOnGithub.sha ?? "main"}/${encodeURI(editOnGithub.path.startsWith("/") ? editOnGithub.path.slice(1) : editOnGithub.path)}`;
});
</script>

<template>
  <component :is="layout.DocsPage">
    <slot />
    <div class="flex flex-row flex-wrap items-center justify-between gap-4 empty:hidden">
      <component :is="layout.EditOnGitHub" v-if="editOnGithub" :href="editHref" />
      <component :is="layout.PageLastUpdate" v-if="lastUpdate" :date="new Date(lastUpdate)" />
    </div>
  </component>
</template>

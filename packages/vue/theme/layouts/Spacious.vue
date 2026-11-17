<script setup lang="ts" generic="Page extends ContentPage">
import { usePageTree, type ContentPage } from "@fumapress/vue/client";
import { DocsLayout, type DocsLayoutProps } from "../../ui/layouts/spacious";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  EditOnGitHub,
  PageLastUpdate,
  type DocsPageProps,
} from "../../ui/layouts/spacious/page";
import { mergeLayoutProps } from ".";

/**
 * A content page in the spacious layout. `layoutProps` win over `ui.layoutProps` of the config, `pageProps` over the
 * page data, and both can hold components and functions.
 */
const props = defineProps<{
  // any content page: the component of `views` for any source
  page: Page;
  layoutProps?: Partial<Omit<DocsLayoutProps, "tree">>;
  pageProps?: Partial<Omit<DocsPageProps, "toc">>;
}>();
const tree = usePageTree();
const layoutProps = mergeLayoutProps(() => props.layoutProps);
</script>

<template>
  <DocsLayout :tree="tree" v-bind="layoutProps">
    <DocsPage :key="page.url" :toc="page.toc" :full="page.pageData.full" v-bind="pageProps">
      <DocsTitle>{{ page.pageData.title }}</DocsTitle>
      <DocsDescription>{{ page.pageData.description }}</DocsDescription>
      <DocsBody>
        <component :is="page.Content" />
      </DocsBody>
      <div class="flex flex-row flex-wrap items-center justify-between gap-4 empty:hidden">
        <EditOnGitHub v-if="page.pageData.githubUrl" :href="page.pageData.githubUrl" />
        <PageLastUpdate
          v-if="page.pageData.lastModified"
          :date="new Date(page.pageData.lastModified)"
        />
      </div>
    </DocsPage>
  </DocsLayout>
</template>

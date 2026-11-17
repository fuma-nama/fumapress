<script setup lang="ts">
import { computed, provide, toRef } from "vue";
import type * as PageTree from "@fumapress/vue/page-tree";
import { searchPath } from "../../core/breadcrumb";
import { usePathname } from "../../core/framework";
import { PathKey, TreeKey } from "./context";

const props = defineProps<{ tree: PageTree.Root }>();
let nextId = 0;
const pathname = usePathname();

const path = computed(() => {
  const tree = props.tree;
  return (
    searchPath(tree.children, pathname.value) ??
    (tree.fallback ? searchPath(tree.fallback.children, pathname.value) : null) ??
    []
  );
});

const root = computed(() => {
  const root = (path.value.findLast((item) => item.type === "folder" && item.root) ??
    props.tree) as (PageTree.Root | PageTree.Folder) & { $id: string };
  root.$id ??= String(nextId++);
  return root;
});

provide(TreeKey, { root, full: toRef(props, "tree") });
provide(PathKey, path);
</script>

<template>
  <slot />
</template>

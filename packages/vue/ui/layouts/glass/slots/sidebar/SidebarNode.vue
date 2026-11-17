<script setup lang="ts">
import type * as PageTree from "@fumapress/vue/page-tree";
import { RenderNode } from "../../../shared";
import SidebarFolder from "./SidebarFolder.vue";
import SidebarItem from "./SidebarItem.vue";

/** `renderNode` of the source: a node of the page tree */
defineProps<{ node: PageTree.Node }>();
</script>

<template>
  <SidebarItem v-if="node.type === 'page'" :item="node" />
  <SidebarFolder v-else-if="node.type === 'folder'" :folder="node">
    <SidebarNode v-for="(child, i) in node.children" :key="i" :node="child" />
  </SidebarFolder>
  <p
    v-else
    class="mt-4 w-full px-2.5 py-1.5 font-medium inline-flex items-center gap-2 [&_svg]:size-4 empty:hidden first:mt-0"
  >
    <RenderNode :node="node.icon" />{{ node.name }}
  </p>
</template>

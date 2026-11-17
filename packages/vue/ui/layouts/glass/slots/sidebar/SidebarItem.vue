<script setup lang="ts">
import { computed } from "vue";
import type * as PageTree from "@fumapress/vue/page-tree";
import { useTreePath } from "../../../../contexts/tree";
import { Link } from "../../../../core/link";
import { RenderNode } from "../../../shared";
import { drawerHandle, isNodeInPath, itemTriggerVariants } from "./context";

const props = defineProps<{ item: PageTree.Item }>();
const path = useTreePath();
const active = computed(() => isNodeInPath(props.item, path.value));
</script>

<template>
  <Link
    :href="item.url"
    :external="item.external"
    :aria-current="active ? 'page' : undefined"
    :class="itemTriggerVariants({ active })"
    @click="drawerHandle.close()"
  >
    <RenderNode :node="item.icon" />{{ item.name }}
  </Link>
</template>

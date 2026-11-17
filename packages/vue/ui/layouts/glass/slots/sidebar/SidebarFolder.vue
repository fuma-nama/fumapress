<script setup lang="ts">
import { computed, shallowRef } from "vue";
import { ChevronDown } from "../../../../icons";
import type * as PageTree from "@fumapress/vue/page-tree";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../../../components/ui/collapsible";
import { useTreePath } from "../../../../contexts/tree";
import { Link } from "../../../../core/link";
import { useOnChange } from "../../../../core/utils/use-on-change";
import { cn } from "../../../../utils/cn";
import { RenderNode } from "../../../shared";
import { drawerHandle, isNodeInPath } from "./context";

/** the nodes of the folder are the default slot */
const props = defineProps<{ folder: PageTree.Folder }>();
const path = useTreePath();
const shouldOpen = computed(
  () => (props.folder.defaultOpen ?? true) || isNodeInPath(props.folder, path.value),
);
const open = shallowRef(shouldOpen.value);
const indexActive = computed(() =>
  props.folder.index ? isNodeInPath(props.folder.index, path.value) : false,
);

useOnChange(shouldOpen, () => {
  if (shouldOpen.value) open.value = true;
});

const staticLinkClass = computed(() =>
  cn(
    "inline-flex px-2.5 py-1.5 font-medium items-center gap-2 [&_svg]:size-4 mt-4 first:mt-0",
    indexActive.value
      ? "text-fd-primary"
      : "hover:underline hover:decoration-fd-muted-foreground hover:underline-offset-4 hover:decoration-dashed hover:text-fd-accent-foreground",
  ),
);
const rightIconClass = computed(() =>
  cn(
    "ms-auto text-fd-muted-foreground size-3.5! transition-transform",
    !open.value && "-rotate-90",
  ),
);
const linkClass = computed(() =>
  cn(
    "inline-flex items-center gap-2 [&_svg]:size-4",
    indexActive.value
      ? "text-fd-primary"
      : "hover:underline hover:decoration-fd-muted-foreground hover:underline-offset-4 hover:decoration-dashed hover:text-fd-accent-foreground",
  ),
);
</script>

<template>
  <template v-if="folder.collapsible === false">
    <Link
      v-if="folder.index"
      :href="folder.index.url"
      :external="folder.index.external"
      :aria-current="indexActive ? 'page' : undefined"
      :class="staticLinkClass"
      @click="drawerHandle.close()"
    >
      <RenderNode :node="folder.icon" />{{ folder.name }}
    </Link>
    <div
      v-else
      class="w-full px-3 py-1.5 font-medium inline-flex items-center gap-2 [&_svg]:size-4 mt-4 first:mt-0"
    >
      <RenderNode :node="folder.icon" />{{ folder.name }}
    </div>
    <slot />
  </template>
  <Collapsible v-else v-model:open="open" class="mt-4 first:mt-0">
    <div v-if="folder.index" class="flex w-full px-2.5 py-1.5 font-medium">
      <Link
        :href="folder.index.url"
        :external="folder.index.external"
        :aria-current="indexActive ? 'page' : undefined"
        :class="linkClass"
        @click="drawerHandle.close()"
      >
        <RenderNode :node="folder.icon" />{{ folder.name }}
      </Link>
      <CollapsibleTrigger class="flex-1"
        ><ChevronDown :class="rightIconClass"
      /></CollapsibleTrigger>
    </div>
    <CollapsibleTrigger
      v-else
      class="w-full px-2.5 py-1.5 font-medium inline-flex items-center gap-2 [&_svg]:size-4"
    >
      <RenderNode :node="folder.icon" />{{ folder.name }}
      <ChevronDown :class="rightIconClass" />
    </CollapsibleTrigger>

    <CollapsibleContent class="flex flex-col">
      <slot />
    </CollapsibleContent>
  </Collapsible>
</template>

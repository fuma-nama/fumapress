<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { buttonVariants } from "../../../../components/ui/button";
import { Link } from "../../../../core/link";
import { cn } from "../../../../utils/cn";
import { RenderNode, type IconItemType } from "../../../shared";
import { drawerHandle } from "./context";

const props = defineProps<{ item: IconItemType; class?: HTMLAttributes["class"] }>();
const className = computed(() =>
  cn(
    buttonVariants({ variant: "ghost", size: "icon-sm" }),
    "text-fd-muted-foreground",
    props.class,
  ),
);
</script>

<template>
  <Link
    :href="item.url"
    :external="item.external"
    :aria-label="item.label"
    :class="className"
    @click="drawerHandle.close()"
  >
    <RenderNode :node="item.icon" />
  </Link>
</template>

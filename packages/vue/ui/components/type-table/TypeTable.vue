<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { useTranslations } from "../../core/translate";
import { cn } from "../../utils/cn";
import type { TypeNode } from "./index";
import Item from "./Item.vue";

const props = defineProps<{
  id?: string;
  type: Record<string, TypeNode>;
  class?: HTMLAttributes["class"];
}>();
const t = useTranslations({ note: "type table" });
const className = computed(() =>
  cn(
    "@container flex flex-col p-1 bg-fd-card text-fd-card-foreground rounded-2xl border my-6 text-sm overflow-hidden",
    props.class,
  ),
);
</script>

<template>
  <div :id="id" :class="className">
    <div class="flex font-medium items-center px-3 py-1 not-prose text-fd-muted-foreground">
      <p class="w-1/4">{{ t("Prop") }}</p>
      <p class="@max-xl:hidden">{{ t("Type") }}</p>
    </div>
    <Item v-for="(value, key) in type" :key="key" :parent-id="id" :name="key" :item="value" />
  </div>
</template>

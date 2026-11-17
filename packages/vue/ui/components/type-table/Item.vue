<script setup lang="ts">
import { computed, onMounted, ref, watch, type FunctionalComponent, type VNode } from "vue";
import { cva } from "class-variance-authority";
import { ChevronDown } from "lucide-vue-next";
import Link from "../../core/link";
import { useTranslations } from "../../core/translate";
import { cn } from "../../utils/cn";
import { getHash } from "../../utils/urls";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import type { TypeNode } from "./index";

const fieldVariants = cva("text-fd-muted-foreground not-prose pe-2");

const props = defineProps<{ parentId?: string; name: string; item: TypeNode }>();
const t = useTranslations({ note: "type table" });
const open = ref(false);
const id = computed(() => (props.parentId ? `${props.parentId}-${props.name}` : undefined));
const parameters = computed(() => props.item.parameters ?? []);

onMounted(() => {
  watch(
    id,
    (id) => {
      const hash = getHash();
      if (!id || !hash) return;
      if (id === hash) open.value = true;
    },
    { immediate: true },
  );
});

function onOpenChange(v: boolean) {
  if (v && id.value) {
    // the state is kept: Vue Router has the scroll position in it
    window.history.replaceState(window.history.state, "", `#${id.value}`);
  }
  open.value = v;
}

const className = computed(() =>
  cn(
    "rounded-xl border overflow-hidden scroll-m-20 transition-all",
    open.value ? "shadow-sm bg-fd-background not-last:mb-2" : "border-transparent",
  ),
);
const nameClass = computed(() =>
  cn(
    "text-fd-primary min-w-fit w-1/4 font-mono font-medium pe-2",
    props.item.deprecated && "line-through text-fd-primary/50",
  ),
);
const fieldClass = cn(fieldVariants());

/** a text or an element of the type */
const Render: FunctionalComponent<{ value?: string | VNode }> = (props) => props.value;
Render.props = ["value"];
</script>

<template>
  <Collapsible :id="id" :open="open" :class="className" @update:open="onOpenChange">
    <CollapsibleTrigger
      class="relative flex flex-row items-center w-full group text-start px-3 py-2 not-prose hover:bg-fd-accent"
    >
      <code :class="nameClass">{{ name }}{{ item.required ? "" : "?" }}</code>
      <Link
        v-if="item.typeDescriptionLink"
        :href="item.typeDescriptionLink"
        class="underline @max-xl:hidden"
      >
        <Render :value="item.type" />
      </Link>
      <span v-else class="@max-xl:hidden"><Render :value="item.type" /></span>
      <ChevronDown
        class="absolute inset-e-2 size-4 text-fd-muted-foreground transition-transform group-data-[state=open]:rotate-180"
      />
    </CollapsibleTrigger>
    <CollapsibleContent>
      <div
        class="grid grid-cols-[1fr_3fr] gap-y-4 text-sm p-3 overflow-auto fd-scroll-container border-t"
      >
        <div class="prose prose-sm col-span-full prose-no-margin empty:hidden">
          <Render :value="item.description" />
        </div>
        <template v-if="item.typeDescription">
          <p :class="fieldClass">{{ t("Type") }}</p>
          <p class="my-auto not-prose"><Render :value="item.typeDescription" /></p>
        </template>
        <template v-if="item.default">
          <p :class="fieldClass">{{ t("Default") }}</p>
          <p class="my-auto not-prose"><Render :value="item.default" /></p>
        </template>
        <template v-if="parameters.length > 0">
          <p :class="fieldClass">{{ t("Parameters") }}</p>
          <div class="flex flex-col gap-2">
            <div
              v-for="param in parameters"
              :key="param.name"
              class="inline-flex items-center flex-wrap gap-1"
            >
              <p class="font-medium not-prose text-nowrap">{{ param.name }} -</p>
              <div class="prose prose-sm prose-no-margin">
                <Render :value="param.description" />
              </div>
            </div>
          </div>
        </template>
        <template v-if="item.returns">
          <p :class="fieldClass">{{ t("Returns") }}</p>
          <div class="my-auto prose prose-sm prose-no-margin"><Render :value="item.returns" /></div>
        </template>
      </div>
    </CollapsibleContent>
  </Collapsible>
</template>

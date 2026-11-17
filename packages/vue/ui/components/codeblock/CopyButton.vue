<script setup lang="ts">
import { computed, type HTMLAttributes, type Ref } from "vue";
import { Check, Clipboard } from "lucide-vue-next";
import { useTranslations } from "../../core/translate";
import { cn } from "../../utils/cn";
import { useCopyButton } from "../../utils/use-copy-button";
import { buttonVariants } from "../ui/button";

const props = defineProps<{
  class?: HTMLAttributes["class"];
  containerRef: Readonly<Ref<HTMLElement | null>>;
}>();
const t = useTranslations({ note: "code block" });
const [checked, onClick] = useCopyButton(() => {
  const pre = props.containerRef.value?.getElementsByTagName("pre").item(0);
  if (!pre) return;

  const clone = pre.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".nd-copy-ignore").forEach((node) => {
    node.replaceWith("\n");
  });

  return navigator.clipboard.writeText(clone.textContent ?? "");
});

const className = computed(() =>
  cn(
    buttonVariants({
      class: "hover:text-fd-accent-foreground data-checked:text-fd-accent-foreground",
      size: "icon-xs",
    }),
    props.class,
  ),
);
</script>

<template>
  <button
    type="button"
    :data-checked="checked || undefined"
    :class="className"
    aria-live="polite"
    @click="onClick"
  >
    <Check v-if="checked" />
    <Clipboard v-else />
    <span class="sr-only">
      {{
        checked ? t("Copied Text", { note: "aria-label" }) : t("Copy Text", { note: "aria-label" })
      }}
    </span>
  </button>
</template>

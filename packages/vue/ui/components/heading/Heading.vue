<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { CopyCheckIcon, LinkIcon } from "../../icons";
import { useTranslations } from "../../core/translate";
import { cn } from "../../utils/cn";
import { useCopyButton } from "../../utils/use-copy-button";
import { buttonVariants } from "../ui/button";

type Types = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

const props = withDefaults(
  defineProps<{ as?: Types; id?: string; class?: HTMLAttributes["class"] }>(),
  { as: "h1" },
);
const t = useTranslations({ note: "heading anchor" });
const [isChecked, onCopy] = useCopyButton(() => {
  if (!props.id) return;

  const url = new URL(window.location.href);
  url.hash = props.id;
  return navigator.clipboard.writeText(url.href);
});

const className = computed(() =>
  cn("group/heading flex scroll-m-28 flex-row items-center gap-1", props.class),
);
// without an id the heading is rendered as it is: no `class` attribute unless one is passed
const plainAttrs = computed(() => (props.class ? { class: props.class } : undefined));
const buttonClass = cn(
  buttonVariants({
    variant: "ghost",
    size: "icon-xs",
  }),
  "not-prose shrink-0 text-fd-muted-foreground opacity-0 transition-opacity group-hover/heading:opacity-100 focus-visible:opacity-100",
);
</script>

<template>
  <component :is="as" v-if="!id" v-bind="plainAttrs"><slot /></component>
  <component :is="as" v-else :id="id" :class="className">
    <a data-card="" :href="`#${id}`"><slot /></a>
    <button aria-live="polite" :class="buttonClass" @click="onCopy">
      <CopyCheckIcon v-if="isChecked" />
      <LinkIcon v-else />
      <span class="sr-only">
        {{
          isChecked
            ? t("Copied Anchor Link", { note: "aria-label" })
            : t("Copy Anchor Link", { note: "aria-label" })
        }}
      </span>
    </button>
  </component>
</template>

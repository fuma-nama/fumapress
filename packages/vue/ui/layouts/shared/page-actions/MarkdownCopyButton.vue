<script setup lang="ts">
import { computed, shallowRef, type HTMLAttributes } from "vue";
import { Check, Copy } from "../../../icons";
import { buttonVariants } from "../../../components/ui/button";
import { useTranslations } from "../../../core/translate";
import { cn } from "../../../utils/cn";
import { useCopyButton } from "../../../utils/use-copy-button";
import { cache, withBasePath } from "./context";

/**
 * see https://fumadocs.dev/docs/integrations/llms#page-actions to customize.
 */
const props = defineProps<{
  /**
   * A URL to fetch the raw Markdown/MDX content of page
   */
  markdownUrl: string;
  class?: HTMLAttributes["class"];
}>();
const t = useTranslations({ note: "page actions" });
const isLoading = shallowRef(false);
const [checked, onClick] = useCopyButton(async () => {
  const markdownUrl = withBasePath(props.markdownUrl);
  const cached = cache.get(markdownUrl);
  if (cached) return navigator.clipboard.writeText(cached);

  isLoading.value = true;

  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/plain": fetch(markdownUrl).then(async (res) => {
          if (!res.ok) throw new Error(`Failed to fetch ${markdownUrl}: ${res.status}`);
          const content = await res.text();
          if (import.meta.env.PROD) cache.set(markdownUrl, content);
          return content;
        }),
      }),
    ]);
  } finally {
    isLoading.value = false;
  }
});

const className = computed(() =>
  cn(
    buttonVariants({
      variant: "secondary",
      size: "sm",
      className: "gap-2 [&_svg]:size-3.5 [&_svg]:text-fd-muted-foreground",
    }),
    props.class,
  ),
);
</script>

<template>
  <button :disabled="isLoading" aria-live="polite" :class="className" @click="onClick">
    <Check v-if="checked" /><Copy v-else /><slot>{{
      checked ? t("Copied Markdown") : t("Copy Markdown")
    }}</slot>
  </button>
</template>

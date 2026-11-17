<script setup lang="ts">
import { Check, LinkIcon } from "lucide-vue-next";
import { useTranslations } from "../../core/translate";
import { cn } from "../../utils/cn";
import { useCopyButton } from "../../utils/use-copy-button";
import { buttonVariants } from "../ui/button";

const props = defineProps<{ id: string }>();
const t = useTranslations({ note: "accordion" });
const [checked, onClick] = useCopyButton(() => {
  const url = new URL(window.location.href);
  url.hash = props.id;

  return navigator.clipboard.writeText(url.toString());
});

const className = cn(
  buttonVariants({
    variant: "ghost",
    class: "text-fd-muted-foreground me-2",
  }),
);
</script>

<template>
  <button type="button" aria-live="polite" :class="className" @click="onClick">
    <Check v-if="checked" class="size-3.5" />
    <LinkIcon v-else class="size-3.5" />
    <span class="sr-only">
      {{
        checked ? t("Copied Link", { note: "aria-label" }) : t("Copy Link", { note: "aria-label" })
      }}
    </span>
  </button>
</template>

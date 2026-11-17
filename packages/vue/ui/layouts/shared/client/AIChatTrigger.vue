<script setup lang="ts">
import { computed } from "vue";
import { MessageCircleIcon } from "lucide-vue-next";
import { buttonVariants } from "../../../components/ui/button";
import { useTranslations } from "../../../core/translate";
import { cn } from "../../../utils/cn";

/** a floating button toggling the chat, for layouts without one of their own */
const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ "update:open": [open: boolean] }>();
const t = useTranslations({ note: "AI chat button" });
const className = computed(() =>
  cn(
    buttonVariants({ variant: "secondary" }),
    "fixed inset-e-[calc(--spacing(4)+var(--removed-body-scroll-bar-size,0px))] bottom-4 z-20 gap-2 rounded-2xl text-fd-muted-foreground shadow-lg transition-[translate,opacity] motion-reduce:transition-none",
    props.open && "translate-y-10 opacity-0",
  ),
);
</script>

<template>
  <button
    type="button"
    :aria-expanded="open"
    :class="className"
    :inert="open"
    @click="emit('update:open', !open)"
  >
    <MessageCircleIcon aria-hidden="true" class="size-4.5" />{{ t("Ask AI") }}
  </button>
</template>

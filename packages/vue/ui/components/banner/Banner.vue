<script setup lang="ts">
import { computed, onMounted, ref, watch, type HTMLAttributes } from "vue";
import { X } from "lucide-vue-next";
import { useTranslations } from "../../core/translate";
import { cn } from "../../utils/cn";
import { buttonVariants } from "../ui/button";

type BannerVariant = "rainbow" | "normal";

const props = withDefaults(
  defineProps<{
    id?: string;
    class?: HTMLAttributes["class"];

    /**
     * @defaultValue 3rem
     */
    height?: string;

    /**
     * @defaultValue 'normal'
     */
    variant?: BannerVariant;

    /**
     * For rainbow variant only, customize the colors
     */
    rainbowColors?: string[];

    /**
     * Change Fumadocs layout styles
     *
     * @defaultValue true
     */
    changeLayout?: boolean;
  }>(),
  {
    variant: "normal",
    changeLayout: true,
    height: "3rem",
    rainbowColors: () => [
      "rgba(0,149,255,0.56)",
      "rgba(231,77,255,0.77)",
      "rgba(255,0,0,0.73)",
      "rgba(131,255,166,0.66)",
    ],
  },
);

const t = useTranslations({ note: "banner" });
const open = ref(true);
const globalKey = computed(() => (props.id ? `nd-banner-${encodeBase32(props.id)}` : null));

onMounted(() => {
  watch(
    globalKey,
    (globalKey) => {
      if (globalKey && localStorage.getItem(globalKey) === "true") open.value = false;
    },
    { immediate: true },
  );
});

function onClose() {
  open.value = false;
  if (globalKey.value) localStorage.setItem(globalKey.value, "true");
}

const className = computed(() =>
  cn(
    "sticky top-0 z-40 flex flex-row items-center justify-center px-4 text-center text-sm font-medium",
    props.variant === "normal" && "bg-fd-secondary",
    props.variant === "rainbow" && "bg-fd-background",
    !open.value && "hidden",
    props.class,
  ),
);
// `<style>` and `<script>` are not allowed in a template: they render as dynamic components, and the script takes
// `innerHTML` since `v-html` on a dynamic component renders nothing on the server
const layoutStyle = computed(() =>
  globalKey.value
    ? `:root:not(.${globalKey.value}) { --fd-banner-height: ${props.height}; }`
    : `:root { --fd-banner-height: ${props.height}; }`,
);
const hiddenStyle = computed(() => `.${globalKey.value} #${props.id} { display: none; }`);
const hiddenScript = computed(
  () =>
    `if (localStorage.getItem('${globalKey.value}') === 'true') document.documentElement.classList.add('${globalKey.value}');`,
);
const closeLabel = computed(() => t("Close Banner", { note: "aria-label" }));
const closeClass = cn(
  buttonVariants({
    variant: "ghost",
    class: "absolute inset-e-2 top-1/2 -translate-y-1/2 text-fd-muted-foreground/50",
    size: "icon-sm",
  }),
);

const maskImage =
  "linear-gradient(to bottom,white,transparent), radial-gradient(circle at top center, white, transparent)";

const flowStyle = computed(() => {
  const colors = props.rainbowColors;

  return {
    maskImage,
    maskComposite: "intersect",
    animation: "fd-moving-banner 20s linear infinite",
    backgroundImage: `repeating-linear-gradient(70deg, ${[...colors, colors[0]].map((color, i) => `${color} ${(i * 50) / colors.length}%`).join(", ")})`,
    backgroundSize: "200% 100%",
    filter: "saturate(2)",
  };
});

const flowKeyframes = `@keyframes fd-moving-banner {
            from { background-position: 0% 0;  }
            to { background-position: 100% 0;  }
         }`;

function encodeBase32(str: string) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz234567";
  let encoded = "";

  let buffer = 0;
  let bitsLeft = 0;

  for (let i = 0; i < str.length; i++) {
    buffer = (buffer << 8) | str.charCodeAt(i);
    bitsLeft += 8;

    while (bitsLeft >= 5) {
      bitsLeft -= 5;
      encoded += alphabet[(buffer >> bitsLeft) & 31];
    }
  }

  if (bitsLeft > 0) {
    encoded += alphabet[(buffer << (5 - bitsLeft)) & 31];
  }

  return encoded;
}
</script>

<template>
  <div v-if="open" :id="id" :class="className" :style="{ height }">
    <component :is="'style'" v-if="changeLayout && open">{{ layoutStyle }}</component>
    <component :is="'style'" v-if="globalKey">{{ hiddenStyle }}</component>
    <component :is="'script'" v-if="globalKey" :innerHTML="hiddenScript" />

    <template v-if="variant === 'rainbow'">
      <div class="absolute inset-0 -z-1" :style="flowStyle" />
      <component :is="'style'">{{ flowKeyframes }}</component>
    </template>
    <slot />
    <button v-if="id" type="button" :aria-label="closeLabel" :class="closeClass" @click="onClose">
      <X />
    </button>
  </div>
</template>

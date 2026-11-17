<script setup lang="ts">
import { provide, toRef } from "vue";
import { usePathname, useRouter } from "../../core/framework";
import { TranslationProvider } from "../../core/translate";
import { LocaleKey } from "./context";
import type { I18nProviderProps } from "./index";

const props = withDefaults(defineProps<I18nProviderProps>(), {
  locales: () => [],
  hideLocale: "never",
  translations: () => ({}),
});
const router = useRouter();
const pathname = usePathname();
const onChange = (value: string) => {
  if (props.onLocaleChange) {
    return props.onLocaleChange(value);
  }
  let path = pathname.value;
  if (
    props.hideLocale === "never" ||
    (props.hideLocale === "default-locale" && props.locale !== props.defaultLanguage)
  ) {
    const end = path.indexOf("/", 1);
    path = end === -1 ? "/" : path.slice(end);
  }

  // With `always`, middleware uses the prefix to update the locale cookie before redirecting.
  if (props.hideLocale !== "default-locale" || value !== props.defaultLanguage) {
    path = `/${value}${path === "/" ? "" : path}`;
  }

  void router.push(path);
};

provide(LocaleKey, {
  locale: toRef(props, "locale"),
  locales: toRef(props, "locales"),
  onChange,
});
</script>

<template>
  <TranslationProvider :translations="translations">
    <slot />
  </TranslationProvider>
</template>

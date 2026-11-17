import {
  computed,
  defineComponent,
  h,
  toValue,
  type Component,
  type ComputedRef,
  type MaybeRefOrGetter,
} from "vue";
import { useI18n } from "../../../contexts/i18n";
import { Link } from "../../../core/link";
import type { BaseLayoutProps } from "../index";
import RenderNode from "../RenderNode.vue";
import { LanguageSelect, LanguageSelectText } from "../slots/language-select";
import { FullSearchTrigger, SearchTrigger } from "../slots/search-trigger";
import { ThemeSwitch } from "../slots/theme-switch";

export { default as LinkItem } from "./LinkItem.vue";
export { default as AIChatPanel } from "./AIChatPanel.vue";
export { default as AIChatTrigger } from "./AIChatTrigger.vue";
export { default as SkipToContent } from "./SkipToContent.vue";

export interface BaseSlots {
  /** receives the attributes of a link */
  navTitle: Component;
  /** receives `ThemeSwitchProps` */
  themeSwitch: Component | false;
  searchTrigger:
    | {
        /** receives `SearchTriggerProps` */
        sm: Component;
        /** receives `FullSearchTriggerProps` */
        full: Component;
      }
    | false;
  languageSelect:
    | {
        /** receives `LanguageSelectProps` */
        root: Component;
        /** receives `LanguageSelectTextProps` */
        text: Component;
      }
    | false;
}

export interface BaseSlotsProps<P extends BaseLayoutProps = BaseLayoutProps> extends Pick<
  P,
  "nav"
> {
  themeSwitch: Omit<NonNullable<P["themeSwitch"]>, "enabled">;
  searchToggle: Omit<NonNullable<P["searchToggle"]>, "enabled">;
}

export function baseSlots({ useProps }: { useProps: () => MaybeRefOrGetter<BaseSlotsProps> }) {
  const InlineThemeSwitch = defineComponent({
    name: "InlineThemeSwitch",
    inheritAttrs: false,
    setup(_, { attrs }) {
      const props = useProps();

      return () => {
        const { component, ...themeSwitch } = toValue(props).themeSwitch;
        if (component) return h(RenderNode, { node: component });
        return h(ThemeSwitch, { ...attrs, ...themeSwitch });
      };
    },
  });

  const InlineSearchTrigger = defineComponent({
    name: "InlineSearchTrigger",
    inheritAttrs: false,
    setup(_, { attrs }) {
      const props = useProps();

      return () => {
        const { searchToggle } = toValue(props);
        if (searchToggle.components?.sm) return h(RenderNode, { node: searchToggle.components.sm });
        return h(SearchTrigger, { ...attrs, ...searchToggle.sm });
      };
    },
  });

  const InlineSearchTriggerFull = defineComponent({
    name: "InlineSearchTriggerFull",
    inheritAttrs: false,
    setup(_, { attrs }) {
      const props = useProps();

      return () => {
        const { searchToggle } = toValue(props);
        if (searchToggle.components?.lg) return h(RenderNode, { node: searchToggle.components.lg });
        return h(FullSearchTrigger, { ...attrs, ...searchToggle.full });
      };
    },
  });

  const InlineNavTitle = defineComponent({
    name: "InlineNavTitle",
    inheritAttrs: false,
    props: { href: { type: String, default: "/" } },
    setup(props, { attrs }) {
      const layout = useProps();

      return () => {
        const { url = props.href, title } = toValue(layout).nav ?? {};

        if (typeof title === "function") return h(title, { href: url, ...attrs });
        return h(Link, { href: url, ...attrs }, () => h(RenderNode, { node: title }));
      };
    },
  });

  return {
    useBaseSlots(options: MaybeRefOrGetter<BaseLayoutProps>): {
      baseSlots: ComputedRef<BaseSlots>;
      baseProps: ComputedRef<BaseSlotsProps>;
    } {
      const { locales } = useI18n();

      return {
        baseSlots: computed(() => {
          const {
            slots = {},
            i18n = (locales.value ?? []).length > 1,
            searchToggle: { enabled: searchToggleEnabled = true } = {},
            themeSwitch: { enabled: themeSwitchEnabled = true } = {},
          } = toValue(options);

          return {
            navTitle: slots.navTitle ?? InlineNavTitle,
            themeSwitch: themeSwitchEnabled && (slots.themeSwitch ?? InlineThemeSwitch),
            languageSelect: i18n
              ? (slots.languageSelect ?? {
                  root: LanguageSelect,
                  text: LanguageSelectText,
                })
              : false,
            searchTrigger:
              searchToggleEnabled &&
              (slots.searchTrigger ?? {
                sm: InlineSearchTrigger,
                full: InlineSearchTriggerFull,
              }),
          };
        }),
        baseProps: computed(() => {
          const {
            nav,
            searchToggle: { enabled: _searchToggleEnabled, ...searchToggle } = {},
            themeSwitch: { enabled: _themeSwitchEnabled, ...themeSwitch } = {},
          } = toValue(options);

          return {
            nav,
            searchToggle,
            themeSwitch,
          };
        }),
      };
    },
  };
}

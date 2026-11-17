import {
  computed,
  h,
  toValue,
  type AnchorHTMLAttributes,
  type Component,
  type ComputedRef,
  type MaybeRefOrGetter,
} from "vue";
import * as PageTree from "@fumapress/vue/page-tree";
import type { I18nConfig } from "../../core/i18n";
import { isActive, normalize } from "../../utils/urls";
import type { BaseSlots } from "./client";
import type { ThemeSwitchProps } from "./slots/theme-switch";
import type { FullSearchTriggerProps, SearchTriggerProps } from "./slots/search-trigger";

// A node of layout data is a text or a component (`string | Component`), rendered by `RenderNode`.
import RenderNode from "./RenderNode.vue";
export { RenderNode };

export interface NavOptions {
  enabled?: boolean;
  children?: string | Component;
  /**
   * A functional component replaces the link of the title: it receives `href` and the attributes of the link.
   */
  title?: string | Component;

  /**
   * Redirect url of title
   * @defaultValue '/'
   */
  url?: string;

  /**
   * Use transparent background
   *
   * @defaultValue none
   */
  transparentMode?: "always" | "top" | "none";

  /**
   * @deprecated use `slots.header` instead.
   */
  component?: string | Component;
}

export interface BaseLayoutProps {
  /**
   * GitHub url
   */
  githubUrl?: string;
  links?: LinkItemType[];
  /**
   * navigation config
   */
  nav?: NavOptions;
  slots?: Partial<BaseSlots>;
  themeSwitch?: ThemeSwitchOptions;
  searchToggle?: SearchToggleOptions;

  /**
   * @deprecated this is now optional for i18n setups, you can still customize language switch from `slots`.
   */
  i18n?: boolean | I18nConfig;
}

interface SearchToggleOptions {
  enabled?: boolean;
  sm?: SearchTriggerProps;
  full?: FullSearchTriggerProps;
  /** @deprecated use `slots.searchTrigger` instead */
  components?: {
    sm?: string | Component;
    lg?: string | Component;
  };
}

interface ThemeSwitchOptions extends ThemeSwitchProps {
  enabled?: boolean;
  /** @deprecated use `slots.themeSwitch` instead */
  component?: string | Component;
}

export interface AIChatOptions {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * The chat panel, placed beside the page on wide viewports, and floating over it on smaller ones.
   */
  panel?: string | Component;
  /**
   * Render a floating Ask AI button, for layouts without one of their own (Docs and Notebook)
   *
   * @defaultValue false
   */
  trigger?: boolean;
}

export interface LayoutTab {
  /**
   * Redirect URL of the folder, usually the index page
   */
  url: string;
  icon?: string | Component;
  title: string | Component;
  description?: string | Component;
  unlisted?: boolean;
  props?: AnchorHTMLAttributes;

  /**
   * bind to a page tree node.
   */
  $folder?: PageTree.Folder;

  /**
   * Detect from a list of urls (when not bound to page tree).
   */
  urls?: Set<string>;
}

export interface GetLayoutTabsOptions {
  transform?: (option: LayoutTab, node: PageTree.Folder) => LayoutTab | null;
}

const defaultTransform: GetLayoutTabsOptions["transform"] = (option, node) => {
  if (!node.icon) return option;

  return {
    ...option,
    icon: () =>
      h(
        "div",
        {
          class:
            "size-full [&_svg]:size-full max-md:p-1.5 max-md:rounded-md max-md:border max-md:bg-fd-secondary",
        },
        [h(RenderNode, { node: node.icon })],
      ),
  };
};

export function getLayoutTabs(
  tree: PageTree.Root,
  { transform = defaultTransform }: GetLayoutTabsOptions = {},
): LayoutTab[] {
  const results: LayoutTab[] = [];

  function next(node: PageTree.Root | PageTree.Folder, unlisted?: boolean) {
    if ("root" in node && node.root) {
      const page =
        node.index ??
        node.children.find((node) => node.type === "page") ??
        // a folder of folders, like `(framework)/[framework]`
        PageTree.findPath(node.children, (node) => node.type === "page")?.at(-1);
      const url = page?.type === "page" ? page.url : undefined;

      if (url) {
        const option: LayoutTab = {
          title: node.name,
          icon: node.icon,
          description: node.description,
          url,
          unlisted,
          $folder: node,
        };

        const mapped = transform ? transform(option, node) : option;
        if (mapped) results.push(mapped);
      }
    }

    for (const child of node.children) {
      if (child.type === "folder") next(child, unlisted);
    }
  }

  next(tree);
  if (tree.fallback) next(tree.fallback, true);

  return results;
}

export function isLayoutTabActive(tab: LayoutTab, path: PageTree.Node[], pathname: string) {
  if (tab.$folder) {
    const folder = tab.$folder;
    return path.some(
      (node) => node.type === "folder" && (node.$id === folder.$id || node === folder),
    );
  }

  if (tab.urls) {
    return tab.urls.has(normalize(pathname));
  }

  return isActive(tab.url, pathname, true);
}

interface Filterable {
  /**
   * Restrict where the item is displayed
   *
   * @defaultValue 'all'
   */
  on?: "menu" | "nav" | "all";
}

interface WithHref {
  url: string;
  /**
   * When the item is marked as active
   *
   * @defaultValue 'url'
   */
  active?: "url" | "nested-url" | "none";
  external?: boolean;
}

export interface MainItemType extends WithHref, Filterable {
  type?: "main";
  icon?: string | Component;
  text: string | Component;
  description?: string | Component;
}

export interface IconItemType extends WithHref, Filterable {
  type: "icon";
  /**
   * `aria-label` of icon button
   */
  label?: string;
  icon: string | Component;
  text: string | Component;
  /**
   * @defaultValue true
   */
  secondary?: boolean;
}

export interface ButtonItemType extends WithHref, Filterable {
  type: "button";
  icon?: string | Component;
  text: string | Component;
  /**
   * @defaultValue false
   */
  secondary?: boolean;
}

export interface MenuItemType extends Partial<WithHref>, Filterable {
  type: "menu";
  icon?: string | Component;
  text: string | Component;

  items: (
    | (MainItemType & {
        /**
         * Options when displayed on navigation menu
         */
        menu?: AnchorHTMLAttributes & {
          banner?: string | Component;
        };
      })
    | CustomItemType
  )[];

  /**
   * @defaultValue false
   */
  secondary?: boolean;
}

export interface CustomItemType extends Filterable {
  type: "custom";
  /**
   * @defaultValue false
   */
  secondary?: boolean;
  children: string | Component;
}

export type LinkItemType =
  | MainItemType
  | IconItemType
  | ButtonItemType
  | MenuItemType
  | CustomItemType;

const GithubIcon: Component = () =>
  h("svg", { "aria-hidden": "true", viewBox: "0 0 24 24", fill: "currentColor" }, [
    h("path", {
      d: "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12",
    }),
  ]);

/**
 * Get link items with shortcuts
 */
export function resolveLinkItems({
  links = [],
  githubUrl,
}: Pick<BaseLayoutProps, "links" | "githubUrl">): LinkItemType[] {
  const result = [...links];

  if (githubUrl)
    result.push({
      type: "icon",
      url: githubUrl,
      text: "Github",
      label: "GitHub",
      icon: GithubIcon,
      external: true,
    });

  return result;
}

export interface GroupedLinkItems {
  all: LinkItemType[];
  navItems: LinkItemType[];
  menuItems: LinkItemType[];
}

export function useLinkItems(
  options: MaybeRefOrGetter<Pick<BaseLayoutProps, "links" | "githubUrl">>,
): ComputedRef<GroupedLinkItems> {
  return computed(() => {
    const { links, githubUrl } = toValue(options);
    const all = resolveLinkItems({ links, githubUrl });
    const navItems: LinkItemType[] = [];
    const menuItems: LinkItemType[] = [];

    for (const item of all) {
      switch (item.on) {
        case "menu":
          menuItems.push(item);
          break;
        case "nav":
          navItems.push(item);
          break;
        default:
          navItems.push(item);
          menuItems.push(item);
      }
    }

    return { navItems, menuItems, all };
  });
}

export function isLinkItemActive(link: LinkItemType, pathname: string) {
  if (link.type === "custom" || !link.url) return false;
  if (link.active === "none") return false;

  return isActive(link.url, pathname, link.active === "nested-url");
}

export { type BaseSlots, type BaseSlotsProps, baseSlots, LinkItem } from "./client";

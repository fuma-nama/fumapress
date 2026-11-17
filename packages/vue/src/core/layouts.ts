/**
 * The options of the layouts of the UI that the server can send to the browser: the props of `ui/layouts/*` without
 * components, functions and HTML attributes, which the theme gives.
 */

interface WithHref {
  url: string;
  /** @defaultValue "url" */
  active?: "url" | "nested-url" | "none";
  external?: boolean;
}

interface Filterable {
  /** where the link shows @defaultValue "all" */
  on?: "menu" | "nav" | "all";
}

/** a link of the navbar; `icon` is a text, like an emoji */
export type LinkItem =
  | (WithHref & Filterable & { type?: "main"; text: string; icon?: string; description?: string })
  | (WithHref & Filterable & { type: "button"; text: string; icon?: string; secondary?: boolean })
  | (Partial<WithHref> &
      Filterable & {
        type: "menu";
        text: string;
        icon?: string;
        secondary?: boolean;
        items: (WithHref &
          Filterable & { type?: "main"; text: string; icon?: string; description?: string })[];
      });

export interface NavOptions {
  enabled?: boolean;
  title?: string;
  /** where the title links to @defaultValue the home page of the language */
  url?: string;
  /** @defaultValue "none" */
  transparentMode?: "always" | "top" | "none";
}

/** a tab of the sidebar, in place of the root folders of the page tree */
export interface LayoutTab {
  url: string;
  title: string;
  icon?: string;
  description?: string;
  unlisted?: boolean;
}

/**
 * The props every layout takes. Plugins add to them with their `layoutProps` hook, and the app reads them with
 * `useLayoutProps()`.
 */
export interface LayoutProps {
  nav?: NavOptions;
  links?: LinkItem[];
  githubUrl?: string;
  themeSwitch?: { enabled?: boolean; mode?: "light-dark" | "light-dark-system" };
  searchToggle?: {
    enabled?: boolean;
    sm?: { hideIfDisabled?: boolean };
    full?: { hideIfDisabled?: boolean };
  };
  /** the tabs of the sidebar, `false` for none @defaultValue the root folders of the page tree */
  tabs?: LayoutTab[] | false;
  /** set by a search plugin: `options` are the props of the search dialog of the theme */
  search?: { enabled?: boolean; options?: Record<string, unknown> };
}

interface SidebarOptions {
  /** open the folders up to this level @defaultValue 0 */
  defaultOpenLevel?: number;
  prefetch?: boolean;
}

type TOCStyle = "normal" | "clerk" | "block";

interface BreadcrumbOptions {
  enabled?: boolean;
  includeRoot?: boolean | { url: string };
  includePage?: boolean;
  includeSeparator?: boolean;
}

/** the props of the page of the docs and notebook layouts */
interface DocsPageOptions {
  /** fill the width of the layout @defaultValue false */
  full?: boolean;
  footer?: { enabled?: boolean };
  breadcrumb?: BreadcrumbOptions;
  tableOfContent?: { enabled?: boolean; single?: boolean; style?: TOCStyle };
  tableOfContentPopover?: { enabled?: boolean; style?: TOCStyle };
}

/** the layouts of the UI, with the props of each layout and of its page */
export interface DefaultLayouts {
  docs: {
    layout: LayoutProps & {
      sidebar?: SidebarOptions & { enabled?: boolean; collapsible?: boolean };
      tabMode?: "top" | "auto";
    };
    page: DocsPageOptions;
  };
  notebook: {
    layout: LayoutProps & {
      nav?: NavOptions & { mode?: "top" | "auto" };
      sidebar?: SidebarOptions & { collapsible?: boolean };
      tabMode?: "sidebar" | "navbar";
    };
    page: DocsPageOptions;
  };
  glass: {
    layout: LayoutProps & { sidebar?: { collapsible?: boolean } };
    page: Pick<DocsPageOptions, "full">;
  };
  spacious: {
    layout: LayoutProps & { sidebar?: SidebarOptions };
    page: DocsPageOptions;
  };
  flux: {
    layout: LayoutProps & { sidebar?: SidebarOptions & { enabled?: boolean } };
    page: Omit<DocsPageOptions, "tableOfContentPopover">;
  };
}

export type LayoutName = keyof DefaultLayouts;

/** the layout of the content pages, with its props and the props of its page: what the browser receives */
export type LayoutData = {
  [K in LayoutName]: {
    layout: K;
    layoutProps: DefaultLayouts[K]["layout"];
    pageProps: DefaultLayouts[K]["page"];
  };
}[LayoutName];

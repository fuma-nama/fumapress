/**
 * The props every layout of the UI shares, as the config sets them and the server sends them to the browser: without
 * components, functions and HTML attributes, which the layout components of the theme take.
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

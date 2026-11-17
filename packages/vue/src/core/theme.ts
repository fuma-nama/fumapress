import type { App, Component, VNodeChild } from "vue";
import type { Router } from "../router";
import type { PageOf, Press, PressPageType, PressViewName, ViewSourceOf } from "./press";
import type { HeadTag } from "./types";

/**
 * A component that can receive the props `P`, checked where its props are a parameter: the `setup` of a `.vue` file
 * or of the options of `defineComponent()`, or a functional component.
 */
type Accepts<P> =
  | { setup?: (props: P, ctx: never) => unknown }
  | ((props: P, ctx: never) => VNodeChild);

/**
 * The component of the pages of a type, which receives the page as its one prop, `page`. Or a function that imports
 * it, like `() => import("./BlogPost.vue")`, so only the pages that render it load its code.
 */
export type ViewComponent<Page> =
  | Accepts<{ page: Page }>
  | (() => Promise<Accepts<{ page: Page }> | { default: Accepts<{ page: Page }> }>);

/**
 * The UI of a site: the components of its pages and of Markdown, the icons of its page tree, and what goes around
 * every page. A theme module default-exports it, and it runs on the server and in the browser.
 */
export interface Theme {
  /**
   * The themes this one builds on, like the default theme: `views`, `components` and `icons` merge with the entries
   * of this theme winning, `head` lists are joined, every `enhanceApp` runs, and `Root` and `NotFound` are replaced.
   * In a list, a later theme wins over an earlier one.
   */
  extends?: Theme | readonly Theme[];
  /** around every page of the app, custom pages too: its default slot is the page. For providers. */
  Root?: Component;
  /** the page of a URL without a page */
  NotFound?: Component;
  /**
   * The component of each page type: a source key for its content pages, the name of a view for its pages, and
   * `default` for the content pages of a source without one.
   */
  views?: Record<string, ViewComponent<never>>;
  /** the components of Markdown by name, available without an import */
  components?: Record<string, Component>;
  /** the icons of the page tree by name: an `icon` of a page or a folder without one here stays text, like an emoji */
  icons?: Record<string, Component>;
  /** tags of every page, like a script that runs before the first paint */
  head?: HeadTag[];
  /** register Vue plugins and the hooks of the router, before the app loads its first page */
  enhanceApp?: (ctx: { app: App; router: Router }) => void;
}

/** the content types of a site that `views.default` renders: those not rendered as views */
type DefaultType<A extends Press<any, any>> = Exclude<
  PressPageType<A>,
  PressViewName<A> | ViewSourceOf<A>
>;

/** the components of the page types of a site, each receiving the pages of its type */
export type ThemeViews<A extends Press<any, any>> = {
  [K in Exclude<PressPageType<A>, undefined>]?: ViewComponent<PageOf<A, K>>;
} & { default?: ViewComponent<PageOf<A, DefaultType<A>>> };

/**
 * The keys of `views` that can render each page type of a site: its own key for a view or a source a plugin renders
 * as views, its own key or `default` for content pages.
 */
type ViewKeys<A extends Press<any, any>> = {
  [K in PressViewName<A> | (ViewSourceOf<A> & string)]: K;
} & { [K in DefaultType<A> & string]: K | "default" } & (undefined extends DefaultType<A>
    ? { default: "default" }
    : {});

/** a component for one of the keys `K`, in `views` or in the `views` of the theme `extends` names */
type Covers<K extends string> = K extends string
  ? { views: Record<K, unknown> } | { extends: { views: Record<K, unknown> } }
  : never;

/**
 * A component for every page type. Each type gives a union of the themes that cover it, and the requirement is their
 * intersection: the parameters of a union of functions infer it.
 */
type ViewRequirement<N extends Record<string, string>> = [keyof N] extends [never]
  ? {}
  : { [K in keyof N]: (given: Covers<N[K]>) => void }[keyof N] extends (given: infer I) => void
    ? I
    : never;

/** the options of `defineTheme<typeof app>()`: a theme whose `views` are checked against the pages of the site `A` */
export type ThemeOptions<A extends Press<any, any>> = [A] extends [never]
  ? Theme
  : Omit<Theme, "views"> & { views?: ThemeViews<A> } & ViewRequirement<ViewKeys<A>>;

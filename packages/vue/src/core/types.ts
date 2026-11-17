import type {
  MetaData,
  PageData as SourcePageData,
  SourceUnion,
  VirtualFile,
} from "fumadocs-core/source";
import type { Component } from "vue";
import type { LayoutProps } from "./layouts";

export type Awaitable<T> = T | Promise<T>;

/** a tag of `<head>`, `attrs` take HTML attribute names */
export interface HeadTag {
  tag: string;
  attrs?: Record<string, string | boolean | undefined>;
  content?: string;
}

export interface SiteConfig {
  /** shown in the navbar and page titles */
  name?: string;
  description?: string;
  /** the language of a site without `i18n`, for `<html lang>` @defaultValue "en" */
  lang?: string;
  /**
   * The origin of the deployed site, like `https://docs.example.com`, for canonical links and the sitemap. A path the
   * site is served under is the `base` of Vite, not part of it.
   */
  baseUrl?: string;
  /** adds a repository link to the navbar */
  git?: {
    user: string;
    repo: string;
    /** @defaultValue "main" */
    branch?: string;
    /** the folder of the site in the repository, for the links to its files */
    dir?: string;
  };
}

export interface TOCItem {
  title: string;
  url: string;
  depth: number;
}

export interface StructuredData {
  headings: { id: string; content: string }[];
  contents: { heading?: string; content: string }[];
}

/** the exports of a compiled Markdown file */
export interface PageModule {
  default: unknown;
  toc?: TOCItem[];
  structuredData?: StructuredData;
  /** the content as Markdown, as it was written */
  markdown?: string;
}

/** the data of the files of a source: of its pages and of its `meta.json` files */
export interface SourceConfig {
  pageData: SourcePageData;
  metaData: MetaData;
}

/**
 * A content source of Fumadocs: a list of files, rendered by the plugin that owns them through content hooks like
 * `getPageBody`. With a function, the source is dynamic: its pages are read on the server and render on demand. The
 * types of `page.data` follow `Config`.
 */
export type Source<Config extends SourceConfig = SourceConfig> = SourceUnion<Config>;

/** a file of a content source: `path` in the source, like `guide/install.mdx`, sets the URL of a page */
export type SourceFile<Config extends SourceConfig = SourceConfig> = VirtualFile<Config>;

/**
 * A content page of the site: `type` is the key of its source with sources by key, `url` is a path of the site, and
 * `data` is the data of its file, frontmatter in a collection.
 */
export type { Meta, Page } from "fumadocs-core/source";

/**
 * A value as JSON gives it back: a `Date` is a string, functions and `undefined` are left out, and in a list they are
 * `null`. What the server sends to the browser has this type.
 */
export type Jsonify<T> = unknown extends T ? T : [T] extends [Json] ? T : JsonValue<T>;
/** a value JSON gives back as it is: a recursive type of JSON, like the `_openapi` of a page, stays one */
type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
type JsonValue<T> = T extends { toJSON(): infer J }
  ? Jsonify<J>
  : T extends string | number | boolean | null
    ? T
    : T extends readonly (infer E)[]
      ? (E extends undefined | ((...args: never[]) => unknown) ? null : Jsonify<E>)[]
      : T extends object
        ? T extends (...args: never[]) => unknown
          ? never
          : { [K in keyof T as [Jsonify<T[K]>] extends [never] ? never : K]: Jsonify<T[K]> }
        : never;

/**
 * The data of a rendered page, sent to the browser: from the `title`, `description` and `full` of `page.data` or the
 * `data` of a view, then the `transformPage` hook of plugins. Its values are serializable.
 */
export interface PageData {
  title?: string;
  description?: string;
  /** use the full width of the page */
  full?: boolean;
  /** the URL of its source file, with `site.git` */
  githubUrl?: string;
  /** when its content last changed, as an ISO date: from the `getPageLastModified` hook of the plugin that knows */
  lastModified?: string;
  [key: string]: unknown;
}

/**
 * A page rendered by the theme with the component of `views` named `type`, which receives `props`: one of the views
 * `V`, the props by type. `props` are sent to the browser, so every value is serializable.
 */
export type View<V = any> = V extends unknown
  ? { [K in keyof V & string]: { type: K; props: V[K] } }[keyof V & string]
  : never;

/**
 * The content of a page, from the `getPageBody` hook of the plugin rendering its source:
 *
 * - `module`: the URL of a module whose default export is the content, which the browser imports. `load` is the
 *   same module on the server; a function, so it never reaches the browser.
 * - `html`: HTML rendered as it is, for content that comes from elsewhere.
 * - `view`: a component of the theme renders the page, in place of the docs layout: one of the views `V`.
 */
export type PageBody<V = any> =
  | { module: string; load?: () => Promise<PageModule> }
  | { html: string }
  | { view: View<V> };

/**
 * A page as the browser receives it: with the first response, then one request per navigation. A content page has
 * the `data` of its file and its `body`, a view has the `props` its `view` returned. Values are JSON.
 */
export type PageContent = {
  url: string;
  /** `getPageData()` of a content page, the `data` of a view: its title, description and what plugins add */
  pageData: PageData;
  /** the title and description of its `<head>`, which the browser applies when it navigates to the page */
  head: { title?: string; description?: string };
} & (
  | {
      /** its source key, none with one source */
      type?: string;
      /** the data of its file: the validated frontmatter of a collection */
      data: Record<string, unknown>;
      toc: TOCItem[];
      body: PageBody;
    }
  | {
      /** the name of the view */
      type: string;
      props: Record<string, unknown>;
    }
);

/** the page tree of Fumadocs with text names, so the browser can receive it */
export namespace PageTree {
  /** a name from the content; in the browser, the component of `icons` of the theme with that name */
  export type Icon = string | Component;
  export interface Root {
    $id?: string;
    name: string;
    children: Node[];
    fallback?: Root;
  }
  export type Node = Item | Separator | Folder;
  export interface Item {
    $id?: string;
    type: "page";
    name: string;
    url: string;
    external?: boolean;
    description?: string;
    icon?: Icon;
  }
  export interface Separator {
    $id?: string;
    type: "separator";
    name?: string;
    icon?: Icon;
  }
  export interface Folder {
    $id?: string;
    type: "folder";
    name: string;
    description?: string;
    /** a root folder is a tab of the sidebar, a string names its kind */
    root?: boolean | string;
    defaultOpen?: boolean;
    collapsible?: boolean;
    index?: Item;
    icon?: Icon;
    children: Node[];
  }
}

/**
 * The texts of the UI and the languages of a site as the browser needs them: the props of the i18n provider of
 * Fumadocs UI. A site without languages has the texts only.
 */
export type SiteI18n = {
  /** the texts of the UI in the language of the page */
  translations?: Partial<Record<string, string>>;
} & (
  | {
      locale: string;
      defaultLanguage: string;
      hideLocale: "default-locale" | "never";
      /** the language switch lists them */
      locales: { locale: string; name: string }[];
    }
  | { locale?: undefined; defaultLanguage?: undefined; hideLocale?: undefined; locales?: undefined }
);

/** the data every page of a language needs, the same on each: the value of a shared data route */
export interface SiteData {
  /** the props every layout shares: `ui.layoutProps` over those of plugins */
  layoutProps: LayoutProps;
  site: Pick<SiteConfig, "name" | "description">;
  tree: PageTree.Root;
  /** on a site with languages or `ui.translations` */
  i18n?: SiteI18n;
  /** the direction of the text of the language, which `<html dir>` has too */
  dir: "ltr" | "rtl";
}

/** the value of a data route by its path, none without a route or a value; on the server, without a request */
export type Load = <T = unknown>(path: string) => Promise<T | undefined>;

/** the files of a part of the app in the browser build, as an `?assets` import of Nitro gives them */
export interface ClientAssets {
  /** the script that starts the app */
  entry?: string;
  /** the attributes of a stylesheet link: its `href`, and what the dev server adds to follow its changes */
  css: { href: string; [attribute: string]: string | undefined }[];
  js: { href: string }[];
}

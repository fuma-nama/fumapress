import type { Component } from "vue";

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

export interface NavLink {
  text: string;
  url: string;
  external?: boolean;
}

/**
 * What plugins and the site give the UI of every page. It is sent to the browser, so every value is serializable:
 * components come from the theme.
 */
export interface LayoutProps {
  nav?: { title?: string; url?: string };
  links?: NavLink[];
  githubUrl?: string;
  /** set by a search plugin: `options` are the props of the search dialog of the theme */
  search?: { enabled?: boolean; options?: Record<string, unknown> };
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

/** a file of a content source */
export interface SourceFile {
  type: "page" | "meta";
  /** path in the source, like `guide/install.mdx`: it sets the URL of a page */
  path: string;
  /** `page.data` of a page, or the content of a `meta.json` */
  data: Record<string, unknown>;
}

/**
 * The input of the content loader: a list of files, rendered by the plugin that owns them through content hooks like
 * `getPageBody`. With a function, the source is dynamic: its pages are read on the server and render on demand.
 */
export interface Source {
  files: SourceFile[] | (() => Awaitable<SourceFile[]>);
}

/** a content page of the site */
export interface Page {
  /** the key of its source, undefined with a single source */
  source?: string;
  /** file path in the content, like `guide/install.mdx` */
  path: string;
  slugs: string[];
  url: string;
  /** its language, on a site with languages */
  locale?: string;
  /** the `data` of its file: frontmatter in a collection, anything in a custom source */
  data: Record<string, unknown>;
}

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

/** a page of a plugin: the theme renders it with the component of `views` named `type`, which receives `props` */
export interface View {
  type: string;
  /** sent to the browser, so every value is serializable */
  props?: Record<string, unknown>;
}

/**
 * The content of a page, from the `getPageBody` hook of the plugin rendering its source:
 *
 * - `module`: the URL of a module whose default export is the content, which the browser imports. `load` is the
 *   same module on the server; a function, so it never reaches the browser.
 * - `html`: HTML rendered as it is, for content that comes from elsewhere.
 * - `view`: a component of the theme renders the page, in place of the docs layout.
 */
export type PageBody =
  | { module: string; load?: () => Promise<PageModule> }
  | { html: string }
  | { view: View };

/** a page as the browser receives it: with the first response, then one request per navigation */
export interface PageContent {
  url: string;
  data: PageData;
  toc: TOCItem[];
  body: PageBody;
  /** the title and description of its `<head>`, which the browser applies when it navigates to the page */
  head: { title?: string; description?: string };
}

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

/** the languages of a site as the browser needs them: the props of the i18n provider of Fumadocs UI */
export interface SiteI18n {
  locale: string;
  defaultLanguage: string;
  hideLocale: "default-locale" | "never";
  /** the language switch lists them */
  locales: { locale: string; name: string }[];
  /** the texts of the UI in `locale` */
  translations?: Record<string, string>;
}

/** the data every page of a language needs, the same on each: the value of a shared data route */
export interface SiteData {
  site: Pick<SiteConfig, "name" | "description">;
  layout: LayoutProps;
  tree: PageTree.Root;
  /** on a site with languages */
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

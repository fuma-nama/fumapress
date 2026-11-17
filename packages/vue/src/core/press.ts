import type { Context } from "./context";
import type { I18nConfig } from "./i18n";
import type { HeadEnv, PluginOption, PresetEntry } from "./plugin";
import type { Awaitable, HeadTag, LayoutProps, SiteConfig, Source } from "./types";

/** one source, or sources by key: each key is the `source` of its pages */
export type ContentInput = Source | Record<string, Source>;

export interface ContentOptions {
  /** the languages of the site: its pages, page trees and URLs are per language */
  i18n?: I18nConfig;
  /** the `plugins` of the Fumadocs content loader */
  loaderPlugins?: unknown[];
  /** other options of the Fumadocs content loader, like `slugs`, `url` and `pageTree` */
  [key: string]: unknown;
}

export interface PressConfig {
  /** the default plugins, loaded after your plugins; `[]` for none @defaultValue recommendedPreset() */
  preset?: readonly PresetEntry[];
  site?: SiteConfig;
  /** tags of every page, and of a page with `page`; yours win over the plugins' by key */
  head?: HeadTag[] | ((this: Context, env: HeadEnv) => Awaitable<HeadTag[] | undefined>);
  ui?: {
    /** the navbar and links of every layout; values are sent to the browser, so they are serializable */
    layoutProps?:
      | LayoutProps
      | ((this: Context, env: { lang: string }) => Awaitable<LayoutProps | undefined>);
    /**
     * The texts of the UI by language, with `i18n`: the text in English is the key, and `displayName` names the
     * language in the language switch.
     */
    translations?: Record<string, Record<string, string> & { displayName?: string }>;
  };
}

export interface PressInput {
  readonly content: ContentInput;
  readonly options: ContentOptions;
  readonly plugins: readonly PluginOption[];
  readonly config: PressConfig;
}

/** what `press.config` exports */
export interface Press {
  readonly "~press": PressInput;
}

export interface PressApp extends Press {
  config: (config: PressConfig) => Press;
}

export interface PressContent extends PressApp {
  plugins: (...plugins: PluginOption[]) => PressApp;
}

/** the site of `press.config`: `createPress(content).plugins(...).config({...})` */
export function createPress(content: ContentInput, options: ContentOptions = {}): PressContent {
  const stage = (plugins: readonly PluginOption[], config: PressConfig = {}): Press => ({
    "~press": { content, options, plugins, config },
  });
  const app = (plugins: readonly PluginOption[]): PressApp => ({
    ...stage(plugins),
    config: (config) => stage(plugins, config),
  });

  return { ...app([]), plugins: (...plugins) => app(plugins) };
}

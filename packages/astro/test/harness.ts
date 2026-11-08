import type { _Internal } from "fumadocs-core/source";
import {
  createPress,
  type AppShape,
  type ContentOptions,
  type Plugin,
  type PluginOption,
  type PressConfig,
} from "@fumapress/core";
import { createPressContext, type PressRuntime } from "@fumapress/core/runtime";

/** a site in one object: the content, its options, the plugins and the options of `.config()` */
export interface TestSite
  extends ContentOptions<_Internal.AnyInput, string | undefined>, PressConfig<AppShape, any> {
  content: _Internal.AnyInput;
  plugins?: PluginOption<Plugin<AppShape, any>>[];
  /** `site` of the Astro config */
  siteUrl?: string;
}

/** the stages of a site, without a preset unless `preset` is given */
export function testPress(input: TestSite) {
  const { content, plugins = [], preset, site, head, ui, siteUrl: _siteUrl, ...options } = input;
  return createPress<_Internal.AnyInput, string | undefined, AppShape, {}>(content, options)
    .plugins(...plugins)
    .config({ preset: "preset" in input ? preset : [], site, head, ui });
}

/** the context of a site on a runtime without own pages or defaults */
export async function pressContext(site: TestSite, runtime: Partial<PressRuntime> = {}) {
  const ctx = await createPressContext(testPress(site), {
    base: "/",
    baseUrl: site.siteUrl,
    defaults: [],
    signal: new AbortController().signal,
    isClientReference: () => false,
    ...runtime,
  });
  ctx.setRuntimeRoutes([]);
  return ctx;
}

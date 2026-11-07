import type { I18nConfig } from "fumadocs-core/i18n";
import type { _Internal, PageData, VirtualFile } from "fumadocs-core/source";
import { createPressContext, type PressRuntime } from "@/context";
import type { PageRouteInput } from "@/routes";
import type { AppShape, Plugin, PluginOption } from "@/plugin";
import { createPress, type ContentOptions, type PressConfig, type SiteConfig } from "@/press";

export const i18n: I18nConfig = { languages: ["en", "cn"], defaultLanguage: "en" };

/** a content page titled by its path */
export function page(path: string, data?: PageData & Record<string, unknown>): VirtualFile {
  return { type: "page", path, data: { title: path, ...data } };
}

/** a site in one object: the content, its options, the plugins and the options of `.config()` */
export interface TestSite
  extends
    ContentOptions<_Internal.AnyInput, string | undefined>,
    Omit<PressConfig<AppShape, any>, "site"> {
  content: _Internal.AnyInput;
  site?: SiteConfig;
  plugins?: PluginOption<Plugin<AppShape, any>>[];
}

/** the stages of a site, without a preset unless `preset` is given */
export function testPress(input: TestSite) {
  const { content, plugins = [], preset, site, head, ui, ...options } = input;
  return createPress<_Internal.AnyInput, string | undefined, AppShape, { site?: SiteConfig }>(
    content,
    options,
  )
    .plugins(...plugins)
    .config({ preset: "preset" in input ? preset : [], site, head, ui });
}

/** the runtime of a test site, serving `routes` */
export type TestRuntime = Partial<PressRuntime> & { routes?: PageRouteInput[] };

/** the context of a site on a runtime without defaults */
export async function pressContext(site: TestSite, { routes = [], ...runtime }: TestRuntime = {}) {
  const ctx = await createPressContext(testPress(site), {
    base: "/",
    baseUrl: site.site?.baseUrl,
    defaults: [],
    signal: new AbortController().signal,
    isClientReference: () => false,
    ...runtime,
  });
  ctx.setRuntimeRoutes(routes);
  return ctx;
}

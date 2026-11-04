import type { _Internal } from "fumadocs-core/source";
import { createPressContext, type PressRuntime, type RuntimeRoute } from "@/context";
import type { AppShape, Plugin, PluginOption } from "@/plugin";
import { createPress, type ContentOptions, type PressConfig } from "@/press";

/** a site in one object: the content, its options, the plugins and the options of `.config()` */
export interface TestSite
  extends ContentOptions<_Internal.AnyInput, string | undefined>, PressConfig<AppShape, any> {
  content: _Internal.AnyInput;
  plugins?: PluginOption<Plugin<AppShape, any>>[];
}

/** the stages of a site, without a preset unless `preset` is given */
export function testPress({ content, i18n, loaderOptions, plugins = [], ...config }: TestSite) {
  return createPress<_Internal.AnyInput, string | undefined, AppShape, {}>(content, {
    i18n,
    loaderOptions,
  })
    .plugins(...plugins)
    .config({ preset: [], ...config });
}

/** the runtime of a test site, serving `routes` */
export type TestRuntime = Partial<PressRuntime> & { routes?: RuntimeRoute[] };

/** the context of a site on a runtime without defaults */
export async function pressContext(site: TestSite, { routes = [], ...runtime }: TestRuntime = {}) {
  const ctx = await createPressContext(testPress(site), {
    base: "/",
    defaults: [],
    signal: new AbortController().signal,
    isClientReference: () => false,
    ...runtime,
  });
  ctx.setRuntimeRoutes(routes);
  return ctx;
}

import type { ConfigContext, Layouts } from "@/config";
import type { AppContext } from "@/lib/shared";
import type { Page } from "fumadocs-core/source";
import { unstable_notFound } from "waku/router/server";

export function createLayoutSwitchAuto<C extends ConfigContext = ConfigContext>(
  layouts: Record<
    C["loaderConfig"]["page"] extends Page<infer Type extends string> ? Type : never,
    Layouts<C>["page"]
  >,
): Layouts<C>["page"] {
  return createLayoutSwitch((page) => page.type, layouts);
}

export function createLayoutSwitch<const T extends string, C extends ConfigContext = ConfigContext>(
  /** detect layout from page */
  detector: (this: AppContext<C>, page: C["loaderConfig"]["page"]) => T | undefined,
  layouts: Record<NoInfer<T>, Layouts<C>["page"]>,
): Layouts<C>["page"] {
  return async function (props) {
    const key = detector.call(props.ctx, props.page);
    if (typeof key !== "string") unstable_notFound();

    const Layout = layouts[key] as Layouts<C>["page"];
    if (!Layout) unstable_notFound();

    return <Layout {...props} />;
  };
}

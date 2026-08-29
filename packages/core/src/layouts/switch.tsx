import { getPressContext, type AppContext, type AppShape } from "@/app/context";
import type { Page } from "fumadocs-core/source";
import type { ReactNode } from "react";
import { unstable_notFound } from "waku/router/server";

type PageLayout<C extends AppShape> = (opts: {
  lang?: string;
  slugs: string[];
  page: C["page"];
}) => ReactNode;

/** @deprecated write a `renderPage` function switching on `page.type` instead */
export function createLayoutSwitchAuto<C extends AppShape = AppShape>(
  layouts: Record<C["page"] extends Page<infer Type extends string> ? Type : never, PageLayout<C>>,
): PageLayout<C> {
  return createLayoutSwitch((page) => page.type, layouts);
}

export function createLayoutSwitch<const T extends string, C extends AppShape = AppShape>(
  /** detect layout from page */
  detector: (this: AppContext<C>, page: C["page"]) => T | undefined,
  layouts: Record<NoInfer<T>, PageLayout<C>>,
): PageLayout<C> {
  return async function (props) {
    const key = detector.call(getPressContext<C>(), props.page);
    if (typeof key !== "string") unstable_notFound();

    const Layout = layouts[key] as PageLayout<C>;
    if (!Layout) unstable_notFound();

    return <Layout {...props} />;
  };
}

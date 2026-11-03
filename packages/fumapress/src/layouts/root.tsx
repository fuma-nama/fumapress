import { type AppShape, getPressContext } from "@/app/context";
import { wrapSlot, type SearchPluginAPI } from "@fumapress/core";
import type { SharedProps } from "fumadocs-ui/components/dialog/search";
import { i18nProvider, uiTranslations } from "fumadocs-ui/i18n";
import type { ComponentType, ReactElement, ReactNode } from "react";
import type { Awaitable } from "@/lib/types";
import { PressProvider, type PressProviderProps } from "@/components/provider";
import stylesInline from "virtual:root.css?inline";
import stylesHref from "virtual:root.css?url";
import { Interceptor, renderWithInterceptors } from "@/lib/interceptors";

/** the search dialogs of static indexes, searched in the browser */
const staticDialogs = {
  flexsearch: () => import("@/components/flexsearch-static"),
  orama: () => import("@/components/orama-search-static"),
} satisfies Record<
  NonNullable<SearchPluginAPI["staticIndex"]>,
  () => Promise<{ default: ComponentType<SharedProps> }>
>;

export interface RootLayoutOptions {
  providerProps?: Omit<PressProviderProps, "children">;
}

let styleTag: ReactElement;
if (import.meta.env.DEV) {
  styleTag = <style>{stylesInline}</style>;
} else {
  styleTag = <link rel="stylesheet" href={stylesHref} />;
}

type ProviderInterceptor<S extends AppShape> = Interceptor<
  S,
  PressProviderProps,
  { lang?: string }
>;

export interface RootLayoutContextData<S extends AppShape = AppShape> {
  transformers?: ((props: PressProviderProps) => Awaitable<PressProviderProps>)[];
  providerInterceptors?: ProviderInterceptor<S>[];
}

export function createRootLayout<C extends AppShape = AppShape>(_options?: RootLayoutOptions) {
  return async function ({ lang, children }: { lang?: string; children: ReactNode }) {
    const ctx = getPressContext<C>();
    const layoutData = ctx.data["core:provider"] ?? {};
    const slots = await ctx.getSlots({});
    let providerProps: PressProviderProps = {
      ..._options?.providerProps,
      children: wrapSlot(slots["layout.wrapper"], children),
    };

    if (ctx.translationsConfig && "config" in ctx.translationsConfig) {
      providerProps.i18n ??= i18nProvider(ctx.translationsConfig.extend(uiTranslations()), lang);
      if (ctx.i18nConfig?.hideLocale === "default-locale") {
        providerProps.hiddenLocale ??= ctx.i18nConfig.defaultLanguage;
      }
    } else if (ctx.translationsConfig) {
      providerProps.i18n ??= i18nProvider(ctx.translationsConfig.extend(uiTranslations()));
    }

    for (const hook of layoutData.transformers ?? []) {
      providerProps = await hook(providerProps);
    }

    // search plugins serve `/api/search`, the search dialog is disabled without one
    const search = ctx.getProvider("search");
    providerProps.search ??= { enabled: search !== undefined };
    const staticIndex = ctx.mode === "static" ? search?.api?.staticIndex : undefined;
    if (staticIndex)
      providerProps.search.SearchDialog ??= (await staticDialogs[staticIndex]()).default;

    const renderProvider = renderWithInterceptors(
      ctx,
      { lang },
      (props) => <PressProvider {...props} />,
      layoutData.providerInterceptors,
    );

    return (
      <html lang={lang ?? "en"} suppressHydrationWarning>
        <head>
          {styleTag}
          {await ctx.renderRootMeta()}
        </head>
        <body data-version="1.0" className="flex flex-col min-h-screen">
          {renderProvider(providerProps)}
        </body>
      </html>
    );
  };
}

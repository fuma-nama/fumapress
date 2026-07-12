import { type AppShape, getPressContext } from "@/app/context";
import { i18nProvider, uiTranslations } from "fumadocs-ui/i18n";
import type { ReactElement, ReactNode } from "react";
import type { Awaitable } from "@/lib/types";
import { PressProvider, type PressProviderProps } from "@/components/provider";
import stylesInline from "virtual:root.css?inline";
import stylesHref from "virtual:root.css?url";

export interface RootLayoutOptions {
  providerProps?: Omit<PressProviderProps, "children">;
}

let styleTag: ReactElement;
if (import.meta.env.DEV) {
  styleTag = <style>{stylesInline}</style>;
} else {
  styleTag = <link rel="stylesheet" href={stylesHref} />;
}

export type RootLayoutContextData = ((
  props: PressProviderProps,
) => Awaitable<PressProviderProps>)[];

export function createRootLayout<C extends AppShape = AppShape>(_options?: RootLayoutOptions) {
  return async function ({ lang, children }: { lang?: string; children: ReactNode }) {
    const ctx = getPressContext<C>();
    const hooks = ctx.data["core:provider"];
    let providerProps: PressProviderProps = {
      ..._options?.providerProps,
      children,
    };

    if (ctx.translationsConfig && "config" in ctx.translationsConfig) {
      providerProps.i18n ??= i18nProvider(ctx.translationsConfig.extend(uiTranslations()), lang);
    } else if (ctx.translationsConfig) {
      providerProps.i18n ??= i18nProvider(ctx.translationsConfig.extend(uiTranslations()));
    }

    if (hooks) {
      for (const hook of hooks) {
        providerProps = await hook(providerProps);
      }
    }

    return (
      <html lang={lang ?? "en"} suppressHydrationWarning>
        <head>
          {styleTag}
          {ctx.renderRootMeta()}
        </head>
        <body data-version="1.0" className="flex flex-col min-h-screen">
          <PressProvider {...providerProps} />
        </body>
      </html>
    );
  };
}

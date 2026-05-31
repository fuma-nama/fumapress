import type { Layouts, ConfigContext } from "@/config";
import { getPressContext, renderRootMeta } from "@/lib/shared";
import { i18nProvider } from "fumadocs-ui/i18n";
import type { ReactElement } from "react";
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

export function createRootLayout<C extends ConfigContext = ConfigContext>(
  options?: RootLayoutOptions,
): Layouts<C>["root"] {
  return async function ({ lang, children }) {
    const ctx = getPressContext<C>();
    const hooks = ctx.data["core:provider"];
    let providerProps: PressProviderProps = {
      ...options?.providerProps,
      children,
    };

    if (ctx.translationsConfig && "config" in ctx.translationsConfig) {
      providerProps.i18n ??= i18nProvider(ctx.translationsConfig, lang);
    } else if (ctx.translationsConfig) {
      providerProps.i18n ??= i18nProvider(ctx.translationsConfig);
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
          {renderRootMeta(ctx)}
        </head>
        <body data-version="1.0" className="flex flex-col min-h-screen">
          <PressProvider {...providerProps} />
        </body>
      </html>
    );
  };
}

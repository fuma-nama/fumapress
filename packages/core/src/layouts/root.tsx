import type { Layouts, ConfigContext } from "@/config";
import { RootProvider, type RootProviderProps } from "fumadocs-ui/provider/waku";
import { renderRootMeta } from "@/lib/shared";
import { i18nProvider } from "fumadocs-ui/i18n";
import type { ReactElement } from "react";

export interface RootLayoutOptions {
  providerProps?: Omit<RootProviderProps, "children">;
}

let styleTag: ReactElement;
if (import.meta.env.DEV) {
  const { default: styles } = await import("virtual:root.css?inline");
  styleTag = <style>{styles}</style>;
} else {
  const { default: cssUrl } = await import("virtual:root.css?url");
  styleTag = <link rel="stylesheet" href={cssUrl} />;
}

export function createRootLayout<C extends ConfigContext = ConfigContext>(
  options?: RootLayoutOptions,
): Layouts<C>["root"] {
  return async function ({ lang, ctx, children }) {
    const hooks = ctx.data["core:provider"];
    let providerProps: RootProviderProps = {
      ...options?.providerProps,
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
          <RootProvider {...providerProps}>{children}</RootProvider>
        </body>
      </html>
    );
  };
}

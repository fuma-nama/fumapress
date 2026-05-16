import type { Layouts, ConfigContext, I18nConfig } from "@/config";
import styles from "virtual:root.css?inline";
import { RootProvider, type RootProviderProps } from "fumadocs-ui/provider/waku";
import { renderRootMeta } from "@/lib/shared";

export interface RootLayoutOptions {
  providerProps?: Omit<RootProviderProps, "children">;
}

export function createRootLayout<C extends ConfigContext = ConfigContext>(
  options?: RootLayoutOptions,
): Layouts<C>["root"] {
  return async function ({ lang, ctx, children }) {
    const hooks = ctx.data["core:provider"];
    let providerProps: RootProviderProps = {
      ...options?.providerProps,
    };

    if (ctx.i18nConfig) {
      const { languages } = ctx.i18nConfig as I18nConfig;
      providerProps.i18n ??= {
        locale: lang,
        locales: Object.entries(languages).map(([k, v]) => ({
          name: v.displayName,
          locale: k,
        })),
        translations: lang ? languages[lang]?.translations : undefined,
      };
    }

    if (hooks) {
      for (const hook of hooks) {
        providerProps = await hook(providerProps);
      }
    }

    return (
      <html lang={lang ?? "en"} suppressHydrationWarning>
        <head>
          <style>{styles}</style>
          {renderRootMeta(ctx)}
        </head>
        <body data-version="1.0" className="flex flex-col min-h-screen">
          <RootProvider {...providerProps}>{children}</RootProvider>
        </body>
      </html>
    );
  };
}

import { type AppShape, getPressContext } from "@/app/context";
import { i18nProvider, uiTranslations } from "fumadocs-ui/i18n";
import type { ReactElement, ReactNode } from "react";
import type { Awaitable } from "@/lib/types";
import { PressProvider, type PressProviderProps } from "@/components/provider";
import stylesInline from "virtual:root.css?inline";
import stylesHref from "virtual:root.css?url";
import { Interceptor, renderWithInterceptors } from "@/lib/interceptors";
import { hiddenLocale } from "@/lib/i18n";

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
    let providerProps: PressProviderProps = {
      ..._options?.providerProps,
      children,
    };

    if (ctx.translationsConfig && "config" in ctx.translationsConfig) {
      providerProps.i18n ??= i18nProvider(ctx.translationsConfig.extend(uiTranslations()), lang);
      providerProps.hiddenLocale ??= hiddenLocale(ctx.i18nConfig);
    } else if (ctx.translationsConfig) {
      providerProps.i18n ??= i18nProvider(ctx.translationsConfig.extend(uiTranslations()));
    }

    for (const hook of layoutData.transformers ?? []) {
      providerProps = await hook(providerProps);
    }

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
          {ctx.renderRootMeta()}
        </head>
        <body data-version="1.0" className="flex flex-col min-h-screen">
          {renderProvider(providerProps)}
        </body>
      </html>
    );
  };
}

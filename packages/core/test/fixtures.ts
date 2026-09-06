import { initApp, type AppContext } from "@/app/context";
import type { ConfigUtils, FumapressConfig, SiteConfig } from "@/config";
import type { I18nConfig } from "fumadocs-core/i18n";
import type { VirtualFile } from "fumadocs-core/source";

export const i18n: I18nConfig = { languages: ["en", "cn"], defaultLanguage: "en" };

function page(path: string): VirtualFile {
  return { type: "page", path, data: { title: path, description: `About ${path}` } };
}

type Config = FumapressConfig<any, string>;

/** `docs/basics` is translated, `docs/only-en` falls back to English in `cn`, `docs/shared` belongs to every language */
export function createApp(
  options: { i18n?: I18nConfig; site?: SiteConfig; meta?: Config["meta"] } = {},
): Promise<AppContext> {
  const config: Config = {
    content: {
      files: [
        page("index.mdx"),
        page("docs/basics.mdx"),
        page("docs/basics.cn.mdx"),
        page("docs/only-en.mdx"),
        page("docs/shared.$.mdx"),
      ],
    },
    i18n: options.i18n,
    site: { baseUrl: "https://example.com", ...options.site },
    meta: options.meta,
    preset: false,
    renderPage: () => null,
    renderRoot: () => null,
    renderNotFound: () => null,
  };

  return initApp({ get: () => config } as unknown as ConfigUtils);
}

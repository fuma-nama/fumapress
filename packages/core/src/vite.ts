import type { Plugin } from "vite";
import { crawlFrameworkPkgs } from "./lib/vitefu";
import { resolveImageConfig, type ImageConfig, type ResolvedImageConfig } from "./lib/image/config";

export interface PluginOptions {
  /**
   * Auto-generate Vite config to handle CJS bundling.
   *
   * @default true
   */
  generateViteConfig?: boolean;

  /**
   * Image optimization config for the `Image` component.
   *
   * @default true
   */
  image?: ImageConfig | boolean;
}

export default function press(options?: PluginOptions): Plugin[] {
  return [
    core(options),
    // see https://github.com/wakujs/waku/issues/2092
    { name: "waku:vite-plugins:fs-router-typegen" },
    {
      name: "fumapress:internal-flags",
      enforce: "pre",
      config(config) {
        Object.assign(config, {
          _fumadocs_skipViteConfig: true,
        });
      },
    },
  ];
}

function core(options: PluginOptions = {}): Plugin {
  const { generateViteConfig = true, image: imageOptions = true } = options;

  return {
    name: "fumapress:core",
    async config(config, { command }) {
      let resolvedImageOptions: ResolvedImageConfig | false = false;
      if (imageOptions === true) resolvedImageOptions = resolveImageConfig();
      else if (imageOptions) resolvedImageOptions = resolveImageConfig(imageOptions);

      const out = generateViteConfig
        ? await crawlFrameworkPkgs({
            root: config.root ?? process.cwd(),
            isBuild: command === "build",
            isFrameworkPkgByName(pkgName) {
              if (
                pkgName.startsWith("@fumapress/") ||
                pkgName.startsWith("@fumadocs/") ||
                pkgName.startsWith("fumadocs-") ||
                pkgName.startsWith("fumapress-") ||
                pkgName === "fumapress"
              )
                return true;
              switch (pkgName) {
                case "vite":
                case "waku":
                case "shiki":
                  return false;
              }
            },
          })
        : null;

      return {
        define: {
          __FUMAPRESS_IMAGE_CONFIG__: resolvedImageOptions,
        },
        ssr: {
          noExternal: out?.ssr.noExternal,
          external: ["@takumi-rs/image-response", "sharp"],
        },
        optimizeDeps: out?.optimizeDeps,
      };
    },
    async resolveId(source, _importer, options) {
      if (source === "virtual:fumapress-core/config") {
        return this.resolve("/press.config", undefined, options);
      }

      if (source.startsWith("virtual:root.css")) {
        const [_id, query = ""] = source.split("?", 2);

        return (
          (await this.resolve(`/src/app.css?${query}`)) ??
          (await this.resolve(`fumapress/css/default.css?${query}`))
        );
      }
    },
    async load(id) {
      if (id === "\0virtual:vite-rsc-waku/server-entry-inner") {
        return getManagedServerEntry();
      }
    },
  };
}

function getManagedServerEntry() {
  return `import adapter from 'waku/adapters/default';
import pressConfig from 'virtual:fumapress-core/config';
import { createRouter } from 'fumapress/router';
import { fsRouterFn } from 'fumapress/router/fs';

const modules = import.meta.glob("./pages/**/*.{ts,tsx,js,jsx}", {
  base: '/src',
});

const router = createRouter(pressConfig);
const pages = router.createPages(fsRouterFn(modules));
const middlewareFns = router.createMiddlewares();

export default adapter(pages, { middlewareFns });
`;
}

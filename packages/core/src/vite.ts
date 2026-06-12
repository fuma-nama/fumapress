import type { Plugin } from "vite";
import { crawlFrameworkPkgs } from "./lib/vitefu";
import { fileURLToPath } from "node:url";

export interface PluginOptions {
  /**
   * Auto-generate Vite config to handle CJS bundling.
   *
   * @default true
   */
  generateViteConfig?: boolean;
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
  const { generateViteConfig = true } = options;

  return {
    name: "fumapress:core",
    async config(config, { command }) {
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
        ssr: {
          noExternal: out?.ssr.noExternal,
          external: ["@takumi-rs/image-response", "sharp"],
        },
        optimizeDeps: out?.optimizeDeps,
      };
    },
    async resolveId(source, importer, options) {
      if (source === "virtual:fumapress-core/config") {
        return this.resolve("/press.config", undefined, options);
      }

      if (source === "@fuma-translate/react" && importer && isRscClientReferencesModule(importer)) {
        // see https://github.com/vitejs/vite-plugin-react/issues/1247
        // TODO: remove this once fixed upstream
        // we use this file as parent to resolve `source` because `@fuma-translate/react` is already a dep of `fumapress`
        return fileURLToPath(import.meta.resolve(source));
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

function isRscClientReferencesModule(id: string) {
  return (
    id.startsWith("\0virtual:vite-rsc/client-references") ||
    id.startsWith("virtual:vite-rsc/client-references")
  );
}

function getManagedServerEntry() {
  return `import _adapter from 'waku/adapters/default';
import pressConfig from 'virtual:fumapress-core/config';
import { createRouter } from 'fumapress/router';
import { fsRouterFn } from 'fumapress/router/fs';

const modules = import.meta.glob("./pages/**/*.{ts,tsx,js,jsx}", {
  base: '/src',
});

const router = await createRouter(pressConfig);
const pages = router.createPages(fsRouterFn(modules));
const middlewareFns = router.createMiddlewares();
const adapter = router.patchAdapter(_adapter);

export default adapter(pages, { middlewareFns });
`;
}

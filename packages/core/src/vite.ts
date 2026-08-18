import type { Plugin } from "vite";
import { crawlFrameworkPkgs } from "./lib/vitefu";
import { fileURLToPath } from "node:url";
import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import * as r from "resolve.exports";

export interface PluginOptions {
  /**
   * Auto-generate Vite config to handle CJS bundling.
   *
   * @default true
   */
  generateViteConfig?: boolean;

  /**
   * The base path to serve HTTP, must end with `/`.
   *
   * @default '/'
   */
  basePath?: string;

  /**
   * The source directory relative to root.
   *
   * @default 'src'
   */
  srcDir?: string;

  /**
   * The output directory of builds, relative to root.
   *
   * @default 'dist'
   */
  distDir?: string;

  /**
   * The private directory relative to root, its files are readable only on the server.
   *
   * @default 'private'
   */
  privateDir?: string;

  /**
   * Base path for HTTP requests to indicate RSC requests.
   *
   * @default 'RSC'
   */
  rscBase?: string;

  /**
   * Adapter module for your deployment target, e.g. `waku/adapters/vercel`.
   *
   * Defaults to a platform-specific adapter based on environment variables (Vercel, Netlify, Cloudflare), or `waku/adapters/node`.
   */
  adapter?: string;
}

export function getDefaultAdapter(): string {
  return process.env.VERCEL
    ? "waku/adapters/vercel"
    : process.env.NETLIFY
      ? "waku/adapters/netlify"
      : process.env.CLOUDFLARE || process.env.WORKERS_CI
        ? "waku/adapters/cloudflare"
        : "waku/adapters/node";
}

export default function press(options?: PluginOptions): Plugin[] {
  return [
    core(options),
    wakuCompat(),
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

/**
 * Compatibility layer for running Waku as a dependency of `fumapress` instead of the app:
 *
 * `resolveId` maps every `waku` specifier to fumapress's own copy, since `waku` may not be installed in the app's `node_modules`:
 *
 * - specifiers resolved against the project root fail entirely, e.g. the configured adapter module (resolved without an importer) or imports from Waku's virtual modules.
 * - packages with their own `waku` peer dependency (e.g. `fumadocs-core`) can otherwise resolve a second `waku` instance, which breaks the RSC runtime.
 *
 * Note: don't call `this.resolve()` with the same specifier during builds, Rolldown awaits the in-flight resolution of the same source and deadlocks. Build-time resolution is served from Waku's exports map, read once here.
 *
 * The config hooks patch Waku's assumption that `waku` and `react-server-dom-webpack` are installed at the project root:
 *
 * - it rewrites `optimizeDeps.include` entries like `@vitejs/plugin-rsc/x` into `waku > @vitejs/plugin-rsc/x` chains, resolved from root. Prefix them with `fumapress > ` so the optimizer resolves them through `fumapress` instead.
 * - `react-server-dom-webpack` must be in `noExternal`: Vite's dev-time `fetchModule` externalizes bare imports BEFORE plugins run, so Waku's `patch-rsdw` plugin never gets to alias them to `@vitejs/plugin-rsc`'s vendored copy, and the runtime loads the real package without the `react-server` condition. With a root install, vitefu's crawl used to add it to `noExternal`; replicate that.
 */
function wakuCompat(): Plugin {
  let waku: { dir: string; packageJson: Record<string, unknown> } | undefined;
  try {
    // realpath: `import.meta.resolve` keeps symlink paths, while Vite resolves to real paths — mixing them duplicates modules (and React contexts)
    const pkgPath = realpathSync(fileURLToPath(import.meta.resolve("waku/package.json")));
    waku = {
      dir: path.dirname(pkgPath),
      packageJson: JSON.parse(readFileSync(pkgPath, "utf-8")),
    };
  } catch {
    // types-only install of fumapress, let Vite resolve waku
  }

  const selfImporter = realpathSync(fileURLToPath(import.meta.url));

  return {
    name: "fumapress:waku",
    configEnvironment: {
      // after Waku's own rewrite of `optimizeDeps.include`
      order: "post",
      handler(name, config) {
        // rewrite whenever `resolveId` below is active, so the optimizer resolves the same copy of
        // waku as the module graph — even when the app has its own root install
        if (config.optimizeDeps?.include && waku) {
          config.optimizeDeps.include = config.optimizeDeps.include.map((id) => {
            if (id === "waku" || id.startsWith("waku/") || id.startsWith("waku > "))
              return `fumapress > ${id}`;
            if (id.startsWith("react-server-dom-webpack")) return `fumapress > waku > ${id}`;
            return id;
          });
        }

        if (name !== "client") {
          return {
            resolve: {
              noExternal: ["react-server-dom-webpack"],
            },
          };
        }
      },
    },
    resolveId: waku
      ? {
          filter: {
            id: [/^waku$/, /^waku\//],
          },
          async handler(source, importer, options) {
            // cycle guard for the dev-mode fallback resolution below
            if (importer === selfImporter) return;

            if (this.environment?.mode === "dev") {
              // route the resolution through Vite with an importer inside `fumapress`, so module URLs
              // get their natural treatment (e.g. the browser's `?v=` query) — returning raw paths here
              // gives modules a second identity, which duplicates Waku's React contexts ("Missing Router")
              return this.resolve(source, selfImporter, { ...options, skipSelf: true });
            }

            const targets = r.exports(waku.packageJson, source.replace(/^waku/, "."), {
              conditions: this.environment?.config.resolve.conditions ?? [],
            });
            // fallback
            if (!targets || targets.length === 0) return;
            return path.join(waku.dir, targets[0]!);
          },
        }
      : undefined,
  };
}

function core(options: PluginOptions = {}): Plugin {
  const { generateViteConfig = true } = options;

  return {
    name: "fumapress:core",
    api: {
      // read by the `fumapress` CLI to configure Waku.js
      pressOptions: options,
    },
    configResolved(config) {
      if (process.env.VITEST) return;
      if (!config.plugins.some((plugin) => plugin.name === "waku:vite-plugins:environments")) {
        throw new Error(
          "fumapress must run through its own CLI: replace `vite dev`/`vite build` with `fumapress dev`/`fumapress build`.",
        );
      }
    },
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

      const adapter = options.adapter ?? getDefaultAdapter();

      return {
        define: {
          // baked into the bundle: runtime env vars are unreliable across platforms (e.g. Cloudflare Workers)
          "import.meta.env.FUMAPRESS_PLATFORM": JSON.stringify(
            adapter.startsWith("waku/adapters/") ? adapter.slice("waku/adapters/".length) : "",
          ),
        },
        resolve: {
          // packages with React contexts must resolve to a single copy, e.g. pnpm can otherwise
          // instantiate `fumadocs-core` twice from its optional `waku` peer dependency
          dedupe: out?.ssr.noExternal,
        },
        ssr: {
          noExternal: out?.ssr.noExternal,
          external: ["sharp"],
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
  if (id.startsWith("\0")) id = id.slice(1);
  return (
    id.startsWith("virtual:vite-rsc/client-references") ||
    id.startsWith("virtual:vite-rsc/client-package-proxy")
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

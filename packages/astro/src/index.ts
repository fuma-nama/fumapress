import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
import type { DevEnvironment, Plugin, RunnableDevEnvironment, ViteDevServer } from "vite";
import fumadocs, { type CollectionConfig, type FumadocsOptions } from "@fumadocs/astro";
import type { BuildMode } from "@fumapress/core";
import { crawlFrameworkPkgs, type CrawlResult } from "@fumapress/core/runtime/vite";
import { createBuildOutput } from "./build";
import { clientReferences } from "./island/plugin";
import type * as Context from "./routes/context";
import type * as Generated from "virtual:fumapress/astro";

export interface AstroPressOptions extends FumadocsOptions {
  /**
   * Module whose default export is the MDX components, like `./src/components/mdx.tsx`. The React content of plugins renders with them too.
   *
   * @defaultValue "fumadocs-ui/mdx"
   */
  components?: string;
}

/** the MDX components without the `components` option */
const defaultComponents = "fumadocs-ui/mdx";

/**
 * Fumapress on Astro: the site of `press.config.tsx`, with its routes, layouts and plugins.
 *
 * It adds the Fumadocs integration for the content collections, its options are the options of `fumadocs()`.
 */
export default function press({
  collections = { docs: { dir: "content/docs" } },
  components = defaultComponents,
  ...options
}: AstroPressOptions = {}): AstroIntegration[] {
  // the content renders in the provider of content
  const contentCollections: Record<string, CollectionConfig> = {};
  for (const [name, collection] of Object.entries(collections))
    contentCollections[name] = {
      ...collection,
      components: `virtual:fumapress/components/${name}`,
    };

  let basePath = "";
  let outDir = "";
  let routes: typeof Generated.routes = [];
  let onDemand: RegExp[] = [];
  let prerendered404 = false;
  let devUrl: string | undefined;
  let server: ViteDevServer | undefined;

  return [
    fumadocs({ ...options, collections: contentCollections }),
    {
      name: "@fumapress/astro",
      hooks: {
        async "astro:config:setup"({ config, injectRoute, addMiddleware, updateConfig }) {
          const root = fileURLToPath(config.root);
          const srcDir = fileURLToPath(config.srcDir);
          const adapter = config.adapter !== undefined;
          const mode: BuildMode = !adapter
            ? "static"
            : config.output === "server"
              ? "dynamic"
              : "default";
          basePath = config.base.replace(/\/$/, "");
          const site = config.site && config.site.replace(/\/$/, "") + basePath;
          const appCss = path.join(srcDir, "app.css");

          const files: Record<string, string> = {
            "virtual:fumapress/config": resolveConfigFile(root),
            "virtual:fumapress/css": fs.existsSync(appCss)
              ? appCss
              : fileURLToPath(new URL("../css/default.css", import.meta.url)),
          };
          const modules: Record<string, string | ((environment: string) => string)> = {
            "virtual:fumapress/astro": (environment) => `export const adapter = ${adapter};
export const staticNotFound = ${adapter && config.trailingSlash === "always" && prerendered404};
export const defaultMode = ${JSON.stringify(mode)};
export const routes = ${JSON.stringify(routes)};
export const prerender = ${environment === "prerender"};
export const siteUrl = ${JSON.stringify(devUrl ?? site)};`,
            "virtual:fumapress/island": `import components from ${userModule(root, components)};
import { createIsland } from ${JSON.stringify(internalModule("island/island"))};
export const PressIsland = createIsland(components);
export { components };`,
          };
          for (const [name, collection] of Object.entries(collections)) {
            modules[`virtual:fumapress/components/${name}`] =
              `import components from ${userModule(root, collection.components ?? components)};
import { withProvider } from ${JSON.stringify(internalModule("ui/content"))};
export default withProvider(components);`;
          }

          const route = (pattern: string, file: string, prerender = true) =>
            injectRoute({
              pattern,
              entrypoint: new URL(`./routes/${file}`, import.meta.url),
              prerender,
            });
          route("[...fumapressPage]", "page.astro");
          route("[...fumapressFile]", "file.js");
          // routes rendered on request, Astro tries the prerendered routes of a pattern first
          if (adapter) route("[...fumapressServer]", "server.astro", false);
          const userPages = path.join(srcDir, "pages");
          if (
            !["astro", "md", "mdx", "html"].some((ext) =>
              fs.existsSync(path.join(userPages, `404.${ext}`)),
            )
          )
            // on a server, it renders in the language of the URL prefix
            route("404", "404.astro", !adapter);
          addMiddleware({
            order: "pre",
            entrypoint: new URL("./routes/middleware.js", import.meta.url),
          });

          const context = internalModule("routes/context");
          const crawl = await crawlFrameworkPkgs(root, "astro");
          const { dependencies = {}, devDependencies = {} } = JSON.parse(
            fs.readFileSync(path.join(root, "package.json"), "utf8"),
          );
          updateConfig({
            vite: {
              // in dev, Astro externalizes the dependencies of Astro packages, like `@fumapress/core` of this one, unless the config lists them
              ssr: { noExternal: crawl.framework },
              plugins: [
                frameworkPlugin(crawl, { ...dependencies, ...devDependencies }),
                virtualPlugin(files, modules),
                // every page has one of the layouts, they load with the island
                clientReferences(internalModule("island/references"), [
                  internalModule("ui/provider"),
                  internalModule("ui/default"),
                  internalModule("ui/home"),
                ]),
                contentReloadPlugin(context, Object.values(collections), root),
              ],
            },
          });
        },
        "astro:config:done"({ config }) {
          outDir = fileURLToPath(config.outDir);
        },
        "astro:routes:resolved"(params) {
          routes = [];
          onDemand = [];
          prerendered404 = false;
          for (const route of params.routes) {
            if (route.origin !== "project") continue;
            if (!route.isPrerendered) onDemand.push(route.patternRegex);
            if (route.pattern === "/404") prerendered404 = route.isPrerendered;
            if (route.type === "page" && !/^\/(404|500)$/.test(route.pattern))
              routes.push({
                path: route.pattern,
                render: route.isPrerendered ? "static" : "dynamic",
              });
          }
          // a page added in dev, the runtime has them in its generated module
          const ssr = server?.environments.ssr;
          const id = "virtual:fumapress/astro";
          const generated = ssr?.moduleGraph.getModuleById(id);
          if (generated) {
            ssr?.moduleGraph.invalidateModule(generated);
            // only its importers run again, other pages may be deleted
            ssr?.hot.send({ type: "full-reload", triggeredBy: id });
          }
        },
        "astro:server:setup"(params) {
          server = params.server;
        },
        "astro:server:start"({ address }) {
          devUrl = `http://localhost:${address.port}${basePath}`;
        },
        "astro:build:start"() {
          // the runtime sets `ctx` when it prerenders in this process
          globalThis.FUMAPRESS_BUILD = { links: [] };
        },
        // after the pages are generated, before the bundle of prerendered routes is deleted
        async "astro:build:generated"({ dir }) {
          const build = globalThis.FUMAPRESS_BUILD;
          globalThis.FUMAPRESS_BUILD = undefined;
          if (!build?.ctx) return;
          await build.ctx.build(
            createBuildOutput(build.ctx, build.links, {
              dir: fileURLToPath(dir),
              outDir,
              routes: onDemand,
            }),
          );
        },
      },
    },
  ];
}

/**
 * Packages of Fumadocs and Fumapress are bundled on the server, and not pre-bundled for the browser: client references tag their modules on the server, and a module must have one copy in the browser, its React contexts too.
 *
 * Their CommonJS dependencies are pre-bundled instead.
 *
 * @param own - the dependencies of the site: Vite resolves deduped packages from the root, so packages only other packages depend on, like `@fumapress/core`, resolve from their importers
 */
function frameworkPlugin({ framework, include }: CrawlResult, own: Record<string, string>): Plugin {
  const dedupe = ["react", "react-dom"];
  for (const name of framework) if (Object.hasOwn(own, name)) dedupe.push(name);

  return {
    name: "@fumapress/astro:framework",
    config: () => ({ resolve: { dedupe } }),
    configEnvironment(name) {
      if (name === "client") return { optimizeDeps: { include, exclude: framework } };
      return { resolve: { noExternal: framework } };
    },
  };
}

/** `press.config.tsx` at the project root */
function resolveConfigFile(root: string): string {
  for (const ext of ["tsx", "ts", "jsx", "js", "mts", "mjs"]) {
    const file = path.join(root, `press.config.${ext}`);
    if (fs.existsSync(file)) return file;
  }
  throw new Error(
    "[Fumapress] add `press.config.tsx` to the project root, its default export is the config of the site.",
  );
}

/** the environment where Astro renders routes in dev, it can import modules */
function isRunnable(
  environment: DevEnvironment | undefined,
): environment is RunnableDevEnvironment {
  return environment !== undefined && "runner" in environment;
}

function isInside(dir: string, file: string): boolean {
  const relative = path.relative(dir, file);
  return !relative.startsWith("..") && !path.isAbsolute(relative);
}

/**
 * In dev, files of runtime content sources (like `@fumadocs/local-md`) aren't modules, a change reloads the content and the pages.
 *
 * Collections are left to Astro, which reloads their content itself.
 */
function contentReloadPlugin(
  /** the module of the runtime context */
  context: string,
  collections: CollectionConfig[],
  root: string,
): Plugin {
  const dirs: string[] = [];
  for (const { dir } of collections) dirs.push(path.resolve(root, dir));

  return {
    name: "@fumapress/astro:content-reload",
    configureServer(server) {
      const { ssr, client } = server.environments;
      if (!isRunnable(ssr)) return;
      const onFile = async (file: string) => {
        if (ssr.moduleGraph.getModulesByFile(file)?.size) return;
        if (dirs.some((dir) => isInside(dir, file))) return;
        const { ctx } = await ssr.runner.import<typeof Context>(context);
        for (const page of (await ctx.getLoader()).getPages()) {
          if (!page.absolutePath || !isInside(path.dirname(page.absolutePath), file)) continue;
          ctx.invalidateLoader();
          ssr.hot.send({ type: "full-reload" });
          client?.hot.send({ type: "full-reload" });
          return;
        }
      };

      const listener = (file: string) => void onFile(file).catch(() => undefined);
      server.watcher.on("add", listener);
      server.watcher.on("change", listener);
      server.watcher.on("unlink", listener);
    },
  };
}

/** resolved from the project rather than this package */
function userModule(root: string, file: string): string {
  return JSON.stringify(
    file.startsWith(".") ? path.resolve(root, file).replaceAll(path.sep, "/") : file,
  );
}

/** a module of this package for the generated code, not a public export */
function internalModule(name: string): string {
  return fileURLToPath(new URL(`./${name}.js`, import.meta.url)).replaceAll(path.sep, "/");
}

/**
 * The generated modules, and the files of `files`.
 *
 * Islands are hydrated by their IDs, Astro doesn't support the `\0` prefix of virtual modules there.
 */
function virtualPlugin(
  files: Record<string, string>,
  modules: Record<string, string | ((environment: string) => string)>,
): Plugin {
  const filter = { id: /^virtual:fumapress\// };

  return {
    name: "@fumapress/astro:virtual",
    resolveId: {
      filter,
      handler: (id) => files[id] ?? (Object.hasOwn(modules, id) ? id : undefined),
    },
    load: {
      filter,
      handler(id) {
        const module = modules[id];
        return typeof module === "function" ? module(this.environment.name) : module;
      },
    },
  };
}

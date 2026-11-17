import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vue, { type Options as VueOptions } from "@vitejs/plugin-vue";
import { nitro } from "nitro/vite";
import { normalizePath, type Plugin, type PluginOption } from "vite";
import * as compiler from "vue/compiler-sfc";
import { compileMarkdown, type MarkdownOptions } from "./vite/compile";
import { parseFrontmatter } from "./vite/frontmatter";
import { listPages, readMacros, transformMacros } from "./vite/macro";
import { scanPages } from "./vite/scan";
import { typeResolver } from "./vite/type-resolver";
import { mergeOptions } from "./core/merge";
import { prerenderListPath } from "./core/routes";

export type { MarkdownOptions } from "./vite/compile";

export interface PressOptions {
  /**
   * A module that default-exports the theme of the site, merged over the default theme: its `Layout`, the
   * `components` of Markdown, the `views` of plugin pages and the `icons` of the page tree. It runs on the server and
   * in the browser.
   *
   * The stylesheet of the site is `src/theme.css` (or `src/theme/style.css`) when the file exists, in place of the
   * default one, wherever this option points.
   *
   * @defaultValue "src/theme.ts" or "src/theme/index.ts", when the file exists
   */
  theme?: string;
  /**
   * Build on the default theme: `false` leaves its layout, root provider and Markdown components out of the site, whose
   * theme module then gives its `Layout`.
   *
   * @defaultValue true
   */
  defaultTheme?: boolean;
  /** custom pages, a `.vue` file is a route by its path @defaultValue "src/pages" */
  pagesDir?: string;
  /** how every Markdown file of the site compiles: the collections share them */
  markdown?: MarkdownOptions;
  /** options of `@vitejs/plugin-vue`, added to the ones Fumapress sets, like `template.compilerOptions` */
  vue?: VueOptions;
  /** options of Nitro, like the `preset` to deploy with */
  nitro?: Parameters<typeof nitro>[0];
}

const runtimeDir = fileURLToPath(new URL("../runtime/", import.meta.url));
const PREFIX = "virtual:press/";
const RESOLVED = "\0virtual:press/";
const configFiles = ["press.config.ts", "press.config.mts", "press.config.js", "press.config.mjs"];
const themeFiles = ["src/theme.ts", "src/theme.js", "src/theme/index.ts", "src/theme/index.js"];
const styleFiles = ["src/theme.css", "src/theme/style.css"];

/** what the plugins share: the root of the Vite project, known when its config resolves */
interface Site {
  root: string;
}

/** the config of a site without `press.config`, compiled like one */
const defaultConfig = `import { createPress } from "@fumapress/vue/config";
import { defineDocs } from "@fumapress/vue/content";

const docs = defineDocs({ dir: "content" });

export default createPress(docs.toFumadocsSource());
`;

function core(options: PressOptions, site: Site): Plugin {
  const pagesPath = options.pagesDir ?? "src/pages";
  let root = site.root;
  let isDev = false;
  let pagesDir = "";

  const str = (value: unknown) => JSON.stringify(value);
  const fromRoot = (file: string) => normalizePath(path.relative(root, file));
  const find = (names: string[]) =>
    names.map((name) => path.join(root, name)).find((name) => existsSync(name));

  async function loadRoutes() {
    const routes = (await scanPages(pagesDir)).map(({ path: routePath, absolutePath }) => {
      const file = normalizePath(absolutePath);
      // The styles of the page, linked from the HTML the server renders: the ones of the browser build. The build
      // of the server has the stylesheet of the site too, under another name. In development styles are modules,
      // found from the server.
      const assets = `${file}?assets${isDev ? "" : "=client"}`;
      return `{ path: ${str(routePath)}, component: () => import(${str(file)}), assets: () => import(${str(assets)}) }`;
    });
    return `export const routes = [\n${routes.join(",\n")}\n];\n`;
  }

  function loadConfig() {
    const file = find(configFiles);
    return file ? `export { default } from ${str(normalizePath(file))};\n` : defaultConfig;
  }

  /** a module whose macro calls are compiled: `press.config`, or the default one */
  function isConfig(id: string) {
    return (
      id === `${RESOLVED}config` ||
      configFiles.some((name) => id === normalizePath(path.join(root, name)))
    );
  }

  /** the theme module of the site, none without one: required without the default theme, which has the layout */
  function ownTheme(): string | undefined {
    const own = options.theme ? path.resolve(root, options.theme) : find(themeFiles);
    if (!own && options.defaultTheme === false) {
      throw new Error(
        "[Fumapress] `defaultTheme: false` needs a theme module with a `Layout`: create `src/theme.ts`, or set the `theme` option.",
      );
    }
    return own;
  }

  function loadTheme() {
    // one stylesheet: the one of the site in place of the default one, never both
    const style = find(styleFiles);
    const css = `import ${str(style ? normalizePath(style) : "@fumapress/vue/theme/style.css")};\n`;
    // without the default theme, nothing of it is imported: its code is not in the site
    const base =
      options.defaultTheme === false
        ? "const base = {};\n"
        : 'import base from "@fumapress/vue/theme";\n';

    const own = ownTheme();
    if (!own) return `${css}export { default } from "@fumapress/vue/theme";\n`;
    // maps and lists add to the default ones, the rest replaces them
    return `${css}${base}import user from ${str(normalizePath(own))};
const maps = (key) => ({ ...base[key], ...user[key] });
const theme = {
  ...base,
  ...user,
  components: maps("components"),
  views: maps("views"),
  icons: maps("icons"),
  head: [...(base.head ?? []), ...(user.head ?? [])],
};
if (!theme.Layout) {
  throw new Error(${str(`[Fumapress] The theme module ${fromRoot(own)} has no \`Layout\`, which renders the pages of the content.`)});
}
export default theme;
`;
  }

  return {
    name: "fumapress:vue",
    enforce: "pre",
    async config(config, { command }) {
      root = site.root = path.resolve(config.root ?? process.cwd());

      // Each page is an entry of the browser build, so the browser imports it by its URL: no list of pages to ship.
      // The folders of the collections are in the macro calls of `press.config`, whose options are literals.
      const pages: string[] = [];
      if (command === "build") {
        const file = find(configFiles);
        const code = file ? readFileSync(file, "utf8") : defaultConfig;
        for (const collection of readMacros(code, file ?? `${PREFIX}config`)) {
          pages.push(...(await listPages(collection, root)));
        }
      }

      return {
        environments: {
          client: {
            build: {
              rollupOptions: {
                input: [`${runtimeDir}entry-client.ts`, ...pages],
                // a page is imported for its default export
                preserveEntrySignatures: "exports-only",
              },
            },
          },
          ssr: { build: { rollupOptions: { input: `${runtimeDir}entry-server.ts` } } },
        },
        // the package imports the virtual modules of this plugin, so Vite has to process it
        ssr: { noExternal: ["@fumapress/vue"] },
        optimizeDeps: {
          exclude: ["@fumapress/vue"],
          // Dependencies are pre-bundled from the start: one found while a page loads would reload the page. Vite
          // looks for those of the site in its theme and its custom pages, and is told the ones of the UI, those it
          // imports lazily too, like the highlighter of the dynamic code block.
          entries: [options.theme ?? themeFiles, `${pagesPath}/**/*.vue`].flat(),
          include: [
            "vue",
            "@fumapress/vue > cn",
            "@fumapress/vue > class-variance-authority",
            "@fumapress/vue > scroll-into-view-if-needed",
            "@fumapress/vue > @pierre/highlights",
            "@fumapress/vue > @pierre/highlights/themes/github-light",
            "@fumapress/vue > @pierre/highlights/themes/github-dark",
          ],
        },
        define: {
          __VUE_OPTIONS_API__: "true",
          __VUE_PROD_DEVTOOLS__: "false",
          __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: "false",
        },
      };
    },
    configResolved(config) {
      isDev = config.command === "serve";
      pagesDir = path.resolve(root, pagesPath);
      ownTheme();
    },
    configureServer(server) {
      /** loads virtual modules again, on the server and in the browser */
      const reload = (...names: string[]) => {
        for (const environment of Object.values(server.environments)) {
          for (const name of names) {
            const mod = environment.moduleGraph.getModuleById(RESOLVED + name);
            if (mod) environment.moduleGraph.invalidateModule(mod);
          }
          environment.hot.send({ type: "full-reload" });
        }
      };
      const under = (names: string[]) => new Set(names.map((name) => path.join(root, name)));
      const ofTheme = under([...themeFiles, ...styleFiles]);
      const ofConfig = under(configFiles);

      // A file added or removed changes what a virtual module lists: the custom pages, or which file is the theme
      // or the config. The files of collections are `import.meta.glob` imports of the config, which Vite follows.
      const onListChange = (file: string) => {
        if (file.startsWith(pagesDir + path.sep)) reload("routes");
        else if (ofTheme.has(file)) reload("theme");
        else if (ofConfig.has(file)) reload("config");
      };
      server.watcher.on("add", onListChange);
      server.watcher.on("unlink", onListChange);
    },
    hotUpdate({ file, modules, server }) {
      // A module only the server has changed, like `press.config`, the frontmatter of a page or a `meta.json`: the
      // server renders what the browser shows, so the browser reloads. Vite reloads the server's modules.
      const client = server.environments.client;
      if (this.environment === client || modules.length === 0) return;
      if (!client.moduleGraph.getModulesByFile(file)?.size)
        client.hot.send({ type: "full-reload" });
    },
    resolveId(id) {
      if (id.startsWith(PREFIX)) return RESOLVED + id.slice(PREFIX.length);
    },
    load(id) {
      // the frontmatter of a page, which its collection imports
      const [file, query] = id.split("?");
      if (query && file && /\.mdx?$/.test(file) && new URLSearchParams(query).has("frontmatter")) {
        const { data } = parseFrontmatter(readFileSync(file, "utf8"));
        return `export default ${str(data)};\n`;
      }

      if (!id.startsWith(RESOLVED)) return;
      switch (id.slice(RESOLVED.length)) {
        case "routes":
          return loadRoutes();
        case "config":
          return loadConfig();
        case "theme":
          return loadTheme();
      }
    },
    async transform(source, id) {
      if (isConfig(id)) return transformMacros(source, id.replace(RESOLVED, PREFIX), root);

      const [file, query] = id.split("?");
      if (query || !file || !/\.mdx?$/.test(file)) return;

      const { code } = await compileMarkdown({
        source,
        filePath: file,
        isDevelopment: isDev,
        browser: this.environment.name === "client",
        options: options.markdown,
      });
      return { code, map: null };
    },
  };
}

/**
 * The Vue plugin for the components of the UI, which ship as source. Their props are types imported from other
 * files: the compiler reads those from the file system, so a site needs no TypeScript. It uses the one of the site
 * when it has a JS API (TypeScript 7 has none), for types that only TypeScript resolves.
 */
function vuePlugin(site: Site, options: VueOptions = {}): Plugin {
  compiler.registerTS(() => {
    try {
      const ts = createRequire(path.join(site.root, "package.json"))("typescript");
      if (ts.sys && ts.resolveModuleName) return ts;
    } catch {
      // not installed
    }
    return typeResolver;
  });

  // the options of the site add to these
  const own: VueOptions = {
    exclude: [/\?assets/],
    script: {
      fs: {
        fileExists: (file) => statSync(file, { throwIfNoEntry: false })?.isFile() ?? false,
        readFile: (file) => readFileSync(file, "utf8"),
        realpath: realpathSync,
      },
    },
  };
  // the compiler is the module, which a merge would copy
  return vue({ ...mergeOptions<VueOptions>([own, options]), compiler });
}

/** Fumapress for Vue: your content as a docs site, served and built by Nitro */
export default function press(options: PressOptions = {}): PluginOption[] {
  const site: Site = { root: process.cwd() };

  return [
    vuePlugin(site, options.vue),
    core(options, site),
    nitro({
      ...options.nitro,
      prerender: {
        // a page that fails to render fails the build, not a deployment without it
        failOnError: true,
        ...options.nitro?.prerender,
        // every content page and static route: the server lists them from here
        routes: [prerenderListPath(0), ...(options.nitro?.prerender?.routes ?? [])],
      },
    }),
  ];
}

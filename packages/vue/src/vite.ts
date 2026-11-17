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
import { lastCommitDates } from "./vite/git";
import { isHidden, isMeta, scanCollection, scanPages } from "./vite/scan";
import { typeResolver } from "./vite/type-resolver";
import { mergeOptions } from "./core/merge";
import { prerenderListPath } from "./core/routes";

export type { MarkdownOptions } from "./vite/compile";

export interface CollectionOptions {
  /** the folder of the collection, from the project root */
  dir: string;
  /**
   * The files of the collection: a page or `meta.json` it returns `false` for is left out of the site and of the build.
   * It receives the path of the file in the collection, and the frontmatter of a page or the content of a `meta.json`.
   */
  filter?: (file: { path: string; data: Record<string, unknown> }) => boolean;
}

export interface PressOptions {
  /**
   * The content of the site: Markdown and MDX files with `meta.json`, by collection name.
   *
   * @defaultValue { docs: { dir: "content" } }
   */
  collections?: Record<string, CollectionOptions>;
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
  markdown?: MarkdownOptions;
  /** options of `@vitejs/plugin-vue`, added to the ones Fumapress sets, like `template.compilerOptions` */
  vue?: VueOptions;
  /**
   * The `lastModified` of a Markdown page without one in its frontmatter: `"git"` reads the date of the last commit
   * that changed its file.
   */
  lastModified?: "git";
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

function core(options: PressOptions, site: Site): Plugin {
  const pagesPath = options.pagesDir ?? "src/pages";
  let root = site.root;
  let isDev = false;
  let collections: [name: string, dir: string, filter: CollectionOptions["filter"]][] = [];
  let pagesDir = "";

  /** the frontmatter of each page as the collections have it */
  const frontmatters = new Map<string, string>();

  const str = (value: unknown) => JSON.stringify(value);
  const fromRoot = (file: string) => normalizePath(path.relative(root, file));

  async function loadCollections(addWatchFile: (file: string) => void) {
    const entries: string[] = [];
    for (const [name, dir, filter] of collections) {
      const dates = options.lastModified === "git" ? await lastCommitDates(dir) : undefined;
      const files = (await scanCollection(dir, filter)).map((file) => {
        // frontmatter is part of this module: the dev server loads it again when the one of a file changes
        addWatchFile(file.absolutePath);
        if (file.type === "page") frontmatters.set(file.absolutePath, JSON.stringify(file.data));
        const shared = `type: ${str(file.type)}, path: ${str(file.path)}`;
        if (file.type === "meta") return `{ ${shared}, data: ${str(file.data)} }`;
        const id = normalizePath(file.absolutePath);
        // the compiled module of the page, which the `core:markdown` plugin renders: the server loads it, and
        // `?assets=client` is its file in the browser build, which the browser imports
        const ref = `{ file: ${str(fromRoot(file.absolutePath))}, load: () => import(${str(id)}), assets: () => import(${str(`${id}?assets=client`)}).then((mod) => mod.default) }`;
        // the date of a page is its own, or the one of git
        const lastModified = file.data.lastModified ?? dates?.get(file.absolutePath);
        return `{ ${shared}, data: { ...${str({ ...file.data, lastModified })}, _module: ${ref} } }`;
      });
      entries.push(`${str(name)}: [\n${files.join(",\n")}\n]`);
    }
    return `export const collections = {\n${entries.join(",\n")}\n};\n`;
  }

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
    const file = configFiles.map((name) => path.join(root, name)).find((name) => existsSync(name));
    if (file) return `export { default } from ${str(normalizePath(file))};\n`;
    // a site without `press.config`: its content with the defaults
    return `import { createPress } from "@fumapress/vue/config";\nimport { content } from "@fumapress/vue/content";\nexport default createPress(content);\n`;
  }

  const find = (names: string[]) =>
    names.map((name) => path.join(root, name)).find((name) => existsSync(name));

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
      collections = Object.entries(options.collections ?? { docs: { dir: "content" } }).map(
        ([name, { dir, filter }]) => [name, path.resolve(root, dir), filter],
      );

      // each page is an entry of the browser build, so the browser imports it by its URL: no list of pages to ship
      const pages: string[] = [];
      if (command === "build") {
        for (const [, dir, filter] of collections) {
          for (const file of await scanCollection(dir, filter)) {
            if (file.type === "page") pages.push(normalizePath(file.absolutePath));
          }
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
      // a file a collection can list: in its folder, and not under a name starting with `_`
      const inContent = (file: string) =>
        collections.some(
          ([, dir]) => file.startsWith(dir + path.sep) && !isHidden(path.relative(dir, file)),
        );
      const under = (names: string[]) => new Set(names.map((name) => path.join(root, name)));
      const ofTheme = under([...themeFiles, ...styleFiles]);
      const ofConfig = under(configFiles);

      // A file added or removed changes what a virtual module lists: the pages, or which file is the theme. The
      // server also lists the custom pages it generates, so it starts again with the collections.
      const onListChange = (file: string) => {
        if (inContent(file) || file.startsWith(pagesDir + path.sep))
          reload("collections", "routes");
        else if (ofTheme.has(file)) reload("theme");
        else if (ofConfig.has(file)) reload("config");
      };
      server.watcher.on("add", onListChange);
      server.watcher.on("unlink", onListChange);

      // The body of a page is its own module, which Vite reloads. Its frontmatter and the `meta.json` files are
      // part of the collections, which only the server reads: so the browser is told to reload.
      server.watcher.on("change", (file) => {
        if (!inContent(file)) return;
        if (isMeta(file)) return reload("collections");
        if (!/\.mdx?$/.test(file)) return;
        try {
          const { data } = parseFrontmatter(readFileSync(file, "utf8"));
          if (JSON.stringify(data) !== frontmatters.get(file)) reload("collections");
        } catch {
          // being written, or invalid: the next change is read
        }
      });
    },
    resolveId(id) {
      if (id.startsWith(PREFIX)) return RESOLVED + id.slice(PREFIX.length);
    },
    load(id) {
      if (!id.startsWith(RESOLVED)) return;
      switch (id.slice(RESOLVED.length)) {
        case "collections":
          return loadCollections((file) => this.addWatchFile(file));
        case "routes":
          return loadRoutes();
        case "config":
          return loadConfig();
        case "theme":
          return loadTheme();
      }
    },
    async transform(source, id) {
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

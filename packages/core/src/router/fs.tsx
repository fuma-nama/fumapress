/**
 * This is a copy of https://github.com/wakujs/waku/blob/main/packages/waku/src/router/fs-router.ts
 */
import type { FunctionComponent } from "react";
import type { Awaitable, RouteConfig, RouteFns } from "@/lib/types.js";
import type { AppContext } from "@/lib/shared";
import type { ConfigContext } from "@/config";
import { joinPathname } from "@/lib/join-pathname";

const Methods = ["GET", "POST", "HEAD", "PUT", "DELETE", "PATCH", "OPTIONS"];
const ValidMethods = new Set(Methods);

interface Options {
  /**
   * The pages directory name. Must match the directory in the glob
   * pattern, e.g. `"pages"` for `import.meta.glob('./pages/**\/*')`.
   * Glob keys whose first segment doesn't match are ignored.
   * Defaults to `"pages"`.
   */
  pagesDir?: string;
  /** e.g. `"_api"` will detect pages in `src/pages/_api` and strip `_api` from the path. */
  apiDir?: string;
  /** e.g. `"_slices"` will detect slices in `src/pages/_slices`. */
  slicesDir?: string;
}

const IGNORED_PATH_PARTS = new Set(["_components", "_hooks"]);

/** Ignore paths like `_components` and `_hooks` in pages dir */
const isIgnoredPath = (paths: string[]) => paths.some((p) => IGNORED_PATH_PARTS.has(p));

export function fsRouterFn<C extends ConfigContext>(
  /**
   * A mapping from a file path to a route module, e.g.
   *   {
   *     "./pages/_layout.tsx": () => ({ default: ... }),
   *     "./pages/index.tsx": () => ({ default: ... }),
   *     "./pages/foo/index.tsx": () => ...,
   *   }
   * Intended to be created by Vite's import.meta.glob with the pages
   * directory included in the pattern, e.g.
   *   import.meta.glob("./pages/**\/*.{tsx,ts}")
   */
  modules: { [file: string]: () => Promise<unknown> },
  options: Options = {},
): (this: AppContext<C>, fns: RouteFns) => Awaitable<void> {
  return async function (fns) {
    const { createPage, createLayout, createRoot, createApi, createSlice } = fns;
    const { pagesDir = "pages", apiDir = "_api", slicesDir = "_slices" } = options;

    const pagesDirPrefix = pagesDir + "/";
    for (const file in modules) {
      // Use WHATWG URL encoding for the file path (different from RFC2396-based encoding)
      const srcPath = new URL(file, "http://localhost:3000").pathname.slice(1);
      if (!srcPath.startsWith(pagesDirPrefix)) {
        continue;
      }
      const pathItems = srcPath
        .slice(pagesDirPrefix.length)
        .replace(/\.\w+$/, "")
        .split("/")
        .filter(Boolean);
      if (isIgnoredPath(pathItems)) {
        continue;
      }

      const path =
        "/" +
        (["_layout", "index", "_root"].includes(pathItems.at(-1)!)
          ? pathItems.slice(0, -1)
          : pathItems
        ).join("/");

      const mod = (await modules[file]!()) as {
        default?: FunctionComponent<{ ctx: AppContext<C> }>;
        getConfig?: () => Promise<RouteConfig>;
        GET?: (req: Request, ctx?: unknown) => Promise<Response>;
      };
      const config = await mod.getConfig?.call(this);

      if (pathItems.at(-1) === "[path]") {
        throw new Error(
          "Page file cannot be named [path]. This will conflict with the path prop of the page component.",
        );
      }

      if (pathItems[0] === apiDir) {
        // Strip the apiDir prefix from the path (e.g., _api/hello.txt -> hello.txt)
        const apiPath = "/" + pathItems.slice(1).join("/");
        if (config?.render === "static") {
          if (Object.keys(mod).length !== 2 || !mod.GET) {
            console.warn(
              `API ${path} is invalid. For static API routes, only a single GET handler is supported.`,
            );
          }
          createApi({
            ...config,
            path: apiPath,
            render: "static",
            method: "GET",
            handler: mod.GET!.bind(this),
            unstable_sourceFile: srcPath,
          });
        } else {
          const entries = [];

          for (const [exportName, handler] of Object.entries(mod)) {
            const isValidExport =
              exportName === "getConfig" ||
              exportName === "default" ||
              ValidMethods.has(exportName);

            if (!isValidExport) {
              console.warn(
                `API ${path} has an invalid export: ${exportName}. Valid exports are: ${Methods.join(
                  ", ",
                )}`,
              );
              continue;
            }

            if (exportName === "default") entries.push(["all", handler.bind(this)]);
            else entries.push([exportName, handler.bind(this)]);
          }

          createApi({
            path: apiPath,
            render: "dynamic",
            handlers: Object.fromEntries(entries),
            unstable_sourceFile: srcPath,
          });
        }
        continue;
      }

      const Comp = mod.default!;
      const renderMode = config?.render ?? (this.mode === "default" ? "static" : this.mode);

      if (pathItems[0] === slicesDir) {
        createSlice({
          component: (props: object) => <Comp {...props} ctx={this} />,
          render: renderMode,
          id: pathItems.slice(1).join("/"),
          unstable_sourceFile: srcPath,
        } as never); // FIXME avoid as never
        continue;
      }

      if (pathItems.at(-1) === "_root") {
        createRoot({
          component: (props: object) => <Comp {...props} ctx={this} />,
          render: "static",
          ...config,
          unstable_sourceFile: srcPath,
        } as never);
        continue;
      }

      const routePath = joinPathname("(fs)", path);

      if (pathItems.at(-1) === "_layout") {
        createLayout({
          path: routePath,
          component: (props: object) => <Comp {...props} ctx={this} />,
          render: renderMode,
          unstable_sourceFile: srcPath,
        } as never);
        continue;
      }

      createPage({
        path: routePath,
        component: (props: object) => <Comp {...props} ctx={this} />,
        render: renderMode,
        unstable_sourceFile: srcPath,
      } as never);
    }
  };
}

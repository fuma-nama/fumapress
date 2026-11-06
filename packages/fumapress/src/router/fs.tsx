/**
 * This is a copy of https://github.com/wakujs/waku/blob/main/packages/waku/src/router/fs-router.ts
 */
import type { FC } from "react";
import { unstable_isIgnoredPath as isIgnoredPath } from "waku/minimal/server";
import type { HandlerInterceptor } from "waku/router/server";
import type { Awaitable, Context } from "@fumapress/core";
import type { WakuRouteConfig, WakuRouteFns } from "@/router";
import { joinPaths } from "@/lib/pathname";

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

const SPECIAL_BASENAME = new Set(["_layout", "index", "_root"]);

export function fsRouterFn(
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
): (this: Context, fns: WakuRouteFns) => Awaitable<void> {
  return async function (fns) {
    const { createPage, createLayout, createRoot, createApi, createSlice, createInterceptor } = fns;
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
      if (pathItems[0] === "_interceptors") {
        const mod = (await modules[file]!()) as { default: HandlerInterceptor };
        createInterceptor(mod.default);
        continue;
      }

      const path =
        "/" +
        (SPECIAL_BASENAME.has(pathItems.at(-1)!) ? pathItems.slice(0, -1) : pathItems).join("/");

      const mod = (await modules[file]!()) as {
        default?: FC;
        getConfig?: () => Promise<WakuRouteConfig>;
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
        const renderMode = config?.render ?? "dynamic";

        if (renderMode === "static") {
          if (Object.keys(mod).length !== 2 || !mod.GET) {
            console.warn(
              `API ${path} is invalid. For static API routes, only a single GET handler is supported.`,
            );
          }
          createApi({
            path: apiPath,
            render: renderMode,
            method: "GET",
            staticPaths: config?.staticPaths,
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
            render: renderMode,
            handlers: Object.fromEntries(entries),
            unstable_sourceFile: srcPath,
          });
        }
        continue;
      }

      const component = mod.default!;
      const renderMode = config?.render ?? "static";

      if (pathItems[0] === slicesDir) {
        createSlice({
          component,
          render: renderMode,
          id: pathItems.slice(1).join("/"),
          unstable_sourceFile: srcPath,
        } as never);
        continue;
      }

      if (pathItems.at(-1) === "_root") {
        createRoot({
          component,
          render: renderMode,
          unstable_sourceFile: srcPath,
        } as never);
        continue;
      }

      const { autoI18n = true, ...pageConfig } = config ?? {};
      const langs = this.i18nConfig && autoI18n ? this.i18nConfig.languages : [undefined];

      for (const lang of langs) {
        const route = {
          path: joinPaths("/(fs)", path),
          lang,
          component,
          render: renderMode,
          unstable_sourceFile: srcPath,
        };

        if (pathItems.at(-1) === "_layout") {
          createLayout(route);
        } else {
          createPage({ ...pageConfig, ...route });
        }
      }
    }
  };
}

import type { MiddlewareHandler } from "astro";
import { ctx } from "./context";
import { serve, serveApi, serveFile } from "./shared";

/** where Astro routes the requests of plugins, your own routes go first: `/404` has the files `[...fumapressServer]` doesn't take with `trailingSlash: "always"` */
const pressRoutes = new Set(["/404", "/[...fumapressServer]"]);

/** the `middleware` and the routes of plugins, for requests served on demand */
export const onRequest: MiddlewareHandler = async (context, next) => {
  // like the endpoints of Astro with an extension and the output of builds, files have no `/`; with `trailingSlash: "always"`, `[...fumapressFile]` takes them only with it
  if (import.meta.env.DEV && context.routePattern === "/404") {
    const file = await serveFile(ctx, context.request);
    if (file) return file;
  }
  if (context.isPrerendered) return next();
  // a rewrite is a new request through the middleware of plugins, like on Waku: `next(path)` of Astro skips the middleware, and keeps the rewritten route when its response fails
  const handle = (request: Request): Promise<Response> =>
    ctx.handleRequest(request, async (rewrite) => {
      if (rewrite !== undefined)
        return handle(new Request(new URL(ctx.withBase(rewrite), request.url), request));
      const rewritten = request !== context.request;
      if (rewritten || pressRoutes.has(context.routePattern)) {
        const response = await serveApi(ctx, request);
        if (response) return response;
      }
      if (!rewritten) return next();
      return (await serve(ctx, request))
        ? context.rewrite(request)
        : new Response(null, { status: 404 });
    });
  return handle(context.request);
};

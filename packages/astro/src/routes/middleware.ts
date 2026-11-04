import type { MiddlewareHandler } from "astro";
import { getPressContext } from "../runtime";
import { serve, serverFileUrl } from "./shared";

/** the `middleware` of plugins, for requests served on demand */
export const onRequest: MiddlewareHandler = (context, next) => {
  if (context.isPrerendered) return next();
  const ctx = getPressContext();
  // a rewrite is a new request through the middleware of plugins, like on Waku: `next(path)` of Astro skips the middleware, and keeps the rewritten route when its response fails
  const handle = (request: Request): Promise<Response> =>
    ctx.handleRequest(request, async (rewrite) => {
      if (rewrite !== undefined)
        return handle(new Request(new URL(ctx.withBase(rewrite), request.url), request));
      if (request === context.request) {
        // a file Astro's patterns don't take, it routes the request to the 404 page
        const file =
          context.routePattern === "/404"
            ? await serverFileUrl(ctx, new URL(request.url))
            : undefined;
        return file ? next(file) : next();
      }
      const response = await serve(ctx, request);
      return response instanceof Response ? response : context.rewrite(request);
    });
  return handle(context.request);
};

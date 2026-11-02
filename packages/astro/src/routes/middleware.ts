import type { MiddlewareHandler } from "astro";
import { getPressContext } from "../runtime";
import { serve } from "./shared";

/** the `middleware` of plugins, for requests served on demand */
export const onRequest: MiddlewareHandler = (context, next) => {
  if (context.isPrerendered) return next();
  const ctx = getPressContext();
  // a rewrite is a new request through the middleware of plugins, like on Waku: `next(path)` of Astro skips the middleware, and keeps the rewritten route when its response fails
  const handle = (request: Request): Promise<Response> =>
    ctx.handleRequest(request, async (rewrite) => {
      if (rewrite !== undefined)
        return handle(new Request(new URL(ctx.withBase(rewrite), request.url), request));
      if (request === context.request) return next();
      const response = await serve(ctx, request);
      return response instanceof Response ? response : context.rewrite(request);
    });
  return handle(context.request);
};

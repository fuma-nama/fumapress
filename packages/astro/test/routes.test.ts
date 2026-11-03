import type { APIContext, MiddlewareNext } from "astro";
import { describe, expect, it, vi } from "vitest";
import { createPress, type Context, type Plugin, type PressConfig } from "@fumapress/core";
import { onRequest } from "@/routes/middleware";
import { fileStaticPaths, pageStaticPaths, serve } from "@/routes/shared";

const runtime = vi.hoisted(() => ({ ctx: undefined as Context | undefined }));
vi.mock("@/runtime", () => ({ getPressContext: () => runtime.ctx }));

const docs = { files: [{ type: "page" as const, path: "index.mdx", data: { title: "Home" } }] };

function site(plugin: Plugin, config: Partial<PressConfig> = {}, base = "/") {
  return createPress(
    { content: { docs }, preset: false, plugins: [plugin], ...config },
    { base },
  ) as Promise<Context>;
}

const GET = () => new Response("get");

describe("static routes", () => {
  it("expand the params of their static paths", async () => {
    const ctx = await site({
      routes: () => [
        { path: "/og/[...slugs]", staticPaths: [["a", "b.webp"], ["index.webp"]], GET },
        { path: "/llms.txt", GET },
        { path: "/api/search", render: "dynamic", GET },
      ],
    });
    const paths = await fileStaticPaths(ctx, true);

    expect(paths.map((path) => path.params.fumapressFile)).toEqual([
      "og/a/b.webp",
      "og/index.webp",
      "llms.txt",
    ]);
    expect(paths[0]!.props.params).toEqual({ slugs: ["a", "b.webp"] });
    await expect(fileStaticPaths(ctx, false)).rejects.toThrow(
      'the route "/api/search" renders on request, add an adapter to Astro.',
    );
  });

  it("render the pages and the root redirect", async () => {
    const ctx = await site(
      {},
      { i18n: { languages: ["en", "cn"], defaultLanguage: "en" }, mode: "static" },
    );
    const paths = await pageStaticPaths(ctx);

    expect(paths.map((path) => path.params.fumapressPage)).toEqual(["en", "cn", undefined]);
    expect(paths[2]!.props.redirect).toBe("/en");
    expect(await pageStaticPaths(await site({}, { mode: "dynamic" }))).toEqual([]);

    const guide = { files: [{ type: "page" as const, path: "docs/guide.mdx", data: {} }] };
    const noHome = await site(
      {},
      {
        content: { docs: guide },
        i18n: { languages: ["en"], defaultLanguage: "en" },
        mode: "static",
      },
      "/sub",
    );
    expect((await pageStaticPaths(noHome)).at(-1)!.props.redirect).toBe("/sub/en/docs/guide");
  });
});

describe("server routes", async () => {
  const ctx = await site(
    {
      routes: () => [
        {
          path: "/api/[id]",
          render: "dynamic",
          GET: (_request, { params }) => Response.json(params),
          PUT: () => new Response("put"),
        },
        { path: "/proxy", render: "dynamic", ALL: (request) => new Response(request.method) },
      ],
    },
    {},
    "/sub",
  );
  const request = (path: string, method = "GET") =>
    serve(ctx, new Request(`http://localhost${path}`, { method })) as Promise<Response>;

  it("dispatch by method", async () => {
    expect(await (await request("/sub/api/1")).json()).toEqual({ id: "1" });
    expect(await (await request("/sub/api/1", "PUT")).text()).toBe("put");
    expect(await (await request("/sub/proxy", "POST")).text()).toBe("POST");
  });

  it("answer HEAD with GET, other methods with 405", async () => {
    expect((await request("/sub/api/1", "HEAD")).status).toBe(200);
    const response = await request("/sub/api/1", "DELETE");
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET, PUT");
  });

  it("leave other paths to the 404 page of Astro", async () => {
    for (const path of ["/sub/missing", "/other"]) {
      const response = await request(path);
      expect(response.status).toBe(404);
      expect(response.body).toBeNull();
    }
  });

  it("create the routes of plugins once per content", async () => {
    const routes = vi.fn(() => [{ path: "/api", render: "dynamic" as const, GET }]);
    const once = await site({ routes });
    for (let i = 0; i < 3; i++) await serve(once, new Request("http://localhost/api"));
    expect(routes).toHaveBeenCalledTimes(1);
  });

  it("render pages in dynamic mode", async () => {
    const dynamic = await site(
      {},
      { mode: "dynamic", i18n: { languages: ["en", "cn"], defaultLanguage: "en" } },
      "/sub",
    );
    const page = await serve(dynamic, new Request("http://localhost/sub/cn/"));
    expect(page).toMatchObject({ url: "/cn" });

    const redirect = (await serve(dynamic, new Request("http://localhost/sub"))) as Response;
    expect(redirect.status).toBe(302);
    expect(redirect.headers.get("Location")).toBe("/sub/en");
  });
});

describe("middleware", () => {
  it("skips prerendered routes, and rewrites as new requests with the base path", async () => {
    const middleware = vi.fn<NonNullable<Plugin["middleware"]>>((request, next) =>
      request.url.endsWith("/a") ? next("/b") : next(),
    );
    runtime.ctx = await site(
      {
        middleware,
        routes: () => [
          { path: "/b", render: "dynamic", GET: (request) => new Response(request.url) },
        ],
      },
      {},
      "/sub",
    );
    const next = vi.fn(async () => new Response("next"));
    const call = async (isPrerendered: boolean, path: string) =>
      (await onRequest(
        { isPrerendered, request: new Request(`http://localhost${path}`) } as APIContext,
        next as MiddlewareNext,
      )) as Response;

    await call(true, "/sub/a");
    expect(middleware).not.toHaveBeenCalled();
    expect(await (await call(false, "/sub/a")).text()).toBe("http://localhost/sub/b");
    // the middleware of plugins runs for the rewritten request too
    expect(middleware).toHaveBeenCalledTimes(2);
    expect(next).toHaveBeenCalledTimes(1);
    expect(await (await call(false, "/sub/c")).text()).toBe("next");
    expect(next).toHaveBeenLastCalledWith();
  });

  it("keeps the request when a rewrite fails", async () => {
    runtime.ctx = await site({
      middleware: async (request, next) => {
        if (!request.url.endsWith("/own")) return next();
        const response = await next("/missing");
        return response.ok ? response : next();
      },
    });
    const next = vi.fn(async () => new Response("next"));
    const response = await onRequest(
      { isPrerendered: false, request: new Request("http://localhost/own") } as APIContext,
      next as MiddlewareNext,
    );

    expect(await (response as Response).text()).toBe("next");
    expect(next).toHaveBeenCalledExactlyOnceWith();
  });
});

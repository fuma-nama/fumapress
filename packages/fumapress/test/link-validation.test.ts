import { describe, expect, it } from "vitest";
import type { PressRoute, RouteFns } from "@/lib/types";
import {
  linkValidationPlugin,
  type DiagnosticsFile,
  type LinkValidationOptions,
} from "@/plugins/link-validation";
import { createApp } from "./fixtures";

function route(path: string, render: PressRoute["render"] = "static"): PressRoute {
  return {
    render,
    path,
    component: () => null,
    meta: [],
    pages: render === "static" ? [{ path, params: {}, translations: [] }] : [],
  };
}

/** build a site whose `/docs/basics` page has the Markdown `text` and a `#section`, next to the pages of `routes` */
async function runBuild(options: {
  text: string;
  routes?: PressRoute[];
  plugin?: LinkValidationOptions;
}) {
  const { text, routes = [], plugin } = options;
  const emitted = new Map<string, string>();
  const ctx = await createApp({
    plugins: [linkValidationPlugin(plugin)],
    adapters: [
      {
        "core:get-text": (page) => (page.url === "/docs/basics" ? text : undefined),
        "core:render-toc": () => [{ title: "Section", url: "#section", depth: 2 }],
      },
    ],
  });
  for (const item of ctx.plugins) {
    await item.configureRoutes?.call(ctx, { getRoutes: () => routes } as unknown as RouteFns);
  }

  const build = () =>
    ctx.build({
      async emitFile(path, content) {
        emitted.set(
          path,
          typeof content === "string" ? content : new TextDecoder().decode(content),
        );
      },
    });

  return { build, emitted };
}

function diagnostics(emitted: Map<string, string>, path = "fumapress-diagnostics.json") {
  return (JSON.parse(emitted.get(path)!) as DiagnosticsFile).diagnostics;
}

describe("report: throw (default)", () => {
  it("fails the build and names the broken link", async () => {
    const { build } = await runBuild({ text: "[missing](/missing)" });

    await expect(build()).rejects.toThrow('In "/docs/basics": link "/missing" not-found');
  });

  it("does not write a diagnostics file", async () => {
    const { build, emitted } = await runBuild({ text: "[home](/)" });

    await build();

    expect(emitted.size).toBe(0);
  });
});

describe("report: json", () => {
  it("writes diagnostics without failing the build", async () => {
    const { build, emitted } = await runBuild({
      text: "[missing](/missing)",
      plugin: { report: "json" },
    });

    await expect(build()).resolves.not.toThrow();
    expect(diagnostics(emitted)).toEqual([
      {
        severity: "error",
        rule: "link-validation/not-found",
        message: 'link "/missing" not-found',
        fromPathname: "/docs/basics",
        href: "/missing",
      },
    ]);
  });

  it("emits an empty list when everything resolves, so a clean run is distinguishable from no run", async () => {
    const { build, emitted } = await runBuild({ text: "[home](/)", plugin: { report: "json" } });

    await build();

    expect(diagnostics(emitted)).toEqual([]);
  });

  it("honours a custom diagnostics path", async () => {
    const { build, emitted } = await runBuild({
      text: "",
      plugin: { report: "json", diagnosticsPath: "checks/links.json" },
    });

    await build();

    expect(emitted.has("checks/links.json")).toBe(true);
  });
});

describe("report: both", () => {
  it("writes diagnostics and then fails the build", async () => {
    const { build, emitted } = await runBuild({
      text: "[missing](/missing)",
      plugin: { report: "both" },
    });

    await expect(build()).rejects.toThrow("not-found");
    expect(diagnostics(emitted)).toHaveLength(1);
  });

  it("succeeds when no link is broken", async () => {
    const { build, emitted } = await runBuild({ text: "[home](/)", plugin: { report: "both" } });

    await expect(build()).resolves.not.toThrow();
    expect(emitted.has("fumapress-diagnostics.json")).toBe(true);
  });
});

describe("link filtering", () => {
  it("skips ignored, anchor and mailto links", async () => {
    const { build, emitted } = await runBuild({
      text: "[a](#section) [b](mailto:hi@example.com) [c](/skip-me)",
      plugin: { report: "json", ignored: (href) => href === "/skip-me" },
    });

    await build();

    expect(diagnostics(emitted)).toEqual([]);
  });

  it("reports external links through the externalLink hook", async () => {
    const { build, emitted } = await runBuild({
      text: "[gone](https://example.com/gone)",
      plugin: { report: "json", externalLink: () => "not-found" },
    });

    await build();

    expect(diagnostics(emitted)).toHaveLength(1);
    expect(diagnostics(emitted)[0]?.href).toBe("https://example.com/gone");
  });

  it("counts the pages of createPage()", async () => {
    const { build, emitted } = await runBuild({
      text: "[about](/about/) [post](/posts/hello) [tag](/tags/react) [missing](/posts)",
      routes: [
        route("/about"),
        route("/posts/[slug]", "dynamic"),
        route("/tags/[...tags]", "dynamic"),
      ],
      plugin: { report: "json" },
    });

    await build();

    expect(diagnostics(emitted).map((item) => item.href)).toEqual(["/posts"]);
  });
});

import { afterEach, describe, expect, it } from "vitest";
import {
  linkValidationPlugin,
  type DiagnosticsFile,
  type LinkValidationOptions,
} from "@/plugins/link-validation";

type ServerEntry = Parameters<
  NonNullable<ReturnType<typeof linkValidationPlugin>["unstable_onServerEntry"]>
>[0];
type BuildUtils = Parameters<ServerEntry["build"]>[0];

/**
 * Run a build in which the pre-rendered pages contain `links`. Pathnames listed
 * in `missing` respond 404, standing in for pages that were never generated.
 */
async function runBuild(options: {
  links: { href: string; fromPathname: string }[];
  missing?: string[];
  plugin?: LinkValidationOptions;
}) {
  const { links, missing = [], plugin: pluginOptions } = options;
  const emitted = new Map<string, string>();

  const entry = {
    fetch(req: Request) {
      const { pathname } = new URL(req.url);
      return new Response(null, { status: missing.includes(pathname) ? 404 : 200 });
    },
    async build() {
      // the real build collects links while pre-rendering each page
      global.LINK_SSG_CONTEXT!.links.push(...links);
    },
  } as unknown as ServerEntry;

  const utils = {
    async emitFile(path: string, body: ReadableStream) {
      emitted.set(path, await new Response(body).text());
    },
    unstable_registerPrunableFile: () => undefined,
  } as unknown as BuildUtils;

  const patched = linkValidationPlugin(pluginOptions).unstable_onServerEntry!(entry);
  const build = () => patched.build(utils);

  return { build, emitted };
}

afterEach(() => {
  global.LINK_SSG_CONTEXT = undefined;
});

describe("report: throw (default)", () => {
  it("fails the build and names the broken link", async () => {
    const { build } = await runBuild({
      links: [{ href: "/missing", fromPathname: "/docs" }],
      missing: ["/missing"],
    });

    await expect(build()).rejects.toThrow('In "/docs": link "/missing" not-found');
  });

  it("does not write a diagnostics file", async () => {
    const { build, emitted } = await runBuild({
      links: [{ href: "/ok", fromPathname: "/docs" }],
    });

    await build();

    expect(emitted.size).toBe(0);
  });
});

describe("report: json", () => {
  it("writes diagnostics without failing the build", async () => {
    const { build, emitted } = await runBuild({
      links: [{ href: "/missing", fromPathname: "/docs" }],
      missing: ["/missing"],
      plugin: { report: "json" },
    });

    await expect(build()).resolves.not.toThrow();

    const file: DiagnosticsFile = JSON.parse(emitted.get("fumapress-diagnostics.json")!);
    expect(file.diagnostics).toEqual([
      {
        severity: "error",
        rule: "link-validation/not-found",
        message: 'link "/missing" not-found',
        fromPathname: "/docs",
        href: "/missing",
      },
    ]);
  });

  it("emits an empty list when everything resolves, so a clean run is distinguishable from no run", async () => {
    const { build, emitted } = await runBuild({
      links: [{ href: "/ok", fromPathname: "/docs" }],
      plugin: { report: "json" },
    });

    await build();

    const file: DiagnosticsFile = JSON.parse(emitted.get("fumapress-diagnostics.json")!);
    expect(file.diagnostics).toEqual([]);
  });

  it("honours a custom diagnostics path", async () => {
    const { build, emitted } = await runBuild({
      links: [],
      plugin: { report: "json", diagnosticsPath: "checks/links.json" },
    });

    await build();

    expect(emitted.has("checks/links.json")).toBe(true);
  });
});

describe("report: both", () => {
  it("writes diagnostics and then fails the build", async () => {
    const { build, emitted } = await runBuild({
      links: [{ href: "/missing", fromPathname: "/docs" }],
      missing: ["/missing"],
      plugin: { report: "both" },
    });

    await expect(build()).rejects.toThrow("not-found");

    const file: DiagnosticsFile = JSON.parse(emitted.get("fumapress-diagnostics.json")!);
    expect(file.diagnostics).toHaveLength(1);
  });

  it("succeeds when no link is broken", async () => {
    const { build, emitted } = await runBuild({
      links: [{ href: "/ok", fromPathname: "/docs" }],
      plugin: { report: "both" },
    });

    await expect(build()).resolves.not.toThrow();
    expect(emitted.has("fumapress-diagnostics.json")).toBe(true);
  });
});

describe("link filtering", () => {
  it("skips ignored, anchor and mailto links", async () => {
    const { build, emitted } = await runBuild({
      links: [
        { href: "#section", fromPathname: "/docs" },
        { href: "mailto:hi@example.com", fromPathname: "/docs" },
        { href: "/skip-me", fromPathname: "/docs" },
      ],
      missing: ["/skip-me"],
      plugin: { report: "json", ignored: (href) => href === "/skip-me" },
    });

    await build();

    const file: DiagnosticsFile = JSON.parse(emitted.get("fumapress-diagnostics.json")!);
    expect(file.diagnostics).toEqual([]);
  });

  it("reports external links through the externalLink hook", async () => {
    const { build, emitted } = await runBuild({
      links: [{ href: "https://example.com/gone", fromPathname: "/docs" }],
      plugin: { report: "json", externalLink: () => "not-found" },
    });

    await build();

    const file: DiagnosticsFile = JSON.parse(emitted.get("fumapress-diagnostics.json")!);
    expect(file.diagnostics).toHaveLength(1);
    expect(file.diagnostics[0]?.href).toBe("https://example.com/gone");
  });
});

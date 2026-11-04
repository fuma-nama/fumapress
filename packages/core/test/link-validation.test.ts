import { describe, expect, it } from "vitest";
import { pressContext } from "./harness";
import type { PressBuildOutput } from "@/plugin";
import {
  linkValidationPlugin,
  type DiagnosticsFile,
  type LinkValidationOptions,
} from "@/plugins/link-validation";

/** Build a site whose prerendered pages rendered `links`, pathnames in `missing` respond 404 */
async function runBuild(options: {
  links: PressBuildOutput["links"];
  missing?: string[];
  plugin?: LinkValidationOptions;
}) {
  const { links, missing = [], plugin } = options;
  const emitted = new Map<string, string | Uint8Array>();
  const ctx = await pressContext(
    { content: { files: [] }, preset: [], plugins: [linkValidationPlugin(plugin)] },
    { base: "/" },
  );
  const build = () =>
    ctx.build({
      links,
      fetch(request) {
        const { pathname } = new URL(request.url);
        return new Response(null, { status: missing.includes(pathname) ? 404 : 200 });
      },
      async emitFile(path, content) {
        emitted.set(path, content);
      },
    });

  return { build, emitted };
}

function diagnostics(
  emitted: Map<string, string | Uint8Array>,
  path = "fumapress-diagnostics.json",
) {
  return (JSON.parse(emitted.get(path) as string) as DiagnosticsFile).diagnostics;
}

describe("report: throw (default)", () => {
  it("fails the build and names the broken link", async () => {
    const { build } = await runBuild({
      links: [{ href: "/missing", fromPathname: "/docs" }],
      missing: ["/missing"],
    });

    await expect(build()).rejects.toThrow('\nIn "/docs": link "/missing" not-found');
  });

  it("does not write a diagnostics file", async () => {
    const { build, emitted } = await runBuild({ links: [{ href: "/ok", fromPathname: "/docs" }] });

    await build();

    expect(emitted.size).toBe(0);
  });
});

describe("report: json", () => {
  it("writes pretty diagnostics without failing the build", async () => {
    const { build, emitted } = await runBuild({
      links: [
        { href: "/missing", fromPathname: "/docs" },
        { href: "/missing", fromPathname: "/blog" },
      ],
      missing: ["/missing"],
      plugin: { report: "json" },
    });

    await expect(build()).resolves.not.toThrow();
    const file: DiagnosticsFile = {
      diagnostics: [
        {
          severity: "error",
          rule: "link-validation/not-found",
          message: 'link "/missing" not-found',
          fromPathname: "/docs",
          href: "/missing",
        },
        {
          severity: "error",
          rule: "link-validation/not-found",
          message: 'link "/missing" not-found',
          fromPathname: "/blog",
          href: "/missing",
        },
      ],
    };
    expect(emitted.get("fumapress-diagnostics.json")).toBe(JSON.stringify(file, null, 2));
  });

  it("emits an empty list when everything resolves, so a clean run is distinguishable from no run", async () => {
    const { build, emitted } = await runBuild({
      links: [{ href: "/ok", fromPathname: "/docs" }],
      plugin: { report: "json" },
    });

    await build();

    expect(diagnostics(emitted)).toEqual([]);
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
    expect(diagnostics(emitted)).toHaveLength(1);
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
      missing: ["/skip-me", "/"],
      plugin: { report: "json", ignored: (href) => href === "/skip-me" },
    });

    await build();

    expect(diagnostics(emitted)).toEqual([]);
  });

  it("reports external links through the externalLink hook", async () => {
    const { build, emitted } = await runBuild({
      links: [{ href: "https://example.com/gone", fromPathname: "/docs" }],
      plugin: { report: "json", externalLink: () => "not-found" },
    });

    await build();

    expect(diagnostics(emitted)).toHaveLength(1);
    expect(diagnostics(emitted)[0]?.href).toBe("https://example.com/gone");
  });
});

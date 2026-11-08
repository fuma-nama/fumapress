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
    { content: { files: [] }, plugins: [linkValidationPlugin(plugin)] },
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

const ok = [{ href: "/ok", fromPathname: "/docs" }];
const broken = { links: [{ href: "/missing", fromPathname: "/docs" }], missing: ["/missing"] };

describe("report", () => {
  it("fails the build and names the broken link by default", async () => {
    const { build } = await runBuild(broken);

    await expect(build()).rejects.toThrow('\nIn "/docs": link "/missing" not-found');
  });

  it("reports a link rendered more than once on a page once", async () => {
    const [link] = broken.links;
    const { build, emitted } = await runBuild({
      ...broken,
      links: [link!, link!, { ...link!, fromPathname: "/other" }],
      plugin: { report: "json" },
    });
    await build();

    expect(diagnostics(emitted).map((item) => item.fromPathname)).toEqual(["/docs", "/other"]);
  });

  it('writes pretty diagnostics without failing the build on "json"', async () => {
    const { build, emitted } = await runBuild({
      links: [...broken.links, { href: "/missing", fromPathname: "/blog" }],
      missing: broken.missing,
      plugin: { report: "json" },
    });

    await expect(build()).resolves.not.toThrow();
    const diagnostic = (fromPathname: string): DiagnosticsFile["diagnostics"][number] => ({
      severity: "error",
      rule: "link-validation/not-found",
      message: 'link "/missing" not-found',
      fromPathname,
      href: "/missing",
    });
    const file: DiagnosticsFile = { diagnostics: [diagnostic("/docs"), diagnostic("/blog")] };
    expect(emitted.get("fumapress-diagnostics.json")).toBe(JSON.stringify(file, null, 2));
  });

  // an empty list makes a clean run distinguishable from no run
  it.each(["json", "both"] as const)(
    'emits an empty list when everything resolves on "%s"',
    async (report) => {
      const { build, emitted } = await runBuild({ links: ok, plugin: { report } });

      await expect(build()).resolves.not.toThrow();
      expect(diagnostics(emitted)).toEqual([]);
    },
  );

  it('writes diagnostics and then fails the build on "both"', async () => {
    const { build, emitted } = await runBuild({ ...broken, plugin: { report: "both" } });

    await expect(build()).rejects.toThrow("not-found");
    expect(diagnostics(emitted)).toHaveLength(1);
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

import { describe, expect, it, vi } from "vitest";
import { defineConfig, type ConfigUtils } from "@/config";
import { Link } from "@/components/link";
import { linkValidationPlugin, type DiagnosticsFile } from "@/plugins/link-validation";
import { createRouter } from "@/router";

vi.mock("waku", () => ({}));
vi.mock("waku/router/server", () => ({}));
vi.mock("waku/router/client", () => ({
  Link: () => null,
  useRouter: () => ({ path: "/docs" }),
}));

/** build a site whose prerendered pages render a `<Link />` to each of `hrefs`, `/missing` responds 404 */
async function runBuild(cfg: ReturnType<typeof config>, hrefs: string[]) {
  const emitted = new Map<string, string>();
  let collecting = false;
  const createEntry = (await createRouter(cfg as ConfigUtils)).patchAdapter((() => ({
    fetch: (request: Request) =>
      new Response(null, { status: new URL(request.url).pathname === "/missing" ? 404 : 200 }),
    async build() {
      collecting = globalThis.LINK_SSG_CONTEXT !== undefined;
      for (const href of hrefs) Link({ href });
    },
  })) as never);

  await createEntry({} as never).build({
    async emitFile(path, body) {
      emitted.set(path, await new Response(body).text());
    },
    unstable_registerPrunableFile() {},
  });
  return { emitted, collecting };
}

function config() {
  return defineConfig({
    preset: false,
    site: { baseUrl: "https://example.com" },
    content: { files: [] },
    renderPage: () => null,
    renderRoot: () => null,
    renderNotFound: () => null,
  });
}

describe("link validation", () => {
  it("validates the links rendered while prerendering", async () => {
    const { emitted } = await runBuild(config().plugins(linkValidationPlugin({ report: "json" })), [
      "/missing",
      "/docs",
    ]);
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
    expect(globalThis.LINK_SSG_CONTEXT).toBeUndefined();
  });

  it("collects no links without a build hook", async () => {
    await expect(runBuild(config(), ["/missing"])).resolves.toMatchObject({ collecting: false });
  });
});

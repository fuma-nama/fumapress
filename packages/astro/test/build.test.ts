import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPress, type Context } from "@fumapress/core";
import { createBuildOutput } from "@/build";

describe("build output", async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "fumapress-astro-build-"));
  const dir = path.join(temp, "dist");
  const ctx = (await createPress(
    {
      content: {},
      preset: false,
      plugins: [
        {
          routes: () => [
            { path: "/api/[id]", render: "dynamic", GET: () => Response.json({}) },
            { path: "/live/[id]", render: "dynamic", view: () => ({ node: "live" }) },
          ],
        },
      ],
    },
    { base: "/sub" },
  )) as Context;
  const output = createBuildOutput(ctx, [], { dir, outDir: temp, routes: [/^\/user\/?$/] });
  const status = async (pathname: string) =>
    (await output.fetch(new Request(`http://localhost${pathname}`))).status;

  beforeAll(async () => {
    await fs.mkdir(path.join(dir, "docs"), { recursive: true });
    await fs.writeFile(path.join(dir, "docs/index.html"), "<p>docs</p>");
    await fs.writeFile(path.join(dir, "page.html"), "<p>page</p>");
    await fs.writeFile(path.join(dir, "file one.txt"), "file");
  });
  afterAll(() => fs.rm(temp, { recursive: true, force: true }));

  it("fetches the built files without the base path", async () => {
    const response = await output.fetch(new Request("http://localhost/sub/docs"));
    expect(await response.text()).toBe("<p>docs</p>");
    expect(await status("/sub/docs/")).toBe(200);
    expect(await status("/sub/page")).toBe(200);
    expect(await status("/sub/file%20one.txt")).toBe(200);
  });

  it("answers the routes rendered on request", async () => {
    expect(await status("/sub/api/1")).toBe(200);
    expect(await status("/sub/live/1")).toBe(200);
    expect(await status("/sub/user")).toBe(200);
  });

  it("answers 404 for the others", async () => {
    expect(await status("/sub/missing")).toBe(404);
    expect(await status("/docs")).toBe(404);
  });

  it("emits files to the output directory", async () => {
    await output.emitFile("reports/diagnostics.json", "{}");
    expect(await fs.readFile(path.join(temp, "reports/diagnostics.json"), "utf8")).toBe("{}");
  });
});

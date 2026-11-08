import { describe, expect, it } from "vitest";
import { pressContext, type TestSite } from "./harness";
import { robotsPlugin, type RobotsOptions } from "@/plugins/robots";

const content: TestSite["content"] = { files: [] };

async function generate(options?: RobotsOptions) {
  const ctx = await pressContext(
    {
      content,
      site: { baseUrl: "https://example.com/repo" },
      plugins: [robotsPlugin(options)],
    },
    { base: "/repo/" },
  );
  const route = (await ctx.getApiRoutes()).find(
    (item) => item.path === (options?.path ?? "/robots.txt"),
  );
  const res = await route!.GET!(new Request("https://example.com/repo/robots.txt"), { params: {} });

  expect(res.headers.get("Content-Type")).toBe("text/plain");
  return res.text();
}

describe("robotsPlugin", () => {
  it("allows every crawler and references `/sitemap.xml`", async () => {
    await expect(generate({})).resolves.toBe(
      "User-agent: *\nAllow: /\n\nSitemap: https://example.com/repo/sitemap.xml",
    );
  });

  it("renders rules and the sitemap option", async () => {
    const rules: RobotsOptions["rules"] = [
      { userAgent: ["GPTBot", "CCBot"], disallow: "/" },
      { allow: ["/docs", "/blog"], disallow: "/api", crawlDelay: 2 },
    ];

    await expect(
      generate({
        path: "/robots-file.txt",
        rules,
        sitemap: "/sitemap-0.xml",
        additionalContent: "# end",
      }),
    ).resolves.toBe(
      [
        "User-agent: GPTBot\nUser-agent: CCBot\nDisallow: /",
        "User-agent: *\nAllow: /docs\nAllow: /blog\nDisallow: /api\nCrawl-delay: 2",
        "Sitemap: https://example.com/repo/sitemap-0.xml",
        "# end",
      ].join("\n\n"),
    );
    await expect(generate({ sitemap: "https://cdn.example.com/sitemap.xml" })).resolves.toContain(
      "Sitemap: https://cdn.example.com/sitemap.xml",
    );
    await expect(generate({ sitemap: false })).resolves.not.toContain("Sitemap");
  });
});

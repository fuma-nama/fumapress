import { describe, expect, it } from "vitest";
import type { PageRouteInput } from "@/routes";
import { i18n, page, pressContext, type TestSite } from "./harness";
import {
  buildSitemap,
  sitemapPlugin,
  type SitemapUrl,
  type SitemapOptions,
} from "@/plugins/sitemap";

const route = (path: string, lang?: string): PageRouteInput => ({ path, lang, render: "static" });

/** `docs/basics` is translated, `docs/only-en` falls back to English in `cn` */
const content: TestSite["content"] = {
  files: [page("docs/basics.mdx"), page("docs/basics.cn.mdx"), page("docs/only-en.mdx")],
};

async function generate(
  config: Partial<TestSite> = {},
  options?: SitemapOptions,
  frameworkRoutes: PageRouteInput[] = [],
) {
  const ctx = await pressContext(
    {
      content,
      site: { baseUrl: "https://example.com/repo" },
      ...config,
      plugins: [
        {
          getPageLastModified: (page) =>
            page.locale === "cn" ? undefined : new Date("2026-01-01"),
        },
        sitemapPlugin(options),
      ],
    },
    { base: "/repo/", routes: frameworkRoutes },
  );
  const [route] = await ctx.getApiRoutes();

  expect(route!.path).toBe("/sitemap.xml");
  const res = await route!.GET!(new Request("https://example.com/repo/sitemap.xml"), {
    params: {},
  });
  expect(res.headers.get("Content-Type")).toBe("application/xml");
  return res.text();
}

describe("sitemapPlugin", () => {
  it.each<[string, TestSite["content"], string]>([
    ["static content", content, "static"],
    ["a dynamic source", { files: () => [page("docs/basics.mdx")] }, "dynamic"],
  ])("renders like the content: %s", async (_, siteContent, render) => {
    const ctx = await pressContext({ content: siteContent, plugins: [sitemapPlugin()] });

    expect(await ctx.getApiRoutes()).toMatchObject([{ path: "/sitemap.xml", render }]);
  });

  it("leaves out the not found pages", async () => {
    const xml = await generate({ i18n }, undefined, [
      route("/404", "en"),
      route("/404", "cn"),
      route("/404/help", "en"),
    ]);

    expect(xml).not.toContain("/404<");
    expect(xml).toContain("<loc>https://example.com/repo/en/404/help</loc>");
  });

  it("lists pages with their translations and last modified dates, without fallback pages", async () => {
    const xml = await generate({
      i18n,
      site: { baseUrl: "https://example.com/repo", hreflang: { cn: "zh-Hans" } },
    });
    const alternates =
      '<xhtml:link rel="alternate" hreflang="en" href="https://example.com/repo/en/docs/basics"/>' +
      '<xhtml:link rel="alternate" hreflang="zh-Hans" href="https://example.com/repo/cn/docs/basics"/>';

    expect(xml).toContain(
      "<url><loc>https://example.com/repo/en/docs/basics</loc><lastmod>2026-01-01T00:00:00.000Z</lastmod><priority>0.8</priority>" +
        alternates +
        "</url>",
    );
    expect(xml).toContain(
      `<url><loc>https://example.com/repo/cn/docs/basics</loc><priority>0.8</priority>${alternates}</url>`,
    );
    expect(xml).toContain("<loc>https://example.com/repo/en/docs/only-en</loc>");
    expect(xml).not.toContain("/cn/docs/only-en");
  });

  it("customizes entries and adds others", async () => {
    const xml = await generate(
      { i18n },
      {
        getEntry(page) {
          if (page.url !== "/en/docs/only-en") return { loc: this.absoluteUrl(page.url) };
        },
        additionalEntries() {
          return [{ loc: this.absoluteUrl("/blog"), changefreq: "weekly" }];
        },
      },
    );

    expect(xml).toContain(
      "<url><loc>https://example.com/repo/en/docs/basics</loc></url>" +
        "<url><loc>https://example.com/repo/cn/docs/basics</loc></url>" +
        "<url><loc>https://example.com/repo/blog</loc><changefreq>weekly</changefreq></url>",
    );
    expect(xml).not.toContain("only-en");
  });

  it("lists the pages of the framework after content pages, without the URLs of content pages", async () => {
    const alternates =
      '<xhtml:link rel="alternate" hreflang="en" href="https://example.com/repo/en/blog"/>' +
      '<xhtml:link rel="alternate" hreflang="zh-Hans" href="https://example.com/repo/cn/blog"/>';
    const xml = await generate(
      { i18n, site: { baseUrl: "https://example.com/repo", hreflang: { cn: "zh-Hans" } } },
      {
        getEntry(page) {
          if (page.url !== "/cn/docs/basics") return { loc: this.absoluteUrl(page.url) };
          return { loc: this.absoluteUrl("/custom") };
        },
        additionalEntries: [{ loc: "https://example.com/repo/extra" }],
      },
      [
        // the URLs of a fallback page, of a custom `loc` and of a content page stay out
        route("/docs/only-en", "cn"),
        route("/custom"),
        route("/docs/basics", "en"),
        route("/about"),
        route("/blog", "en"),
        route("/blog", "cn"),
      ],
    );

    expect(xml).toContain(
      "<url><loc>https://example.com/repo/en/docs/basics</loc></url>" +
        "<url><loc>https://example.com/repo/en/docs/only-en</loc></url>" +
        "<url><loc>https://example.com/repo/custom</loc></url>" +
        "<url><loc>https://example.com/repo/about</loc><priority>1</priority></url>" +
        `<url><loc>https://example.com/repo/en/blog</loc><priority>1</priority>${alternates}</url>` +
        `<url><loc>https://example.com/repo/cn/blog</loc><priority>1</priority>${alternates}</url>` +
        "<url><loc>https://example.com/repo/extra</loc></url>",
    );
    expect(xml).not.toContain("/cn/docs/only-en");
  });

  it("leaves out or customizes pages of the framework by their page data", async () => {
    const xml = await generate({}, undefined, [
      { ...route("/preview"), data: { sitemap: false } },
      { ...route("/draft"), data: { noindex: true } },
      { ...route("/changelog"), data: { sitemap: { changefreq: "daily", priority: 0.6 } } },
      route("/about"),
    ]);

    expect(xml).not.toContain("/preview");
    expect(xml).not.toContain("/draft");
    expect(xml).toContain(
      "<url><loc>https://example.com/repo/changelog</loc><changefreq>daily</changefreq><priority>0.6</priority></url>" +
        "<url><loc>https://example.com/repo/about</loc><priority>1</priority></url>",
    );
  });
});

describe("buildSitemap", () => {
  const video = {
    thumbnail_loc: "https://example.com/thumb.jpg",
    title: "Intro",
    description: "A quick tour.",
    player_loc: { loc: "https://example.com/player" },
    uploader: { name: "Fuma" },
  };
  const loc = "https://example.com/docs";

  it.each<[string, SitemapUrl, string[]]>([
    [
      "standard fields",
      { loc, lastmod: "2026-01-01", changefreq: "weekly", priority: 0.8 },
      [
        "<url><loc>https://example.com/docs</loc><lastmod>2026-01-01T00:00:00.000Z</lastmod>" +
          "<changefreq>weekly</changefreq><priority>0.8</priority></url>",
      ],
    ],
    [
      "URLs in text and attributes, escaped",
      {
        loc: "https://example.com/a&b",
        alternates: [{ hreflang: "cn", href: "https://example.com/cn/a&b" }],
      },
      [
        "<url><loc>https://example.com/a&amp;b</loc>" +
          '<xhtml:link rel="alternate" hreflang="cn" href="https://example.com/cn/a&amp;b"/></url>',
      ],
    ],
    [
      "images",
      { loc, images: [{ loc: "https://example.com/hero.png", title: "Hero" }] },
      [
        "<image:image><image:loc>https://example.com/hero.png</image:loc><image:title>Hero</image:title></image:image>",
      ],
    ],
    [
      "video attributes, booleans and tags",
      {
        loc,
        videos: [
          {
            ...video,
            player_loc: { loc: "https://example.com/player", allow_embed: true },
            duration: 120,
            expiration_date: new Date("2027-01-01"),
            rating: 4.5,
            view_count: 1000,
            publication_date: new Date("2026-01-01"),
            family_friendly: true,
            tag: ["docs", "react"],
            restriction: { relationship: "allow", countries: ["US", "CA"] },
            platform: { relationship: "deny", platforms: ["tv"] },
            price: { value: 1.99, currency: "EUR", type: "rent" },
            requires_subscription: false,
            uploader: { name: "Fuma", info: "https://example.com/fuma?a=1&b=2" },
            live: false,
          },
        ],
      },
      [
        '<video:player_loc allow_embed="yes">https://example.com/player</video:player_loc>',
        "<video:duration>120</video:duration>",
        "<video:expiration_date>2027-01-01T00:00:00.000Z</video:expiration_date>",
        "<video:rating>4.5</video:rating>",
        "<video:view_count>1000</video:view_count>",
        "<video:family_friendly>yes</video:family_friendly>",
        '<video:restriction relationship="allow">US CA</video:restriction>',
        '<video:platform relationship="deny">tv</video:platform>',
        '<video:price currency="EUR" type="rent">1.99</video:price>',
        "<video:requires_subscription>no</video:requires_subscription>",
        '<video:uploader info="https://example.com/fuma?a=1&amp;b=2">Fuma</video:uploader>',
        "<video:live>no</video:live>",
        "<video:tag>docs</video:tag><video:tag>react</video:tag>",
      ],
    ],
    [
      "news",
      {
        loc,
        news: {
          publication: { name: "The Example Times", language: "en" },
          publication_date: new Date("2026-08-29"),
          title: "Companies A, B in Merger Talks",
        },
      },
      [
        "<news:news>" +
          "<news:publication>" +
          "<news:name>The Example Times</news:name>" +
          "<news:language>en</news:language>" +
          "</news:publication>" +
          "<news:publication_date>2026-08-29T00:00:00.000Z</news:publication_date>" +
          "<news:title>Companies A, B in Merger Talks</news:title>" +
          "</news:news>",
      ],
    ],
    [
      "the extension namespaces",
      { loc },
      [
        'xmlns:xhtml="http://www.w3.org/1999/xhtml"',
        'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"',
        'xmlns:video="http://www.google.com/schemas/sitemap-video/1.1"',
        'xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"',
      ],
    ],
  ])("serializes %s", (_, entry, expected) => {
    const xml = buildSitemap([entry]);

    for (const fragment of expected) expect(xml).toContain(fragment);
  });
});

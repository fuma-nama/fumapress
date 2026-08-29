import { describe, expect, it } from "vitest";
import { buildSitemap } from "@/plugins/sitemap";

describe("buildSitemap", () => {
  it("serializes standard fields", () => {
    const xml = buildSitemap([
      {
        loc: "https://example.com/docs",
        lastmod: new Date("2026-01-01"),
        changefreq: "weekly",
        priority: 0.8,
      },
    ]);

    expect(xml).toContain("<loc>https://example.com/docs</loc>");
    expect(xml).toContain("<lastmod>2026-01-01T00:00:00.000Z</lastmod>");
    expect(xml).toContain("<changefreq>weekly</changefreq>");
    expect(xml).toContain("<priority>0.8</priority>");
  });

  it("declares the extension namespaces", () => {
    const xml = buildSitemap([]);

    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
    expect(xml).toContain('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"');
    expect(xml).toContain('xmlns:video="http://www.google.com/schemas/sitemap-video/1.1"');
    expect(xml).toContain('xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"');
  });

  it("serializes alternates and images", () => {
    const xml = buildSitemap([
      {
        loc: "https://example.com/en/docs",
        alternates: [{ rel: "alternate", hreflang: "cn", href: "https://example.com/cn/docs" }],
        images: [{ loc: "https://example.com/hero.png", title: "Hero" }],
      },
    ]);

    expect(xml).toContain(
      '<xhtml:link rel="alternate" hreflang="cn" href="https://example.com/cn/docs"/>',
    );
    expect(xml).toContain(
      "<image:image><image:loc>https://example.com/hero.png</image:loc><image:title>Hero</image:title></image:image>",
    );
  });

  it("serializes a minimal video", () => {
    const xml = buildSitemap([
      {
        loc: "https://example.com/videos/intro",
        videos: [
          {
            thumbnail_loc: "https://example.com/thumbs/intro.jpg",
            title: "Intro",
            description: "A quick tour.",
            content_loc: "https://example.com/videos/intro.mp4",
          },
        ],
      },
    ]);

    expect(xml).toContain(
      "<video:video>" +
        "<video:thumbnail_loc>https://example.com/thumbs/intro.jpg</video:thumbnail_loc>" +
        "<video:title>Intro</video:title>" +
        "<video:description>A quick tour.</video:description>" +
        "<video:content_loc>https://example.com/videos/intro.mp4</video:content_loc>" +
        "</video:video>",
    );
  });

  it("serializes video attributes, booleans, and tags", () => {
    const xml = buildSitemap([
      {
        loc: "https://example.com/videos/full",
        videos: [
          {
            thumbnail_loc: "https://example.com/thumb.jpg",
            title: "Full",
            description: "Every field.",
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
            uploader: { name: "Fuma", info: "https://example.com/fuma" },
            live: false,
          },
        ],
      },
    ]);

    expect(xml).toContain(
      '<video:player_loc allow_embed="yes">https://example.com/player</video:player_loc>',
    );
    expect(xml).toContain("<video:duration>120</video:duration>");
    expect(xml).toContain(
      "<video:expiration_date>2027-01-01T00:00:00.000Z</video:expiration_date>",
    );
    expect(xml).toContain("<video:rating>4.5</video:rating>");
    expect(xml).toContain("<video:view_count>1000</video:view_count>");
    expect(xml).toContain("<video:family_friendly>yes</video:family_friendly>");
    expect(xml).toContain('<video:restriction relationship="allow">US CA</video:restriction>');
    expect(xml).toContain('<video:platform relationship="deny">tv</video:platform>');
    expect(xml).toContain('<video:price currency="EUR" type="rent">1.99</video:price>');
    expect(xml).toContain("<video:requires_subscription>no</video:requires_subscription>");
    expect(xml).toContain('<video:uploader info="https://example.com/fuma">Fuma</video:uploader>');
    expect(xml).toContain("<video:live>no</video:live>");
    expect(xml).toContain("<video:tag>docs</video:tag><video:tag>react</video:tag>");
  });

  it("serializes news", () => {
    const xml = buildSitemap([
      {
        loc: "https://example.com/news/merger",
        news: {
          publication: { name: "The Example Times", language: "en" },
          publication_date: new Date("2026-08-29"),
          title: "Companies A, B in Merger Talks",
        },
      },
    ]);

    expect(xml).toContain(
      "<news:news>" +
        "<news:publication>" +
        "<news:name>The Example Times</news:name>" +
        "<news:language>en</news:language>" +
        "</news:publication>" +
        "<news:publication_date>2026-08-29T00:00:00.000Z</news:publication_date>" +
        "<news:title>Companies A, B in Merger Talks</news:title>" +
        "</news:news>",
    );
  });
});

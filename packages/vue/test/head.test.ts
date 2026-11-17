import { expect, test } from "vitest";
import { mergeHead, renderHead, withBase } from "../src/core/head";

test("later tags win by key, other tags are kept once", () => {
  const icon = { tag: "link", attrs: { rel: "icon", href: "/favicon.ico" } };
  const tags = mergeHead(
    [
      { tag: "title", content: "Default" },
      { tag: "meta", attrs: { name: "description", content: "default" } },
      icon,
    ],
    [{ tag: "meta", attrs: { property: "og:title", content: "From a plugin" } }],
    [
      { tag: "title", content: "Mine" },
      { tag: "meta", attrs: { name: "description", content: "mine" } },
      icon,
    ],
  );

  expect(tags).toEqual([
    { tag: "title", content: "Mine" },
    { tag: "meta", attrs: { name: "description", content: "mine" } },
    icon,
    { tag: "meta", attrs: { property: "og:title", content: "From a plugin" } },
  ]);
});

test("renders escaped HTML", () => {
  const html = renderHead([
    { tag: "title", content: "Tom & <Jerry>" },
    { tag: "meta", attrs: { name: "description", content: 'say "hi"' } },
    {
      tag: "link",
      attrs: { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" },
    },
    { tag: "script", content: "if (a < b) close('</script>')" },
    { tag: "bad tag", content: "dropped" },
  ]);

  expect(html).toBe(
    `<title>Tom &amp; &lt;Jerry&gt;</title>` +
      `<meta name="description" content="say &quot;hi&quot;">` +
      `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` +
      `<script>if (a < b) close('<\\/script>')</script>`,
  );
});

test("adds the base path to the paths of the site a tag links to", () => {
  const tags = withBase(
    [
      { tag: "link", attrs: { rel: "icon", href: "/favicon.svg" } },
      { tag: "script", attrs: { src: "/analytics.js", defer: true } },
      { tag: "link", attrs: { rel: "preconnect", href: "https://fonts.example.com" } },
      { tag: "script", attrs: { src: "//cdn.example.com/a.js" } },
      { tag: "meta", attrs: { name: "theme-color", content: "/not-a-path" } },
    ],
    "/docs/",
  );
  expect(tags.map((tag) => tag.attrs?.href ?? tag.attrs?.src ?? tag.attrs?.content)).toEqual([
    "/docs/favicon.svg",
    "/docs/analytics.js",
    "https://fonts.example.com",
    "//cdn.example.com/a.js",
    "/not-a-path",
  ]);
});

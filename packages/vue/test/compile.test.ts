import ayuLight from "@pierre/highlights/themes/ayu-light";
import dracula from "@pierre/highlights/themes/dracula";
import { expect, test } from "vitest";
import { createSSRApp, h } from "vue";
import { renderToString } from "vue/server-renderer";
import { pressKey, useMDXComponents, type PressState } from "../src/client";
import { compileMarkdown, type MarkdownOptions } from "../src/vite/compile";

const source = `---
title: Hello
description: A page
---

## Install [#install]

Some **text**.

:::warning[Careful]
Do not do this.
:::

\`\`\`ts title="a.ts"
const a = 1; // [!code highlight]
\`\`\`

### Usage
`;

test("compiles Markdown to a Vue module", async () => {
  const { code } = await compileMarkdown({ source, filePath: "/content/hello.mdx" });

  // the frontmatter is the data of the page in its collection, not part of the module
  expect(code).not.toContain("A page");
  expect(code).toContain(`from "@fumapress/vue/jsx-runtime"`);
  expect(code).not.toContain(`from "react`);
  expect(code).toContain("export const structuredData");
  expect(code).toContain("CalloutContainer");
  // the transformer of `[!code highlight]` ran
  expect(code.slice(code.indexOf("function _createMdxContent"))).not.toContain("[!code highlight]");

  const toc = JSON.parse(/export const toc = (.*);/.exec(code)![1]!);
  expect(toc).toEqual([
    { title: "Install", url: "#install", depth: 2 },
    { title: "Usage", url: "#usage", depth: 3 },
  ]);
});

test("highlights code with the themes of the options, as variables the color mode switches", async () => {
  const code = async (highlight?: MarkdownOptions["highlight"]) =>
    (
      await compileMarkdown({
        source: "```ts\nconst a = 1;\n```",
        filePath: "/content/hello.mdx",
        browser: true,
        options: { highlight },
      })
    ).code;

  const own = await code({ themes: { light: ayuLight, dark: dracula } });
  expect(own).toContain("shiki-themes ayu-light dracula-theme");
  // a color of each theme, under the variable of its mode
  expect(own).toContain("--shiki-dark:#ff79c6;--shiki-light:#fa8d3e");
  expect(await code()).toContain("shiki-themes github-light github-dark");
});

test("parses the syntax that `features` turns on, like math", async () => {
  const code = async (options?: MarkdownOptions) =>
    (
      await compileMarkdown({
        source: "Inline $x^2$.",
        filePath: "/content/math.md",
        browser: true,
        options,
      })
    ).code;

  expect(await code()).not.toContain("language-math");
  expect(await code({ features: { math: true } })).toContain("language-math math-inline");
});

test("Markdown reads the components of the theme from the app, so a partial has them too", async () => {
  const { code } = await compileMarkdown({
    source: "<Callout>Hi</Callout>",
    filePath: "/content/_note.mdx",
    browser: true,
  });
  expect(code).toContain(
    'import { useMDXComponents as _provideComponents } from "@fumapress/vue/client";',
  );

  // what the compiled module calls while it renders, without a `components` prop
  const Callout = () => h("aside", "callout");
  const Content = () => {
    const { Callout: Component } = useMDXComponents();
    return Component ? h(Component) : "missing";
  };
  const app = createSSRApp({ render: () => h(Content) });
  app.provide(pressKey, { components: { Callout } } as unknown as PressState);
  expect(await renderToString(app)).toBe("<aside>callout</aside>");
});

test("compiles only the content for the browser", async () => {
  const server = await compileMarkdown({ source, filePath: "/content/hello.mdx" });
  const browser = await compileMarkdown({ source, filePath: "/content/hello.mdx", browser: true });

  expect(browser.code).toContain("export default");
  expect(browser.code).toContain('id: "install"');
  for (const name of ["structuredData", "toc", "markdown"]) {
    expect(browser.code).not.toContain(`export const ${name}`);
  }
  expect(browser.code.length).toBeLessThan(server.code.length);
});

test("images are files of the build or paths of the site, and other URLs stay", async () => {
  const { code } = await compileMarkdown({
    source: [
      "![next](./pic.svg)",
      "![public](/logo.svg)",
      "![other](https://example.com/a.png)",
      '<ImageZoom src="/diagram.svg" alt="public" />',
      '<ImageZoom src="shots/home.png" alt="next" />',
      '<ImageZoom src="//cdn.example.com/a.png" alt="other" />',
    ].join("\n\n"),
    filePath: "/content/hello.mdx",
  });

  // a file next to the page is imported, in Markdown and as the `src` of a component
  expect(code).toContain('import __img0 from "./pic.svg";');
  expect(code).toContain('import __img1 from "./shots/home.png";');
  expect(code).toMatch(/src: __img0\b/);
  expect(code).toMatch(/src: __img1\b/);
  // a path of the site gets the base path, which Vite fills in
  expect(code).toContain('src: import.meta.env.BASE_URL + "logo.svg"');
  expect(code).toContain('src: import.meta.env.BASE_URL + "diagram.svg"');
  // a URL of another site is left alone
  expect(code).toContain('src: "https://example.com/a.png"');
  expect(code).toContain('src: "//cdn.example.com/a.png"');
});

test("exports the content as Markdown, as it was written", async () => {
  const { code } = await compileMarkdown({
    source: [
      "---",
      "title: Hello",
      "---",
      "",
      "## Install",
      "",
      "Run [the command](/guide/cli):",
      "",
      "```bash",
      "npm install",
      "```",
      "",
      "- one",
      "- two",
    ].join("\n"),
    filePath: "/content/hello.mdx",
  });
  const markdown = /export (?:const|let) markdown = (.*);/.exec(code)?.[1] ?? "";
  // the code block, the link and the list are kept, the frontmatter is not
  expect(markdown).toContain("npm install");
  expect(markdown).toContain("[the command](/guide/cli)");
  expect(markdown).toContain("- one");
  expect(markdown).not.toContain("title: Hello");

  const browser = await compileMarkdown({
    source: "## Install",
    filePath: "/a.mdx",
    browser: true,
  });
  expect(browser.code).not.toContain("markdown =");
});

import { expect, test } from "vitest";
import { compileMarkdown } from "../src/build/compile";

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
  const { code, frontmatter } = await compileMarkdown({ source, filePath: "/content/hello.mdx" });

  expect(frontmatter).toEqual({ title: "Hello", description: "A page" });
  expect(code).toContain(`from "@fumapress/vue/jsx-runtime"`);
  expect(code).not.toContain(`from "react`);
  expect(code).toContain("export const frontmatter");
  expect(code).toContain("export const structuredData");
  expect(code).toContain("CalloutContainer");
  // the transformer of `[!code highlight]` ran
  expect(code).not.toContain("[!code highlight]");

  const toc = JSON.parse(/export const toc = (.*);/.exec(code)![1]!);
  expect(toc).toEqual([
    { title: "Install", url: "#install", depth: 2 },
    { title: "Usage", url: "#usage", depth: 3 },
  ]);
});

test("compiles only the content for the browser", async () => {
  const server = await compileMarkdown({ source, filePath: "/content/hello.mdx" });
  const browser = await compileMarkdown({ source, filePath: "/content/hello.mdx", browser: true });

  expect(browser.code).toContain("export default");
  expect(browser.code).toContain('id: "install"');
  for (const name of ["frontmatter", "structuredData", "toc"]) {
    expect(browser.code).not.toContain(`export const ${name}`);
  }
  expect(browser.code.length).toBeLessThan(server.code.length);
});

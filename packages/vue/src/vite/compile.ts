import { compileMdx } from "@fumadocs/satteri/compile";
import { rehypeCodeFromHighlighter } from "@fumadocs/satteri/rehype-code";
import { rehypeToc } from "@fumadocs/satteri/rehype-toc";
import { remarkCodeTab } from "@fumadocs/satteri/remark-code-tab";
import { remarkDirectiveAdmonition } from "@fumadocs/satteri/remark-directive-admonition";
import { rehypeHeading, remarkHeading } from "@fumadocs/satteri/remark-heading";
import { remarkLlms } from "@fumadocs/satteri/remark-llms";
import { remarkNpm } from "@fumadocs/satteri/remark-npm";
import { remarkSteps } from "@fumadocs/satteri/remark-steps";
import { remarkStructure } from "@fumadocs/satteri/remark-structure";
import { createHighlights } from "fumadocs-core/highlight/highlights";
import type { Features, HastPluginInput, MdastPluginInput } from "satteri";
import type { HighlightsOptions } from "../highlight";
import { parseFrontmatter } from "./frontmatter";

export interface MarkdownOptions {
  /** syntax of the Markdown parser, like `math`, over the defaults: GFM and directives */
  features?: Features;
  /** plugins on the Markdown tree, after the built-in ones */
  mdastPlugins?: MdastPluginInput[];
  /** plugins on the HTML tree, after the built-in ones */
  hastPlugins?: HastPluginInput[];
  /** options of the highlighter of code blocks, like the `light` and `dark` themes */
  highlight?: HighlightsOptions;
}

export interface CompileInput {
  source: string;
  filePath: string;
  isDevelopment?: boolean;
  /**
   * Compile for the browser: only the content. The server sends the data of a page (its frontmatter and table of
   * contents), and only the server reads its structured data.
   */
  browser?: boolean;
  options?: MarkdownOptions;
}

export interface CompileOutput {
  /** an ES module: the content as its default export; on the server, `toc`, `structuredData` and `markdown` too */
  code: string;
}

/** the kinds of a URL in content: of another site, of this site (like a file of `public`), or a file next to the page */
function kindOf(url: string): "external" | "site" | "file" {
  if (/^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(url)) return "external";
  return url.startsWith("/") ? "site" : "file";
}

const withBase = (url: string) => `import.meta.env.BASE_URL + ${JSON.stringify(url.slice(1))}`;

/**
 * The images of content: a Markdown image, and the `src` of an element or a component. A file next to the page is
 * imported, so Vite puts it in the build; a path of the site gets the base path; another URL stays as it is.
 */
function images(): MdastPluginInput {
  /** the imports of the files, added to the module once it is generated */
  const imports: string[] = [];
  const attribute = (name: string, value: unknown) => ({ type: "mdxJsxAttribute", name, value });

  /** the expression of a `src` in the module, none for a URL that stays as it is */
  function srcOf(url: string) {
    const kind = kindOf(url);
    if (kind === "external") return;
    let value = withBase(url);
    if (kind === "file") {
      value = `__img${imports.length}`;
      const file = decodeURI(url);
      imports.push(
        `import ${value} from ${JSON.stringify(/^\.\.?\//.test(file) ? file : `./${file}`)};`,
      );
    }
    return attribute("src", { type: "mdxJsxAttributeValueExpression", value });
  }

  function element(node: { attributes: any[] }, ctx: any) {
    const written = node.attributes.find(
      (item) => item.type === "mdxJsxAttribute" && item.name === "src",
    );
    const src = typeof written?.value === "string" ? srcOf(written.value) : undefined;
    if (!src) return;
    ctx.setProperty(
      node,
      "attributes",
      node.attributes.map((item) => (item === written ? src : item)),
    );
  }

  return {
    name: "images",
    afterToJs({ result }: { result: { code: string } }) {
      if (imports.length > 0) result.code += `\n${imports.join("\n")}`;
    },
    image(node: any, ctx: any) {
      const src = srcOf(node.url);
      if (!src) return;
      ctx.replaceNode(node, {
        type: "mdxJsxFlowElement",
        name: "img",
        children: [],
        attributes: [
          attribute("alt", node.alt ?? ""),
          src,
          ...(node.title ? [attribute("title", node.title)] : []),
        ],
        data: { position: node.position },
      });
    },
    mdxJsxFlowElement: element,
    mdxJsxTextElement: element,
  } as MdastPluginInput;
}

/**
 * Compiles a Markdown or MDX file to a module of Vue render functions: Sätteri parses it, the plugins of Fumadocs add
 * its features, and Highlights colors the code blocks.
 */
export async function compileMarkdown({
  source,
  filePath,
  isDevelopment = false,
  browser = false,
  options = {},
}: CompileInput): Promise<CompileOutput> {
  // the frontmatter is the data of the page, which the collection has: the module is the content
  const { body } = parseFrontmatter(source);

  const result = await compileMdx({
    source: body,
    filePath,
    isDevelopment,
    options: {
      features: options.features,
      jsxImportSource: "@fumapress/vue",
      // the components of the theme, from the app: a file that a page imports has them too
      providerImportSource: "@fumapress/vue/client",
      elementAttributeNameCase: "html",
      stylePropertyNameCase: "css",
      mdastPlugins: [
        remarkHeading({ generateToc: false }),
        remarkDirectiveAdmonition(),
        remarkSteps(),
        remarkCodeTab(),
        remarkNpm(),
        images(),
        ...(options.mdastPlugins ?? []),
        ...(browser
          ? []
          : [
              remarkStructure({ exportAs: "structuredData" }),
              remarkLlms({ as: "markdown", headingIds: false }),
            ]),
      ],
      hastPlugins: [
        rehypeCodeFromHighlighter(
          ({ transformers }) =>
            createHighlights({ ...options.highlight, shikiTransformers: transformers }),
          // tokens as HTML: about half the output of one element per token
          { tokens: "html" },
        ),
        ...(options.hastPlugins ?? []),
        rehypeToc({ exportToc: { as: "data" } }),
        rehypeHeading(),
      ],
    },
  });

  if (browser) return { code: result.code };

  const toc = (result.data as { rehypeToc?: unknown }).rehypeToc ?? [];
  return {
    code: `${result.code}\nexport const toc = ${JSON.stringify(toc)};\n`,
  };
}

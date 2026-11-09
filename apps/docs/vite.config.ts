import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import press from "fumapress/vite";
import { fumadocsMdx } from "fumadocs-mdx/vite";
import { remarkMdxFiles } from "fumadocs-core/mdx-plugins/remark-mdx-files";
import { remarkSteps } from "fumadocs-core/mdx-plugins/remark-steps";
import { rehypeCodeFromHighlighter } from "fumadocs-core/mdx-plugins/rehype-code.core";
import { createGenerator, remarkAutoTypeTable, type GenerateOptions } from "fumadocs-typescript";
import { highlighter } from "./src/highlighter";

const generator = createGenerator();

const typeSimplifier: GenerateOptions["typeSimplifier"] = {
  // a short type says more than the "union" or "array" of the default
  override({ type, checker, location }) {
    const text = checker.typeToString(type, location).replace(/ \| undefined$/, "");
    if (text.length <= 32 && !text.includes("=>")) return text;
  },
};

export default defineConfig({
  plugins: [
    press({ components: "./src/components/mdx.tsx" }),
    fumadocsMdx({
      globalOptions: {
        mdxOptions: {
          // `remarkSteps` after `remarkShow`, the first plugin, so steps count the branches that show,
          // and before heading IDs, which leave out its `[step]` tag
          remarkPlugins: ([remarkShow, ...plugins]) => [
            remarkShow!,
            remarkSteps,
            ...plugins,
            remarkMdxFiles,
            [remarkAutoTypeTable, { generator, highlighter, options: { typeSimplifier } }],
          ],
          rehypeCodeOptions: false,
          rehypePlugins: (plugins) => [
            () =>
              rehypeCodeFromHighlighter(({ transformers }) =>
                highlighter.override({ shikiTransformers: transformers }),
              ),
            ...plugins,
          ],
        },
      },
    }),
    tailwindcss(),
  ],
});

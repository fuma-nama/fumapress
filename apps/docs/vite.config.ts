import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import press from "fumapress/vite";
import { fumadocsMdx } from "fumadocs-mdx/vite";
import { remarkMdxFiles } from "fumadocs-core/mdx-plugins/remark-mdx-files";
import { remarkSteps } from "fumadocs-core/mdx-plugins/remark-steps";
import { createGenerator, remarkAutoTypeTable, type GenerateOptions } from "fumadocs-typescript";

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
          // `remarkSteps` first: heading IDs leave out its `[step]` tag
          remarkPlugins: (plugins) => [
            remarkSteps,
            ...plugins,
            remarkMdxFiles,
            [remarkAutoTypeTable, { generator, options: { typeSimplifier } }],
          ],
          rehypeCodeOptions: {
            themes: {
              light: "vitesse-light",
              dark: "catppuccin-mocha",
            },
          },
        },
      },
    }),
    tailwindcss(),
  ],
});

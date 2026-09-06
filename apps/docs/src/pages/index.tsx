import { GrainGradient } from "@paper-design/shaders-react";
import { buttonVariants } from "fumadocs-ui/components/ui/button";
import { Link } from "fumapress/client";
import { cn } from "../cn";
import { BookIcon } from "lucide-react";
import { HomeConfigPlayground } from "../home-config-playground";
import { HomePluginExplorer } from "../home-plugin-explorer";
import { AutoSetupCommand } from "../home.client";
import { Image } from "fumapress/image";
import { asMarkdown, md } from "fumapress/markdown";
import { commands, plugins } from "../home.data";
import { getPressContext } from "fumapress";

export default function Page() {
  if (asMarkdown()) return pageMarkdown();
  const { getImageUrl } = getPressContext().data["core:takumi"]!;

  return (
    <>
      <title>Fumapress</title>
      <meta property="og:title" content="Fumapress" />
      <meta property="og:description" content="The composable site generator powered by Fumadocs" />
      <meta property="og:image" content={getImageUrl()} />
      <section className="relative grid grid-cols-1 min-h-[50vh] border lg:grid-cols-2 lg:divide-x lg:divide-fd-border">
        <div className="flex flex-col px-6 py-12 md:px-12 md:py-24">
          <p className="text-fd-muted-foreground">
            By <span className="text-fd-foreground">Fuma Nama</span>
          </p>
          <h1 className="mt-4 tracking-tight text-4xl font-medium">
            Turn Your Content into a<br />
            <span className="text-transparent bg-clip-text bg-linear-to-b from-fd-primary to-white">
              Beautiful Website
            </span>
          </h1>
          <p className="mt-8">
            Build feature-rich content sites, blog, API documentation in seconds with{" "}
            <span className="text-fd-primary font-medium">Fumapress</span>, a highly customizable &
            composable site generator.
          </p>
          <Link
            href="/docs"
            className={cn(
              buttonVariants({ variant: "primary" }),
              "mt-8 mb-12 gap-2 w-40 rounded-xl",
            )}
          >
            <BookIcon className="size-4" />
            Getting Started
          </Link>
          <AutoSetupCommand />
        </div>
        <div className="relative overflow-hidden max-lg:h-[400px]">
          <div className="absolute inset-0 flex items-center z-2 p-4">
            <Image
              src="/preview.png"
              sizes="(min-width: 1024px) 800px, 600px"
              className="border-4 border-white/20 rounded-xl max-lg:min-w-[600px] max-lg:w-[600px] max-lg:max-w-none shadow-lg shadow-black/50 lg:w-[60vw] lg:max-w-[800px]"
              loading="eager"
              fetchPriority="high"
            />
          </div>
          <GrainGradient
            className="absolute inset-0"
            colors={["#c6750c", "#beae60", "#d7cbc6"]}
            colorBack="#000a0f"
            softness={0.7}
            intensity={0.15}
            noise={0.5}
            shape="wave"
            speed={1}
          />
        </div>
      </section>

      <HomeConfigPlayground />
      <HomePluginExplorer />
    </>
  );
}

/** the Markdown form of the landing page, see `routes: "all"` of the llms.txt plugin */
function pageMarkdown() {
  return md`# Fumapress

> The composable site generator powered by Fumadocs

Build feature-rich content sites, blog, API documentation in seconds with Fumapress, a highly customizable & composable site generator.

- [Getting Started](/docs)

\`\`\`bash
${commands.npm}
\`\`\`

## Plugins

${plugins.map(
  (plugin) => md`### ${plugin.name}

${plugin.description}

[Documentation](${plugin.docsHref})

\`\`\`ts title="press.config.tsx"
${plugin.usage}
\`\`\`

`,
)}`;
}

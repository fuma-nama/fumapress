import { defineConfig } from "fumapress";
import { TypeTable } from "fumadocs-ui/components/type-table";
import { lucideIconsPlugin } from "fumadocs-core/source/plugins/lucide-icons";
import { fumadocsMdx } from "fumapress/adapters/mdx";
import {
  blogMetaSchema,
  blogPageSchema,
  metaSchema,
  pageSchema,
} from "fumapress/adapters/mdx/schema";
import { blogPlugin } from "fumapress/plugins/blog";
import { changelogPlugin } from "@fumapress/tegami";
import { changelogMetaSchema, changelogPageSchema } from "@fumapress/tegami/schema";
import defaultMdxComponents, { createRelativeLink } from "fumadocs-ui/mdx";
import { Card, Cards } from "fumadocs-ui/components/card";
import path from "node:path";
import { createHomeLayout } from "fumapress/layouts/home";
import { linkValidationPlugin } from "fumapress/plugins/link-validation";
import { BookIcon, HistoryIcon, RssIcon } from "lucide-react";
import { mcpPlugin } from "@fumapress/ai";
import { Image } from "fumapress/image";
import { createNotebookLayoutPage } from "fumapress/layouts/notebook";
import { SponsorsMarquee } from "@fumari/sponsors";
import { defineDocs } from "fumadocs-mdx/macro";
import { llmsPlugin } from "fumapress/plugins/llms.txt";

const docs = defineDocs({
  dir: "content/docs",
  docs: {
    async: true,
    schema: pageSchema,
    lastModified: true,
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    schema: metaSchema,
  },
});

const blog = defineDocs({
  dir: "content/blog",
  docs: {
    async: true,
    schema: blogPageSchema,
    lastModified: true,
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    schema: blogMetaSchema,
  },
});

const changelog = defineDocs({
  dir: "content/changelog",
  docs: {
    async: true,
    schema: changelogPageSchema,
    lastModified: true,
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    schema: changelogMetaSchema,
  },
});

const NotebookLayout = createNotebookLayoutPage<typeof config.$context>({
  treeRoot: "docs",
  render() {
    return {
      pageProps: {
        tableOfContent: {
          footer: <SponsorsMarquee />,
        },
      },
    };
  },
});

export const HomeLayout = createHomeLayout<typeof config.$context>({
  layoutProps: {
    links: [
      {
        url: "/docs",
        text: "Documentation",
        icon: <BookIcon />,
        active: "nested-url",
      },
      {
        url: "/blog",
        text: "Blog",
        icon: <RssIcon />,
        active: "nested-url",
      },
      {
        url: "/changelog",
        text: "Changelog",
        icon: <HistoryIcon />,
        active: "nested-url",
      },
      {
        url: "https://fuma-nama.dev/sponsors",
        text: "Sponsors",
        external: true,
      },
    ],
  },
});

const config = defineConfig({
  content: {
    docs: docs.toFumadocsSource({
      baseDir: "docs",
    }),
    blog: blog.toFumadocsSource({
      baseDir: "blog",
    }),
    changelog: changelog.toFumadocsSource({
      baseDir: "changelog",
    }),
  },
  loaderOptions: {
    plugins: [lucideIconsPlugin()],
  },
  site: {
    name: "Fumapress",
    baseUrl: import.meta.env.DEV ? "http://localhost:3000" : "https://press.fumadocs.dev",
    git: {
      user: "fuma-nama",
      branch: "dev",
      repo: "fumapress",
    },
  },
  meta: {
    root() {
      return (
        <>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
          <link
            href="https://fonts.googleapis.com/css2?family=Geist:ital,wght@0,100..900;1,100..900&family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&display=swap"
            rel="stylesheet"
          />
          <link rel="icon" href="/favicon.ico" type="image/x-icon" />
        </>
      );
    },
  },
  defaultLayoutProps: {
    nav: {
      title: (
        <>
          <Image
            src="/logo.png"
            width={64}
            height={64}
            className="size-8 rounded-full shadow-md shadow-black mb-1"
          />
          <span>
            <span className="font-mono uppercase border-b-2 border-fd-primary">Fumapress</span>
            <br />
            <span className="font-normal text-fd-muted-foreground text-xs">The site generator</span>
          </span>
        </>
      ),
    },
  },
  renderPage: (props) => <NotebookLayout {...props} />,
})
  .adapters(
    fumadocsMdx({
      async getMdxComponents(page) {
        const source = await this.getLoader();

        return {
          ...defaultMdxComponents,
          TypeTable,
          a: createRelativeLink(source, page),
          DocsCategory() {
            const dir = path.dirname(page.path);
            const items = source
              .getPages(page.locale)
              .filter(
                (item) =>
                  item.path !== page.path && !path.relative(dir, item.path).startsWith(".."),
              );

            return (
              <Cards>
                {items.map((item) => (
                  <Card key={item.path} href={item.url} title={item.data.title}>
                    {item.data.description}
                  </Card>
                ))}
              </Cards>
            );
          },
        };
      },
    }),
  )
  .plugins(linkValidationPlugin(), mcpPlugin(), llmsPlugin({ routes: "all" }));

export default config.plugins(
  blogPlugin({
    layouts: {
      layout: HomeLayout,
    },
  }),
  changelogPlugin({
    layouts: {
      layout: HomeLayout,
    },
  }),
);

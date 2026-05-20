import { defineConfig } from "fumapress";
import { llmsPlugin } from "fumapress/plugins/llms.txt";
import { takumiPlugin } from "fumapress/plugins/takumi";
import { loader } from "fumadocs-core/source";
import { blog, docs } from "./.source/server";
import { lucideIconsPlugin } from "fumadocs-core/source/plugins/lucide-icons";
import { fumadocsMdx } from "fumapress/adapters/mdx";
import { flexsearchPlugin } from "fumapress/plugins/flexsearch";
import { createDocsLayoutPage } from "fumapress/layouts/docs";
import { blogPlugin } from "fumapress/plugins/blog";
import defaultMdxComponents, { createRelativeLink } from "fumadocs-ui/mdx";
import { Card, Cards } from "fumadocs-ui/components/card";
import path from "node:path";
import Home from "./src/home";
import { createHomeLayout } from "fumapress/layouts/home";
import { BookIcon, RssIcon } from "lucide-react";
import { createBlogLayout } from "fumapress/layouts/blog";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

function baseOptions() {
  return {
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
    ],
  } satisfies BaseLayoutProps;
}

export default defineConfig({
  mode: "static",
  loader: loader(
    {
      docs: docs.toFumadocsSource({
        baseDir: "docs",
      }),
      blog: blog.toFumadocsSource({
        baseDir: "blog",
      }),
    },
    {
      baseUrl: "/",
      plugins: [lucideIconsPlugin()],
    },
  ),
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
})
  .useAdapters(
    fumadocsMdx({
      async getMdxComponents(page) {
        const source = await this.getLoader();

        return {
          ...defaultMdxComponents,
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
  .usePlugins(
    flexsearchPlugin(),
    llmsPlugin(),
    takumiPlugin(),
    blogPlugin({
      layouts: {
        layout: createBlogLayout({
          render: () => ({ layoutProps: baseOptions() }),
        }),
      },
    }),
    {
      createPages({ createPage }) {
        const HomeLayout = createHomeLayout<(typeof this)["$context"]>({
          render: () => ({
            layoutProps: baseOptions(),
          }),
        });

        createPage({
          path: "/",
          render: "static",
          component: () => (
            <HomeLayout ctx={this}>
              <Home />
            </HomeLayout>
          ),
        });
      },
    },
  )
  .useLayouts({
    defaultProps() {
      return {
        nav: {
          title: (
            <>
              <img
                src="/logo.png"
                width={64}
                height={64}
                className="size-8 rounded-full shadow-md shadow-black mb-1"
              />
              <span>
                <span className="font-mono uppercase border-b-2 border-fd-primary">Fumapress</span>
                <br />
                <span className="font-normal text-fd-muted-foreground text-xs">
                  The site generator
                </span>
              </span>
            </>
          ),
        },
      };
    },
    page: createDocsLayoutPage({
      render: () => ({
        pageProps: {
          tableOfContent: { style: "clerk" },
        },
      }),
    }),
  });

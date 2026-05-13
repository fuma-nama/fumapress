import { defineConfig } from "fumapress";
import { llmsPlugin } from "fumapress/plugins/llms.txt";
import { takumiPlugin } from "fumapress/plugins/takumi";
import { loader } from "fumadocs-core/source";
import { docs } from "./.source/server";
import { lucideIconsPlugin } from "fumadocs-core/source/plugins/lucide-icons";
import { fumadocsMdx } from "fumapress/adapters/mdx";
import { flexsearchPlugin } from "fumapress/plugins/flexsearch";
import { createDocsLayout } from "fumapress/layouts/docs";

export default defineConfig({
  mode: "static",
  loader: loader(docs.toFumadocsSource(), {
    baseUrl: "/",
    plugins: [lucideIconsPlugin()],
  }),
  site: {
    name: "Fumapress",
    baseUrl: import.meta.env.DEV ? "http://localhost:3000" : "https://press.fumadocs.dev",
    git: {
      user: "fuma-nama",
      branch: "dev",
      repo: "fumadocs",
    },
  },
  meta: {
    root() {
      return (
        <>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
          <link
            href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@100..900&family=Geist:wght@100..900&display=swap"
            rel="stylesheet"
          />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
          <link
            href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@100..900&family=Geist:wght@100..900&display=swap"
            rel="stylesheet"
          />
          <link rel="icon" href="/favicon.ico" type="image/x-icon" />
        </>
      );
    },
  },
})
  .useAdapters(fumadocsMdx())
  .usePlugins(flexsearchPlugin(), llmsPlugin(), takumiPlugin())
  .useLayouts({
    page: createDocsLayout({
      async render(page) {
        return {
          layoutProps: {
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
                    <span className="font-mono uppercase border-b-2 border-fd-primary">
                      Fumapress
                    </span>
                    <br />
                    <span className="font-normal text-fd-muted-foreground text-xs">
                      The site generator
                    </span>
                  </span>
                </>
              ),
            },
          },
          pageProps: {
            toc: (await page.data.load()).toc,
            tableOfContent: { style: "clerk" },
          },
        };
      },
    }),
  });

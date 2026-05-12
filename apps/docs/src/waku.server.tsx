import adapter from "waku/adapters/default";
import pressConfig from "../press.config";
import { createRouter } from "fumapress/router";
import { createDocsLayout } from "fumapress/layouts/docs";

const router = createRouter(pressConfig, {
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

export default adapter(router.createPages());

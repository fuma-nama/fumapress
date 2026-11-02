import { describe, expect, it } from "vitest";
import { renderToReadableStream } from "react-dom/server.edge";
import { FrameworkProvider } from "fumadocs-core/framework";
import type { ReactNode } from "react";
import { appContext } from "@/app/context";
import { createDocsLayoutPage } from "@/layouts/docs";
import { createApp } from "./fixtures";

function Item({ children, label }: { children?: ReactNode; label: string }) {
  return (
    <section data-slot={label}>
      {label}
      {children}
    </section>
  );
}

describe("docs layout", () => {
  it("renders the page data and the slots of plugins", async () => {
    const ctx = await createApp({
      adapters: [{ "core:get-body": () => ({ node: <p>body</p> }) }],
      plugins: [
        {
          transformPage: (data) => ({ ...data, title: "Transformed", markdownUrl: "/page.md" }),
          slots: () => [
            { slot: "page.footer", component: Item, props: { label: "footer" } },
            { slot: "body.wrapper", component: Item, props: { label: "inner" }, order: 1 },
            { slot: "body.wrapper", component: Item, props: { label: "outer" } },
            { slot: "page.actions", component: Item, props: { label: "action" } },
          ],
        },
      ],
    });
    const page = (await ctx.getLoader()).getPage(["docs", "basics"])!;
    const Layout = createDocsLayoutPage();

    const html = await appContext.run(ctx, async () => {
      const stream = await renderToReadableStream(
        <FrameworkProvider
          usePathname={() => page.url}
          useParams={() => ({})}
          useRouter={() => ({ push() {}, refresh() {} })}
        >
          {await Layout({ page, slugs: ["docs", "basics"] })}
        </FrameworkProvider>,
      );
      await stream.allReady;
      return new Response(stream).text();
    });

    expect(html).toContain("Transformed");
    expect(html).toContain('<section data-slot="action">action</section>');
    expect(html).toMatch(
      /<section data-slot="outer">outer<section data-slot="inner">inner<p>body<\/p><\/section><\/section>/,
    );
    expect(html.indexOf('data-slot="footer"')).toBeGreaterThan(html.indexOf("<p>body</p>"));
  });
});

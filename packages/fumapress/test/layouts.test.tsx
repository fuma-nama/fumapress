import { describe, expect, it, vi } from "vitest";
import { renderToReadableStream } from "react-dom/server.edge";
import { FrameworkProvider } from "fumadocs-core/framework";
import type { ReactNode } from "react";
import { appContext } from "@/app/context";
import type { PressProviderProps } from "@/components/provider";
import { createDocsLayoutPage } from "@/layouts/docs";
import { createRootLayout } from "@/layouts/root";
import { flexsearchPlugin } from "@/plugins/flexsearch";
import { createApp } from "./fixtures";

const provider = vi.hoisted(() => ({ props: undefined as PressProviderProps | undefined }));

// the root layout without the client router of Waku
vi.mock("@/components/provider", () => ({
  PressProvider(props: PressProviderProps) {
    provider.props = props;
    return <div data-provider="">{props.children}</div>;
  },
}));
vi.mock("virtual:root.css?inline", () => ({ default: "" }));
vi.mock("virtual:root.css?url", () => ({ default: "/root.css" }));

async function render(node: ReactNode): Promise<string> {
  const stream = await renderToReadableStream(node);
  await stream.allReady;
  return new Response(stream).text();
}

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

describe("root layout", () => {
  it("wraps the layout of every page with `layout.wrapper`, inside the provider", async () => {
    const ctx = await createApp({
      plugins: [
        {
          slots: ({ page }) =>
            page ? [] : [{ slot: "layout.wrapper", component: Item, props: { label: "banner" } }],
        },
      ],
    });
    const Root = createRootLayout();

    const html = await appContext.run(ctx, async () =>
      render(await Root({ children: <p>page</p> })),
    );
    expect(html).toContain(
      '<div data-provider=""><section data-slot="banner">banner<p>page</p></section></div>',
    );
  });

  it("searches the static index of the search plugin in the browser", async () => {
    const Root = createRootLayout();
    const dialog = async (mode: "static" | "default") => {
      const ctx = await createApp({ mode, plugins: [flexsearchPlugin()] });
      await appContext.run(ctx, async () => render(await Root({ children: null })));
      return provider.props?.search?.SearchDialog;
    };

    expect(await dialog("static")).toBe((await import("@/components/flexsearch-static")).default);
    expect(await dialog("default")).toBeUndefined();
  });
});

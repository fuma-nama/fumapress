import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { Link, TrailingSlashProvider } from "@/components/link";

vi.mock("waku/router/client", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
  useRouter: () => ({ path: "/docs" }),
}));

function render(node: ReactNode, trailingSlash?: boolean) {
  if (trailingSlash === undefined) return renderToString(node);
  return renderToString(
    <TrailingSlashProvider value={trailingSlash}>{node}</TrailingSlashProvider>,
  );
}

afterEach(() => {
  global.LINK_SSG_CONTEXT = undefined;
});

describe("Link", () => {
  it("keeps hrefs as is by default", () => {
    expect(render(<Link href="/tags/guides">Guides</Link>)).toBe(
      '<a href="/tags/guides">Guides</a>',
    );
  });

  it("appends a trailing slash to page links with `trailingSlash`", () => {
    expect(render(<Link href="/tags/guides?a=1#h">Guides</Link>, true)).toBe(
      '<a href="/tags/guides/?a=1#h">Guides</a>',
    );
    expect(render(<Link href="/rss.xml">RSS</Link>, true)).toBe('<a href="/rss.xml">RSS</a>');
  });

  it("records the rendered href for link validation", () => {
    global.LINK_SSG_CONTEXT = { links: [] };
    render(<Link href="/tags/guides">Guides</Link>, true);

    expect(global.LINK_SSG_CONTEXT.links).toEqual([
      { href: "/tags/guides/", fromPathname: "/docs" },
    ]);
  });
});

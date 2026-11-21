import { describe, expect, it, vi } from "vitest";
import type { ComponentProps, FC } from "react";
import { renderToString } from "react-dom/server";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { PressProvider } from "@/components/provider";
import { ImageProvider, type ClientImageProvider } from "@/components/image";

vi.mock("waku", () => ({ useRouter: () => ({ path: "/docs" }) }));
vi.mock("waku/router/client", () => ({ useRouter: () => ({ path: "/docs" }) }));

const provider: ClientImageProvider = {
  name: "test",
  deviceSizes: [640, 1080],
  defaultQuality: 75,
  buildImageUrl: ({ src, width }) => `/_img?src=${src}&w=${width}`,
};

const Img = defaultMdxComponents.img as FC<ComponentProps<"img"> & { priority?: boolean }>;

function render(props: { priority?: boolean }) {
  return renderToString(
    <PressProvider theme={{ enabled: false }}>
      <ImageProvider provider={provider}>
        <Img src="/photo.png" width={800} height={600} alt="" {...props} />
      </ImageProvider>
    </PressProvider>,
  );
}

describe("Markdown images", () => {
  it("load lazily without a preload, like next/image", () => {
    const html = render({});
    expect(html).toContain('loading="lazy"');
    expect(html).not.toContain('rel="preload"');
  });

  it("are preloaded with priority", () => {
    const html = render({ priority: true });
    expect(html).toContain('loading="eager"');
    expect(html).toContain('fetchPriority="high"');
    expect(html).toContain('rel="preload"');
  });
});

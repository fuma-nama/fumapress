import { createElement, forwardRef, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import type * as PageTree from "fumadocs-core/page-tree";
import { createIsland } from "@/island/island";
import { registerPageTree, registerReference } from "@/island/references";
import { AstroContent, serializeIsland, type IslandData } from "@/island/serialize";
import * as client from "./fixtures/client";
import { Box, Card, components } from "./fixtures/components";

const PressIsland = createIsland(components);
const { Counter, Star } = client;

beforeAll(() => {
  // what `plugin.ts` appends to client component modules on the server
  registerReference("client", client);
});

/** render the island on the server, slots are placeholders */
function render({ tree, slots }: IslandData, children?: ReactNode): string {
  const props: Record<string, unknown> = { tree, children };
  for (let i = 0; i < slots.length; i++)
    props[`s${i}`] = createElement("astro-slot", { name: `s${i}` });
  const html = renderToString(createElement(PressIsland, props as { tree: string }));
  // the island is one Suspense boundary
  expect(html).toMatch(/^<!--\$-->.*<!--\/\$-->$/s);
  return html.slice("<!--$-->".length, -"<!--/$-->".length);
}

describe("press island", () => {
  it("keeps HTML elements", async () => {
    const island = await serializeIsland(
      <div className="a" onClick={() => undefined}>
        <p>hello</p>
      </div>,
    );

    expect(island.slots).toEqual([]);
    expect(render(island)).toBe('<div class="a"><p>hello</p></div>');
  });

  it("hydrates MDX components by name", async () => {
    const island = await serializeIsland(<Card title="Title">body</Card>);

    expect(island.tree).toContain('"Card"');
    expect(render(island)).toBe('<section data-card=""><h3>Title</h3>body</section>');
  });

  it("refers to client components", async () => {
    const island = await serializeIsland(<Counter initial={2} />);

    expect(island.tree).toContain('["ref",');
    expect(island.tree).toContain('"Counter"');
    expect(render(island)).toBe('<button type="button">count <!-- -->2</button>');
  });

  it("refers to other exports of client modules as they are, like actions", async () => {
    let received: unknown;
    const actions = {
      submit: async () => "sent",
      Form({ action }: { action: () => Promise<string> }) {
        received = action;
        return <form />;
      },
    };
    registerReference("actions", actions);
    const island = await serializeIsland(<actions.Form action={actions.submit} />);

    expect(render(island)).toBe("<form></form>");
    expect(received).toBe(actions.submit);
  });

  it("renders other components on the server", async () => {
    function Server({ name }: { name: string }) {
      return <b>{name}</b>;
    }
    const island = await serializeIsland(<Server name="inlined" />);

    expect(island.slots).toEqual([]);
    expect(island.tree).not.toContain("Server");
    expect(render(island)).toBe("<b>inlined</b>");
  });

  it("renders the components it can't call into slots, like forwardRef", async () => {
    const Italic = forwardRef<HTMLElement>((_props, ref) => <i ref={ref}>slot</i>);
    const island = await serializeIsland(
      <p>
        <Italic />
      </p>,
    );

    expect(island.slots).toEqual(["<i>slot</i>"]);
    expect(render(island)).toBe('<p><astro-slot name="s0"></astro-slot></p>');
  });

  it("serializes elements and client components in props", async () => {
    const island = await serializeIsland(
      <>
        <Card title={<b>bold</b>} />
        <Box icon={Star} />
      </>,
    );

    expect(render(island)).toBe(
      '<section data-card=""><h3><b>bold</b></h3></section><div data-box=""><span>star</span></div>',
    );
  });

  it("gets page trees from their file by identity", async () => {
    const tree: PageTree.Root = { name: "Docs", children: [] };
    registerPageTree(tree, "/tree.json", { name: "Served", children: [] });
    const island = await serializeIsland(<client.TreeName tree={tree} />);

    expect(island.pageTrees).toEqual(["/tree.json"]);
    expect(island.tree).not.toContain("Docs");
    expect(render(island)).toBe("<span>Served</span>");
  });

  it("throws on functions in the props of client components", async () => {
    await expect(serializeIsland(<Counter onClick={() => undefined} />)).rejects.toThrow(
      "the props of the client component <Counter> must be serializable",
    );
  });

  it("renders the children of the Astro component at `AstroContent`", async () => {
    const island = await serializeIsland(
      <Card title="wrapper">
        <AstroContent />
      </Card>,
    );

    expect(render(island, createElement("astro-slot", null, "content"))).toBe(
      '<section data-card=""><h3>wrapper</h3><astro-slot>content</astro-slot></section>',
    );
  });

  it("renders Astro content into slots, also in props", async () => {
    const Content = () => new Response();
    const island = await serializeIsland(
      <Card title={<AstroContent component={Content} />}>
        <AstroContent component={Content} />
      </Card>,
    );

    expect(island.slots).toEqual([Content, Content]);
    expect(render(island)).toBe(
      '<section data-card=""><h3><astro-slot name="s0"></astro-slot></h3><astro-slot name="s1"></astro-slot></section>',
    );
  });
});

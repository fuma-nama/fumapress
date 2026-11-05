// @vitest-environment jsdom
import { act } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { createIsland } from "@/island/island";
import { modules, registerPageTree, registerReference } from "@/island/references";
import { serializeIsland } from "@/island/serialize";
import * as client from "./fixtures/client";
import registry from "./fixtures/client-references";
import { components } from "./fixtures/components";

const PressIsland = createIsland(components);
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let received: unknown;
const actions = {
  submit: async () => "sent",
  Form({ action }: { action: () => Promise<string> }) {
    received = action;
    return <form />;
  },
};
Object.assign(registry, { actions: async () => actions });

it("loads client references in the browser", async () => {
  registerReference("client", client);
  registerReference("actions", actions);
  const { tree } = await serializeIsland(
    <section>
      <client.Counter initial={1} />
      <actions.Form action={actions.submit} />
    </section>,
  );
  // the browser has no modules of the server, it imports them from the registry
  modules.clear();

  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => root.render(<PressIsland tree={tree} />));
  await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
  expect(container.innerHTML).toBe(
    '<section><button type="button">count 1</button><form></form></section>',
  );
  expect(received).toBe(actions.submit);

  await act(async () => container.querySelector("button")!.click());
  expect(container.textContent).toBe("count 2");
  root.unmount();

  // loaded modules render without suspending
  const next = createRoot(container);
  act(() => next.render(<PressIsland tree={tree} />));
  expect(container.textContent).toBe("count 1");
  next.unmount();
});

it("hydrates when client component modules load at different times", async () => {
  const first = { First: () => <b>first</b> };
  const second = { Second: () => <i>second</i> };
  let loadSecond!: () => void;
  Object.assign(registry, {
    first: async () => first,
    second: () => new Promise((resolve) => (loadSecond = () => resolve(second))),
  });
  registerReference("first", first);
  registerReference("second", second);
  const { tree } = await serializeIsland(
    <p>
      <first.First />
      <second.Second />
    </p>,
  );
  const container = document.createElement("div");
  container.innerHTML = renderToString(<PressIsland tree={tree} />);
  modules.clear();

  const errors: unknown[] = [];
  const root = await act(async () =>
    hydrateRoot(container, <PressIsland tree={tree} />, {
      onRecoverableError: (error) => errors.push(error),
    }),
  );
  await act(async () => loadSecond());
  expect(errors).toEqual([]);
  expect(container.innerHTML).toBe("<!--$--><p><b>first</b><i>second</i></p><!--/$-->");
  root.unmount();
});

it("reloads once when a page tree is gone, then reports it, with one fetch per page", async () => {
  registerReference("client", client);
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async () => new Response(null, { status: 404 }));
  const reload = vi.fn();
  vi.stubGlobal("location", { reload });
  const report = vi.spyOn(console, "error").mockImplementation(() => undefined);

  async function renderTree(url: string) {
    const tree = { name: "Docs", children: [] };
    registerPageTree(tree, url, tree);
    const island = await serializeIsland(<client.TreeName tree={tree} />);
    // the browser has the page tree of no page yet
    modules.delete(url);
    const root = createRoot(document.createElement("div"));
    await act(async () => root.render(<PressIsland tree={island.tree} />));
    await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
    await act(async () => root.render(<PressIsland tree={island.tree} />));
    root.unmount();
  }

  await renderTree("/gone.json");
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(reload).toHaveBeenCalledTimes(1);
  expect(report).not.toHaveBeenCalledWith(
    expect.objectContaining({ message: expect.stringContaining("/gone.json") }),
  );

  // the page after the reload, its session tried this file
  sessionStorage.setItem("fumapress:reloaded:/still-gone.json", "1");
  await renderTree("/still-gone.json");
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(reload).toHaveBeenCalledTimes(1);
  expect(report).toHaveBeenCalledWith(
    expect.objectContaining({ message: expect.stringContaining("/still-gone.json") }),
  );

  fetch.mockRestore();
  report.mockRestore();
  vi.unstubAllGlobals();
});

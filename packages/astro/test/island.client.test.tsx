// @vitest-environment jsdom
import { act, createElement, Fragment, memo, type ReactNode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { createIsland } from "@/client";
import { modules, registerReference } from "@/island/references";
import { serializeIsland } from "@/island/serialize";
import * as layout from "@/ui/layout-root";
import * as client from "./fixtures/client";
import registry from "./fixtures/client-references";
import { PressIsland } from "./fixtures/components";

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

it("renders the React root of an `.astro` layout with the props of the page and its own", async () => {
  registerReference("layout", layout);
  Object.assign(registry, { layout: async () => layout });
  const Static = memo(() => <em>static</em>);
  const pageProps = { title: "Docs", kind: "page", banner: <Static /> };
  const { tree } = await serializeIsland(createElement(layout.LayoutRoot, pageProps), true);
  modules.clear();

  function Root(props: {
    title?: string;
    kind: string;
    own: string;
    banner?: ReactNode;
    children?: ReactNode;
  }) {
    return (
      <main data-title={props.title} data-kind={props.kind} data-own={props.own}>
        {props.banner}
        {props.children}
      </main>
    );
  }
  const Island = createIsland(Root);

  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <Island island={tree} own="yes" kind="own">
        <b>child</b>
      </Island>,
    ),
  );
  await act(() => new Promise((resolve) => setTimeout(resolve, 10)));

  const main = container.querySelector("main");
  expect(main?.dataset).toMatchObject({ title: "Docs", kind: "own", own: "yes" });
  expect(main?.innerHTML).toBe('<div style="display: contents;"><em>static</em></div><b>child</b>');
  root.unmount();
});

it("reports a layout that forgets the `island` prop", () => {
  const report = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const Island = createIsland(function DocsRoot() {
    return null;
  });
  expect(() => renderToString(<Island {...({} as { island: never })} />)).toThrow(
    "pass the `island` prop of the `.astro` layout to <DocsRoot>",
  );
  report.mockRestore();
});

it("keeps client state per page, a persisted island reuses its position", async () => {
  registerReference("client", client);
  const page = (url: string) =>
    serializeIsland(
      <Fragment key={url}>
        <client.Counter initial={0} />
      </Fragment>,
    );
  const [first, same, next] = await Promise.all([page("/a"), page("/a"), page("/b")]);
  const container = document.createElement("div");
  const root = createRoot(container);
  const render = (tree: string) => act(async () => root.render(<PressIsland tree={tree} />));

  await render(first.tree);
  await act(async () => container.querySelector("button")!.click());
  const clicked = container.textContent;
  expect(clicked).toBe("count 1");

  await render(same.tree);
  expect(container.textContent).toBe(clicked);
  await render(next.tree);
  expect(container.textContent).toBe("count 0");
});

// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { createIsland } from "@/island/island";
import { modules, registerReference } from "@/island/references";
import { serializeIsland } from "@/island/serialize";
import * as client from "./fixtures/client";
import { components } from "./fixtures/components";

const PressIsland = createIsland(components);

it("loads client components in the browser", async () => {
  registerReference("client", client);
  const { tree } = await serializeIsland(
    <section>
      <client.Counter initial={1} />
    </section>,
  );
  // the browser has no modules of the server, it imports them from the registry
  modules.clear();

  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => root.render(<PressIsland tree={tree} />));
  await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
  expect(container.innerHTML).toBe('<section><button type="button">count 1</button></section>');

  await act(async () => container.querySelector("button")!.click());
  expect(container.textContent).toBe("count 2");
  root.unmount();
});

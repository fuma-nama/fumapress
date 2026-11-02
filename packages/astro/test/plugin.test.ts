import type { Plugin } from "vite";
import { describe, expect, it } from "vitest";
import { clientReferences, isClientModule } from "@/island/plugin";

type Hook = (this: unknown, ...args: unknown[]) => unknown;

function hook(plugin: Plugin, name: "load" | "transform"): Hook {
  return (plugin[name] as { handler: Hook }).handler;
}

describe("client references", () => {
  it("detects the leading directive only", () => {
    expect(isClientModule('"use client";\nexport const a = 1;')).toBe(true);
    expect(isClientModule("'use client'\nexport const a = 1;")).toBe(true);
    expect(isClientModule("// comment\n/** doc */\n'use strict';\n\"use client\";")).toBe(true);
    expect(isClientModule("import a from 'a';\n'use client';")).toBe(false);
    expect(isClientModule("export const a = 'use client';")).toBe(false);
    expect(isClientModule("'use server';")).toBe(false);
  });

  it("registers the modules of server environments", async () => {
    const plugin = clientReferences("/references.js");
    const transform = hook(plugin, "transform");
    const code = "'use client';\nexport function A() {}";

    const output = await transform.call({ environment: { name: "ssr" } }, code, "/a.js");
    expect(output).toMatch(/^'use client';\nexport function A\(\) \{\}\n/);
    expect(output).toContain('import * as __fumapress_module from "/a.js";');
    expect(output).toContain(
      'import { registerReference as __fumapress_register } from "/references.js";',
    );
    expect(
      await transform.call({ environment: { name: "client" } }, code, "/a.js"),
    ).toBeUndefined();
    expect(
      await transform.call({ environment: { name: "ssr" } }, "export {}", "/b.js"),
    ).toBeUndefined();
  });

  it("imports the modules in the browser, sorted", async () => {
    const plugin = clientReferences("/references.js", ["/e.js"]);
    const transform = hook(plugin, "transform");
    for (const id of ["/z.js", "/a.js", "/e.js", "/m.js"])
      await transform.call({ environment: { name: "prerender" } }, "'use client';", id);
    const load = hook(plugin, "load");

    expect(await load.call({ environment: { name: "ssr" } })).toBe("export default {};");
    const registry = (await load.call({ environment: { name: "client" } })) as string;
    const imports = registry.match(/import\("[^"]+"\)/g);
    expect(imports).toEqual(['import("/a.js")', 'import("/m.js")', 'import("/z.js")']);
    // keys, not the paths of the machine, are in pages
    expect(registry).toMatch(/^ {2}"[\w-]{12}": \(\) => import\("\/a\.js"\),$/m);
    // eager modules are registered as they load
    expect(registry).toContain('import * as eager0 from "/e.js";');
    expect(registry).toMatch(/^registerReference\("[\w-]{12}", eager0\);$/m);
  });
});

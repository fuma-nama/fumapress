import { createHash } from "node:crypto";
import type { Plugin, ViteDevServer } from "vite";

const registryId = "virtual:fumapress/client-references";
const resolvedRegistryId = `\0${registryId}`;

/** the `'use client'` directive, after comments and other directives */
const clientDirective =
  /^(?:\s|\/\/[^\n]*|\/\*[\s\S]*?\*\/|(["'])[^"'\n]*\1;?)*?(["'])use client\2/;

/** a module starting with the `'use client'` directive */
export function isClientModule(code: string): boolean {
  return clientDirective.test(code);
}

/** the key of a client component module in pages, its path stays on the machine of the build */
function referenceKey(id: string): string {
  return createHash("sha256").update(id).digest("base64url").slice(0, 12);
}

/**
 * Client references: on the server, `'use client'` modules register their exports into `references.ts`, the press island refers to them.
 *
 * In the browser, `virtual:fumapress/client-references` imports them by key. Astro builds the client after the server environments, so the registry of builds is complete.
 *
 * @param referencesModule - the module of `registerReference()`, `references.ts`
 * @param eager - modules registered with the registry in the browser, rather than imported on use
 */
export function clientReferences(referencesModule: string, eager: string[] = []): Plugin {
  const ids = new Set<string>();
  let server: ViteDevServer | undefined;

  /** in dev, the browser imports the new registry, its `import.meta.hot.accept()` merges it */
  function update() {
    const client = server?.environments.client;
    const module = client?.moduleGraph.getModuleById(resolvedRegistryId);
    if (!client || !module) return;
    client.moduleGraph.invalidateModule(module);
    client.hot.send({
      type: "update",
      updates: [
        { type: "js-update", path: module.url, acceptedPath: module.url, timestamp: Date.now() },
      ],
    });
  }

  return {
    name: "@fumapress/astro:client-references",
    configureServer(devServer) {
      server = devServer;
    },
    onLog(_level, log) {
      // the registry imports every client module lazily, the eager modules import some of them already
      if (log.code === "INEFFECTIVE_DYNAMIC_IMPORT" && log.message.includes(registryId))
        return false;
    },
    resolveId: {
      filter: { id: /^virtual:fumapress\/client-references$/ },
      handler: () => resolvedRegistryId,
    },
    load: {
      filter: { id: /^\0virtual:fumapress\/client-references$/ },
      handler() {
        if (this.environment.name !== "client") return "export default {};";
        let code = `import { registerReference } from ${JSON.stringify(referencesModule)};\n`;
        for (const [i, id] of eager.entries())
          code += `import * as eager${i} from ${JSON.stringify(id)};
registerReference(${JSON.stringify(referenceKey(id))}, eager${i});\n`;
        // sorted, the output of builds must not depend on the order of transforms
        code += "const references = {\n";
        for (const id of Array.from(ids).sort()) {
          if (!eager.includes(id))
            code += `  ${JSON.stringify(referenceKey(id))}: () => import(${JSON.stringify(id)}),\n`;
        }
        return `${code}};
export default references;
if (import.meta.hot) import.meta.hot.accept((next) => Object.assign(references, next?.default));`;
      },
    },
    transform: {
      filter: { code: "use client" },
      handler(code, id) {
        if (this.environment.name === "client" || !isClientModule(code)) return;
        if (!ids.has(id)) {
          ids.add(id);
          update();
        }
        // the namespace of the module itself has every export, re-exports too
        return `${code}
import * as __fumapress_module from ${JSON.stringify(id)};
import { registerReference as __fumapress_register } from ${JSON.stringify(referencesModule)};
__fumapress_register(${JSON.stringify(referenceKey(id))}, __fumapress_module);`;
      },
    },
  };
}

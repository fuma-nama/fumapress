/** an export of a client component module: the key of the module and the name of the export */
export type ClientReference = [key: string, name: string];

/** the client component modules on the server by key, registered by themselves, see `plugin.ts` */
export const modules = new Map<string, Record<string, unknown>>();
const pending: [key: string, module: Record<string, unknown>][] = [];
/** weak: revalidated content has new page trees */
const references = new WeakMap<object, ClientReference>();

/** called by client component modules on the server */
export function registerReference(key: string, module: Record<string, unknown>): void {
  modules.set(key, module);
  pending.push([key, module]);
}

/** whether `key` is the URL of a file like a page tree, which the browser fetches: the keys of modules have no `/` */
export function isFileKey(key: string): boolean {
  return key.startsWith("/");
}

/** `tree` as the export of the file at `url`, `served` is what the island gets on the server, as the browser does from the file */
export function registerPageTree(tree: object, url: string, served: object): void {
  references.set(tree, [url, "tree"]);
  modules.set(url, { tree: served });
}

/** the reference of a component from a client component module, or of a page tree */
export function getReference(component: unknown): ClientReference | undefined {
  // read on lookup: when a module registers, the exports of modules in an import cycle with it may be uninitialized
  for (let entry = pending.pop(); entry; entry = pending.pop()) {
    const [key, module] = entry;
    for (const [name, value] of Object.entries(module)) {
      // components: functions, and the objects of `memo()` and `forwardRef()`
      if (
        typeof value === "function" ||
        (typeof value === "object" && value && "$$typeof" in value)
      )
        references.set(value, [key, name]);
    }
  }
  return references.get(component as object);
}

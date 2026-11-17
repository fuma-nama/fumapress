import { collections as files } from "virtual:press/collections";
import { createCollection, type Collection } from "./collection";
import type { Source } from "./core/types";

export type { Collection } from "./collection";
export type { Source, SourceFile } from "./core/types";

/** the collections of the Vite plugin, by name */
export const collections: Record<string, Collection> = Object.fromEntries(
  Object.entries(files).map(([name, list]) => [name, createCollection(name, list)]),
);

/** the source of the first collection, for a site with one: `createPress(content)` */
export const content: Source = Object.values(collections)[0]?.toSource() ?? { files: [] };

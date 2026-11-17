import { collections as files } from "virtual:press/collections";
import { createCollection, type Collection, type CollectionConfig } from "./collection";
import type { Source } from "./core/types";

export type { Collection, CollectionConfig, ToSourceOptions } from "./collection";
export type { Source, SourceConfig, SourceFile } from "./core/types";

/** the collections of the Vite plugin, by name */
export const collections: Record<string, Collection> = Object.fromEntries(
  Object.entries(files).map(([name, list]) => [name, createCollection(name, list)]),
);

/** the source of the first collection, for a site with one: `createPress(content)` */
export const content: Source<CollectionConfig> = Object.values(collections)[0]?.toSource() ?? {
  files: [],
};

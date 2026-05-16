import * as base from "fumadocs-core/source/schema";
import z from "zod";

export const pageSchema = base.pageSchema;
export const metaSchema = base.metaSchema;

export const blogPageSchema = base.pageSchema.extend({
  tags: z.array(z.string()).optional(),
});

export const blogMetaSchema = base.metaSchema;

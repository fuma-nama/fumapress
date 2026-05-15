import * as base from "fumadocs-core/source/schema";
import z from "zod";

export const pageSchema = base.pageSchema.extend({
  layout: z.string().optional(),
});

export const metaSchema = base.metaSchema;

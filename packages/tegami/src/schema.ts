import { metaSchema, pageSchema } from "fumadocs-core/source/schema";
import { z } from "zod";

/**
 * Frontmatter schema for MDX files written by {@link fumapressPlugin}.
 *
 * Use with a Fumadocs MDX docs collection:
 *
 * ```ts
 * import { changelogPageSchema, changelogMetaSchema } from "@fumapress/tegami/schema";
 *
 * export const changelog = defineDocs({
 *   dir: "content/changelog",
 *   docs: { schema: changelogPageSchema },
 *   meta: { schema: changelogMetaSchema },
 * });
 * ```
 */
export const changelogPageSchema = pageSchema.extend({
  /** Release date (when the draft was applied). */
  date: z.coerce.date(),
  /** Package name → release info. */
  packages: z.record(
    z.string(),
    z.object({
      version: z.string(),
    }),
  ),
});

export const changelogMetaSchema = metaSchema;

export type ChangelogPageData = z.infer<typeof changelogPageSchema>;

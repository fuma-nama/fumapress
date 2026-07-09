import { z } from "zod";

const packagesSchema = z.looseObject({
  packages: z.record(
    z.string(),
    z.object({
      version: z.string(),
    }),
  ),
});

export type ChangelogPackages = Record<string, { version: string }>;

export function getPackages(data: object): ChangelogPackages | undefined {
  const parsed = packagesSchema.safeParse(data);
  return parsed.success ? parsed.data.packages : undefined;
}

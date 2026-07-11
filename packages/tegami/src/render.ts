import { dump } from "js-yaml";
import type { ChangelogEntry, WorkspacePackage } from "tegami";
import type z from "zod";
import type { changelogPageSchema } from "./schema";

export interface ChangelogPackageInfo {
  version: string;
}

export function renderEntryMdx(
  getByName: (name: string) => WorkspacePackage[],
  entry: ChangelogEntry,
  date: Date,
): string | undefined {
  const packages: Record<string, ChangelogPackageInfo> = {};

  for (const [name, config] of entry.packages) {
    if (!config.type) continue;
    for (const pkg of getByName(name)) {
      if (pkg.version) packages[pkg.name] = { version: pkg.version };
    }
  }

  if (Object.keys(packages).length === 0) return;

  const title = entry.subject ?? entry.sections[0]?.title ?? entry.filename;

  return `${toFrontmatter({ title, date, packages })}${formatSections(entry)}\n`;
}

function formatSections(entry: ChangelogEntry): string {
  const lines: string[] = [];
  for (const section of entry.sections) {
    lines.push(`${"#".repeat(section.depth)} ${section.title}`, "");
    if (section.content.trim()) lines.push(section.content.trim(), "");
  }
  return lines.join("\n").trim();
}

function toFrontmatter(data: z.input<typeof changelogPageSchema>): string {
  return `---\n${dump(data, { lineWidth: -1 }).trimEnd()}\n---\n\n`;
}

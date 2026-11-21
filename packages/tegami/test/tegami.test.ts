import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ChangelogEntry, TegamiPlugin, WorkspacePackage } from "tegami";
import { fumapressPlugin } from "../src/tegami.ts";

const temps: string[] = [];
afterEach(async () => {
  await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function entry(filename: string): ChangelogEntry {
  return {
    id: filename,
    filename,
    packages: new Map([["fumapress", { type: "patch" }]]),
    sections: [{ depth: 2, title: "Fix", content: "Fixed." }],
    getRawContent: () => "",
  } as ChangelogEntry;
}

async function applyDraft(plugin: TegamiPlugin, cwd: string, entries: ChangelogEntry[]) {
  const context = {
    cwd,
    graph: { getByName: () => [{ name: "fumapress", version: "1.0.0" } as WorkspacePackage] },
  };
  const draft = { getChangelogs: () => entries };
  await (plugin.applyDraft as (this: unknown, draft: unknown) => Promise<void>).call(
    context,
    draft,
  );
}

describe("fumapressPlugin", () => {
  it("creates a new output folder before writing into it", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "fumapress-tegami-"));
    temps.push(cwd);

    await applyDraft(fumapressPlugin({ dir: "content/changelog" }), cwd, [
      entry("2026-11-21-a.md"),
      entry("2026-11-21-b.md"),
    ]);

    expect((await readdir(path.join(cwd, "content/changelog"))).sort()).toEqual([
      "2026-11-21-a.mdx",
      "2026-11-21-b.mdx",
    ]);
  });
});

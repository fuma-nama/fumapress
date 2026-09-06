import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { assertNoPrerenderErrors } from "@/lib/prerender-errors";

const dirs: string[] = [];

/** an `RSC` output directory with one payload file per entry of `payloads` */
function rscDir(payloads: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "fumapress-test-"));
  dirs.push(dir);
  for (const [file, content] of Object.entries(payloads)) {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    writeFileSync(join(dir, file), content);
  }
  return dir;
}

const ok = '1:["$","div",null,{"children":"hello"}]\n0:{"root":"$1"}\n';
const broken = '0:{"root":"$L1"}\n1:E{"digest":""}\n';

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

test("passes clean payloads and a missing directory", async () => {
  await expect(assertNoPrerenderErrors(rscDir({ "R/_root.txt": ok }))).resolves.toBeUndefined();
  await expect(assertNoPrerenderErrors(join(tmpdir(), "missing-rsc"))).resolves.toBeUndefined();
});

test("ignores the marker inside serialized page content", async () => {
  const text = '1:["$","p",null,{"children":"1:E{\\"digest\\":\\"\\"}"}]\n0:{"root":"$1"}\n';
  await expect(assertNoPrerenderErrors(rscDir({ "R/docs.txt": text }))).resolves.toBeUndefined();
});

test("fails with the routes of broken payloads", async () => {
  const dir = rscDir({
    "R/_root.txt": broken,
    "R/docs/ok.txt": ok,
    "R/docs/broken.txt": broken,
  });

  const error = await assertNoPrerenderErrors(dir).catch((e: Error) => e.message);
  expect(error).toContain("threw while prerendering these pages");
  expect(error).toContain("\n/\n");
  expect(error).toContain("\n/docs/broken");
  expect(error).not.toContain("/docs/ok");
});

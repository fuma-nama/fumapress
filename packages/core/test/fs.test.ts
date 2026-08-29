import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { assertEsmApp } from "@/lib/fs";

const dirs: string[] = [];

function app(pkg: object | undefined, subDir = ""): string {
  const dir = mkdtempSync(join(tmpdir(), "fumapress-test-"));
  dirs.push(dir);
  if (pkg) writeFileSync(join(dir, "package.json"), JSON.stringify(pkg));
  const startDir = join(dir, subDir);
  mkdirSync(startDir, { recursive: true });
  return startDir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

test("accepts ESM packages", () => {
  expect(() => assertEsmApp(app({ type: "module" }))).not.toThrow();
});

test("rejects packages without a module type", () => {
  expect(() => assertEsmApp(app({}))).toThrow('add \'"type": "module"\'');
  expect(() => assertEsmApp(app({ type: "commonjs" }))).toThrow();
});

test("checks the nearest package.json upwards", () => {
  expect(() => assertEsmApp(app({ type: "module" }, "nested/dir"))).not.toThrow();
  expect(() => assertEsmApp(app({}, "nested/dir"))).toThrow();
});

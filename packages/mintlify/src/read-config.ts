import { readFileSync } from "node:fs";
import path from "node:path";
import { parseMintlifyDocsJson, type MintlifyDocsJson } from "./schema";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertInRoot(root: string, target: string) {
  const relative = path.relative(root, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(
      `[Fumapress Mintlify] Invalid $ref path "${target}": must stay within project root`,
    );
  }
}

function readJsonFile(filePath: string): unknown {
  const raw = readFileSync(filePath, "utf8");
  return JSON.parse(raw) as unknown;
}

function resolveValue(value: unknown, baseDir: string, root: string, stack: Set<string>): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => resolveValue(item, baseDir, root, stack));
  }

  if (!isObject(value)) return value;

  if ("$ref" in value && typeof value.$ref === "string") {
    const refPath = path.resolve(baseDir, value.$ref);
    assertInRoot(root, refPath);

    if (stack.has(refPath)) {
      throw new Error(`[Fumapress Mintlify] Circular $ref detected: ${refPath}`);
    }

    stack.add(refPath);
    const referenced = resolveValue(readJsonFile(refPath), path.dirname(refPath), root, stack);
    stack.delete(refPath);

    const { $ref: _ref, ...siblings } = value;
    if (!isObject(referenced) && Object.keys(siblings).length > 0) {
      return referenced;
    }

    if (isObject(referenced)) {
      const merged = { ...referenced, ...siblings };
      return resolveValue(merged, baseDir, root, stack);
    }

    return referenced;
  }

  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    out[key] = resolveValue(child, baseDir, root, stack);
  }
  return out;
}

export interface ReadMintlifyDocsOptions {
  /** Path to docs.json, relative to cwd or absolute. Default: `docs.json` */
  path?: string;
  /** Project root for validating $ref paths. Default: cwd */
  root?: string;
}

export function readMintlifyDocs(options: ReadMintlifyDocsOptions = {}): MintlifyDocsJson {
  const root = path.resolve(options.root ?? process.cwd());
  const configPath = path.resolve(root, options.path ?? "docs.json");
  const parsed = resolveValue(readJsonFile(configPath), path.dirname(configPath), root, new Set());

  if (!isObject(parsed)) {
    throw new Error(`[Fumapress Mintlify] Expected docs.json to resolve to an object`);
  }

  return parseMintlifyDocsJson(parsed);
}

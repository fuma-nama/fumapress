#!/usr/bin/env node

import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { cancel, confirm, intro, isCancel, log, outro, text } from "@clack/prompts";
import { Command } from "commander";
import { x } from "tinyexec";
import * as versionsPkg from "../../create-fumapress-versions/package.json";
import * as corePkg from "../../core/package.json";

type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

type CliOptions = {
  force?: boolean;
  install?: boolean;
  packageManager?: string;
  yes?: boolean;
};

const packageManagers = ["npm", "pnpm", "yarn", "bun"] as const;

const program = new Command()
  .name("create-fumapress")
  .description("Initialize a Fumapress app")
  .argument("[directory]", "directory to create the app in")
  .option("-y, --yes", "use defaults and install dependencies")
  .option("--force", "write files even when the target directory is not empty")
  .option("--install", "install dependencies after scaffolding")
  .option("--no-install", "skip dependency installation")
  .option("--package-manager <name>", "package manager to use: npm, pnpm, yarn, or bun")
  .parse(process.argv);

const [directory] = program.args as [string | undefined];
const options = program.opts<CliOptions>();

intro("create-fumapress");

const projectDirectory = options.yes
  ? (directory ?? "my-fumapress-app")
  : await promptProjectDirectory(directory);
const packageManager = getPackageManager(options.packageManager);
const shouldInstall = options.yes
  ? options.install !== false
  : (options.install ?? (await promptInstall(packageManager)));
const root = path.resolve(projectDirectory);
const name = toPackageName(path.basename(root));

await assertCanInitialize(root, Boolean(options.force));
await writeProject(root, name);

log.success(`Created ${path.relative(process.cwd(), root) || "."}`);

if (shouldInstall) {
  await installDependencies(root, packageManager);
}

printNextSteps(root, packageManager, shouldInstall);

async function promptProjectDirectory(initialValue?: string) {
  const value = await text({
    message: "Where should the Fumapress app be created?",
    placeholder: "my-fumapress-app",
    initialValue,
    validate(value) {
      if (!value?.trim()) return "Enter a directory name.";
    },
  });

  return unwrapPrompt(value);
}

async function promptInstall(packageManager: PackageManager) {
  const value = await confirm({
    message: `Install dependencies with ${packageManager}?`,
    initialValue: true,
  });

  return unwrapPrompt(value);
}

function unwrapPrompt<T>(value: T | symbol): T {
  if (isCancel(value)) {
    cancel("Operation cancelled.");
    process.exit(0);
  }

  return value as T;
}

function getPackageManager(value?: string): PackageManager {
  if (value) {
    if (isPackageManager(value)) return value;

    cancel(`Unsupported package manager: ${value}`);
    process.exit(1);
  }

  const userAgent = process.env.npm_config_user_agent;
  const detected = userAgent?.split("/")[0];

  if (detected && isPackageManager(detected)) return detected;

  return "npm";
}

function isPackageManager(value: string): value is PackageManager {
  return packageManagers.includes(value as PackageManager);
}

async function assertCanInitialize(root: string, force: boolean) {
  if (force) return;

  let entries: string[];

  try {
    entries = await readdir(root);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return;
    throw error;
  }

  if (entries.length > 0) {
    cancel(`Target directory is not empty: ${path.relative(process.cwd(), root) || "."}`);
    process.exit(1);
  }
}

async function writeProject(root: string, name: string) {
  await Promise.all(
    Object.entries(getFiles(name)).map(async ([file, content]) => {
      const target = path.join(root, file);

      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, content);
    }),
  );
}

function getFiles(name: string) {
  return {
    ".gitignore": `.DS_Store
/node_modules/

dist
.source
src/pages.gen.ts
`,
    "README.md": `# ${name}

This is a Fumapress app powered by Waku and Fumadocs.

## Development

\`\`\`sh
npm run dev
\`\`\`
`,
    "content/index.mdx": `---
title: My Page
description: Hello World
---

# Overview

This is my first document.
`,
    "package.json": `${JSON.stringify(getPackageJson(name), null, 2)}\n`,
    "press.config.tsx": `import { defineConfig } from "fumapress";
import { fumadocsMdx } from "fumapress/adapters/mdx";
import { flexsearchPlugin } from "fumapress/plugins/flexsearch";
import { llmsPlugin } from "fumapress/plugins/llms.txt";
import { takumiPlugin } from "fumapress/plugins/takumi";
import { loader } from "fumadocs-core/source";
import { docs } from "./.source/server";

export default defineConfig({
  loader: loader(docs.toFumadocsSource(), {
    baseUrl: "/",
  }),
  site: {
    name: "Fumapress",
  },
})
  .usePlugins(flexsearchPlugin(), llmsPlugin(), takumiPlugin())
  .useAdapters(fumadocsMdx());
`,
    "source.config.ts": `import { defineDocs } from "fumadocs-mdx/config";
import { metaSchema, pageSchema } from "fumapress/adapters/mdx/schema";

export const docs = defineDocs({
  dir: "content",
  docs: {
    async: true,
    schema: pageSchema,
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    schema: metaSchema,
  },
});
`,
    "src/app.css": `@import "tailwindcss";
@import "fumadocs-ui/css/neutral.css";
@import "fumadocs-ui/css/preset.css";
@import "fumapress/css/preset.css";
`,
    "tsconfig.json": `${JSON.stringify(getTsConfig(), null, 2)}\n`,
    "waku.config.ts": `import { defineConfig } from "waku/config";
import tailwindcss from "@tailwindcss/vite";
import press from "fumapress/vite";
import mdx from "fumadocs-mdx/vite";

export default defineConfig({
  vite: {
    plugins: [press(), mdx(), tailwindcss()],
  },
});
`,
  };
}

function getPackageJson(name: string) {
  return {
    name,
    private: true,
    type: "module",
    sideEffects: false,
    scripts: {
      dev: "waku dev",
      build: "waku build",
      start: "waku start",
      "types:check": "fumadocs-mdx && tsc --noEmit",
    },
    dependencies: { ...versionsPkg.dependencies, fumapress: corePkg.version },
    devDependencies: versionsPkg.devDependencies,
  };
}

function getTsConfig() {
  return {
    compilerOptions: {
      target: "ES2023",
      lib: ["dom", "dom.iterable", "ES2023"],
      jsx: "react-jsx",
      module: "ESNext",
      moduleResolution: "bundler",
      resolveJsonModule: true,
      allowJs: true,
      checkJs: true,
      esModuleInterop: true,
      forceConsistentCasingInFileNames: true,
      strict: true,
      skipLibCheck: true,
      noUncheckedIndexedAccess: true,
      noEmit: true,
    },
    exclude: ["node_modules", "dist"],
  };
}

async function installDependencies(root: string, packageManager: PackageManager) {
  const { command, args } = getInstallCommand(packageManager);

  log.step(`Installing dependencies with ${packageManager}...`);
  await x(command, args, { nodeOptions: { cwd: root } });
}

function getInstallCommand(packageManager: PackageManager) {
  switch (packageManager) {
    case "bun":
      return { command: "bun", args: ["install"] };
    case "pnpm":
      return { command: "pnpm", args: ["install"] };
    case "yarn":
      return { command: "yarn", args: ["install"] };
    case "npm":
      return { command: "npm", args: ["install"] };
  }
}

function printNextSteps(root: string, packageManager: PackageManager, installed: boolean) {
  const relativeRoot = path.relative(process.cwd(), root);
  const lines = ["Next steps:"];

  if (relativeRoot) lines.push(`  cd ${relativeRoot}`);
  if (!installed) lines.push(`  ${packageManager} install`);
  lines.push(`  ${getRunCommand(packageManager, "dev")}`);

  outro(lines.join("\n"));
}

function getRunCommand(packageManager: PackageManager, script: string) {
  if (packageManager === "npm") return `npm run ${script}`;
  if (packageManager === "bun") return `bun run ${script}`;
  return `${packageManager} ${script}`;
}

function toPackageName(value: string) {
  const name = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return name || "fumapress-app";
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

#!/usr/bin/env node

import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { cancel, confirm, intro, isCancel, log, outro, select, text } from "@clack/prompts";
import { cac } from "cac";
import { x } from "tinyexec";
import * as astroPkg from "../../astro/package.json";
import * as versionsPkg from "../../create-fumapress-versions/package.json";
import * as fumapressPkg from "../../fumapress/package.json";

type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

type CliOptions = {
  force?: boolean;
  framework?: string;
  install?: boolean;
  packageManager?: string;
  yes?: boolean;
};

const packageManagers = ["npm", "pnpm", "yarn", "bun"] as const;

const versions = {
  ...versionsPkg.dependencies,
  ...versionsPkg.devDependencies,
  fumapress: fumapressPkg.version,
  "@fumapress/astro": astroPkg.version,
};

type Dependency = keyof typeof versions;

const frameworks = {
  waku: {
    label: "Waku",
    scripts: {
      dev: "fumapress dev",
      build: "fumapress build",
      start: "fumapress start",
      "types:check": "tsc --noEmit",
    },
    dependencies: [
      "@base-ui/react",
      "fumadocs-core",
      "fumadocs-mdx",
      "fumadocs-ui",
      "fumapress",
      "react",
      "react-dom",
    ],
    devDependencies: [
      "@tailwindcss/vite",
      "@types/mdx",
      "@types/node",
      "@types/react",
      "@types/react-dom",
      "tailwindcss",
      "typescript",
      "vite",
    ],
  },
  astro: {
    label: "Astro",
    scripts: {
      dev: "astro dev",
      build: "astro build",
      preview: "astro preview",
      "types:check": "astro sync && tsc --noEmit",
    },
    dependencies: [
      "@astrojs/react",
      "@fumadocs/astro",
      "@fumapress/astro",
      "astro",
      "fumadocs-core",
      "fumadocs-ui",
      "react",
      "react-dom",
      "takumi-js",
    ],
    devDependencies: [
      "@tailwindcss/vite",
      "@types/mdx",
      "@types/react",
      "@types/react-dom",
      "tailwindcss",
      "typescript",
    ],
  },
} as const;

type Framework = keyof typeof frameworks;

const cli = cac("create-fumapress");

cli
  .command("[directory]", "Initialize a Fumapress app in the given directory")
  .option("-y, --yes", "use defaults and install dependencies")
  .option("--framework <name>", "framework to use: waku or astro")
  .option("--force", "write files even when the target directory is not empty")
  .option("--install", "install dependencies after scaffolding, or --no-install to skip")
  .option("--package-manager <name>", "package manager to use: npm, pnpm, yarn, or bun")
  .action(create);

// the only command is the default one, so cac's "run any command with --help" hint points at itself
cli.help((sections) => sections.filter((section) => !section.title?.startsWith("For more info")));

try {
  cli.parse();
} catch (error) {
  // cac reports unknown options and missing option values by throwing
  cancel(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

async function create(directory: string | undefined, options: CliOptions) {
  intro("create-fumapress");

  const projectDirectory = options.yes
    ? (directory ?? "my-fumapress-app")
    : await promptProjectDirectory(directory);
  const framework = await getFramework(options);
  const packageManager = getPackageManager(options.packageManager);
  const shouldInstall = options.yes
    ? options.install !== false
    : (options.install ?? (await promptInstall(packageManager)));
  const root = path.resolve(projectDirectory);
  const name = toPackageName(path.basename(root));

  await assertCanInitialize(root, Boolean(options.force));
  await writeProject(root, framework, name, packageManager);

  log.success(`Created ${path.relative(process.cwd(), root) || "."}`);

  if (shouldInstall) {
    await installDependencies(root, packageManager);
  }

  printNextSteps(root, packageManager, shouldInstall);
}

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

async function getFramework({ framework, yes }: CliOptions): Promise<Framework> {
  if (framework) {
    if (isFramework(framework)) return framework;

    cancel(`Unsupported framework: ${framework}`);
    process.exit(1);
  }

  if (yes) return "waku";

  const value = await select({
    message: "Which framework should the app use?",
    options: Object.entries(frameworks).map(([value, { label }]) => ({
      value: value as Framework,
      label,
    })),
  });

  return unwrapPrompt(value);
}

function isFramework(value: string): value is Framework {
  return Object.hasOwn(frameworks, value);
}

async function promptInstall(packageManager: PackageManager) {
  const value = await confirm({
    message: `Install dependencies with ${packageManager}?`,
    initialValue: true,
  });

  return unwrapPrompt(value);
}

function unwrapPrompt<T>(value: T | symbol): Exclude<T, symbol> {
  if (isCancel(value)) {
    cancel("Operation cancelled.");
    process.exit(0);
  }

  return value as Exclude<T, symbol>;
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

async function writeProject(
  root: string,
  framework: Framework,
  name: string,
  packageManager: PackageManager,
) {
  await Promise.all(
    Object.entries(getFiles(framework, name, packageManager)).map(async ([file, content]) => {
      const target = path.join(root, file);

      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, content);
    }),
  );
}

function getFiles(framework: Framework, name: string, packageManager: PackageManager) {
  const files: Record<string, string> = {
    "README.md": `# ${name}

This is a Fumapress app powered by Fumadocs.

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
    "package.json": `${JSON.stringify(getPackageJson(framework, name), null, 2)}\n`,
  };

  if (framework === "astro") {
    return Object.assign(files, {
      ".gitignore": `.DS_Store
/node_modules/

.env
.env.local
dist
.astro
`,
      "astro.config.mjs": `// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import press from "@fumapress/astro";

export default defineConfig({
  // the URL where your site is deployed, needed for SEO features like sitemap:
  // site: "https://example.com",
  integrations: [
    press({
      collections: { docs: { dir: "content" } },
      lastModified: true,
      includeProcessedMarkdown: true,
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
`,
      "press.config.tsx": `import { getCollection } from "astro:content";
import { toFumadocsSource } from "@fumadocs/astro/source";
import { createPress } from "@fumapress/astro/config";

export default createPress(
  toFumadocsSource(await getCollection("docs"), await getCollection("meta")),
).config({
  site: {
    name: ${JSON.stringify(name)},
  },
});
`,
      "src/app.css": `@import "@fumapress/astro/css/default.css";
`,
      "src/content.config.ts": `import { defineCollection } from "astro:content";
import { metaLoader, pageLoader } from "@fumadocs/astro/loaders";

export const collections = {
  docs: defineCollection({ loader: pageLoader() }),
  meta: defineCollection({ loader: metaLoader() }),
};
`,
      "tsconfig.json": `{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"],
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "react"
  }
}
`,
    });
  }

  Object.assign(files, {
    ".gitignore": `.DS_Store
/node_modules/

.env
.env.local
dist
.source
src/pages.gen.ts
`,
    "press.config.tsx": `import { createPress } from "fumapress";
import { metaSchema, pageSchema } from "fumapress/schema";
import { defineDocs } from "fumadocs-mdx/macro";

const docs = defineDocs({
  dir: "content",
  docs: {
    async: true,
    schema: pageSchema,
    lastModified: true,
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    schema: metaSchema,
  },
});

export default createPress(docs.toFumadocsSource()).config({
  site: {
    name: ${JSON.stringify(name)},
    // the URL where your site is deployed, needed for SEO features like sitemap:
    // baseUrl: "https://example.com",
  },
  head: [
    { tag: "link", attrs: { rel: "preconnect", href: "https://fonts.googleapis.com" } },
    { tag: "link", attrs: { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" } },
    {
      tag: "link",
      attrs: {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Geist:ital,wght@0,100..900;1,100..900&family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&display=swap",
      },
    },
  ],
});
`,
    "src/app.css": `@import "tailwindcss";
@import "fumadocs-ui/css/neutral.css";
@import "fumadocs-ui/css/preset.css";
@import "fumapress/css/preset.css";

@theme {
  --font-mono: "JetBrains Mono", monospace;
  --default-font-family: "Geist", sans-serif;
}
`,
    "tsconfig.json": `${JSON.stringify(getTsConfig(), null, 2)}\n`,
    "vite.config.ts": `import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import press from "fumapress/vite";
import { fumadocsMdx } from "fumadocs-mdx/vite";

export default defineConfig({
  plugins: [press(), fumadocsMdx(), tailwindcss()],
});
`,
  });

  if (packageManager === "pnpm") {
    // pnpm fails the install on unapproved build scripts, esbuild doesn't need its own
    files["pnpm-workspace.yaml"] = `allowBuilds:
  esbuild: false
`;
  }

  return files;
}

function getPackageJson(framework: Framework, name: string) {
  const { scripts, dependencies, devDependencies } = frameworks[framework];

  return {
    name,
    private: true,
    type: "module",
    sideEffects: false,
    scripts,
    dependencies: getVersions(dependencies),
    devDependencies: getVersions(devDependencies),
  };
}

function getVersions(names: readonly Dependency[]) {
  const out: Record<string, string> = {};
  for (const name of names) out[name] = versions[name];
  return out;
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

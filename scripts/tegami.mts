import { tegami } from "tegami";
import { runCli } from "tegami/cli";
import { github } from "tegami/plugins/github";
import { x } from "tinyexec";

const paper = tegami({
  npm: {
    updateLockFile: true,
  },
  plugins: [
    github({
      repo: "fuma-nama/fumapress",
      versionPr: {
        base: "dev",
      },
    }),
    {
      name: "build",
      async willPublish({ pkg }) {
        await x("pnpm", ["turbo", "run", "build", `--filter=${pkg.name}`], {
          throwOnError: true,
        });
      },
    },
  ],
  ignore: ["docs", "shared", "@repo/typescript-config", "root", /^example-/],
  groups: {
    fumapress: {
      syncBump: true,
      syncGitTag: true,
    },
    cli: {
      syncBump: true,
      syncGitTag: true,
    },
  },
  packages: {
    fumapress: { group: "fumapress" },
    "@fumapress/ai": { group: "fumapress" },
    "@fumapress/feedback": { group: "fumapress" },
    "create-fumapress": { group: "cli" },
    "create-fumapress-versions": { group: "cli" },
  },
});

void runCli(paper);

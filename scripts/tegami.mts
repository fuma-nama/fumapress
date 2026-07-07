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
  packages: ({ name }) => {
    switch (name) {
      case "create-fumapress":
        return { group: "cli" };
      case "create-fumapress-versions":
        return { group: "cli" };
    }
    if (name === "fumapress" || name.startsWith("@fumapress/")) return { group: "fumapress" };
  },
});

void runCli(paper);

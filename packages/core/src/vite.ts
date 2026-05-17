import type { Plugin } from "vite";
import { crawlFrameworkPkgs } from "./lib/vitefu";

export interface PluginOptions {
  /**
   * Auto-generate Vite config to handle CJS bundling.
   *
   * @default true
   */
  generateViteConfig?: boolean;
}

export default function press(options: PluginOptions = {}): Plugin {
  const { generateViteConfig = true } = options;

  return {
    name: "fumapress:core",
    async config(_, { command }) {
      if (!generateViteConfig) return;

      const out = await crawlFrameworkPkgs({
        root: process.cwd(),
        isBuild: command === "build",
        isFrameworkPkgByName(pkgName) {
          if (
            pkgName.startsWith("@fumapress/") ||
            pkgName.startsWith("@fumadocs/") ||
            pkgName.startsWith("fumadocs-") ||
            pkgName.startsWith("fumapress-") ||
            pkgName === "fumapress"
          )
            return true;
          switch (pkgName) {
            case "vite":
            case "waku":
            case "shiki":
              return false;
          }
        },
      });

      return {
        ssr: {
          noExternal: out.ssr.noExternal,
          external: ["@takumi-rs/image-response"],
        },
        optimizeDeps: out.optimizeDeps,
      };
    },
    async resolveId(source, _importer, options) {
      if (source === "virtual:fumapress-core/config") {
        return this.resolve("/press.config", undefined, options);
      }

      if (source === "virtual:root.css?inline") {
        return (
          (await this.resolve(`/src/app.css?inline`)) ??
          (await this.resolve(`fumapress/css/default.css?inline`))
        );
      }
    },
    async load(id) {
      if (id === "\0virtual:vite-rsc-waku/server-entry-inner") {
        return getManagedServerEntry();
      }
    },
  };
}

function getManagedServerEntry() {
  return `import adapter from 'waku/adapters/default';
import pressConfig from 'virtual:fumapress-core/config';
import { createRouter } from 'fumapress/router';

const router = createRouter(pressConfig);

export default adapter(router.createPages());
`;
}

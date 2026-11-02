import { getCollection } from "astro:content";
import { toFumadocsSource } from "@fumadocs/astro/source";
import { defineConfig } from "@fumapress/astro/config";
import { linkValidationPlugin } from "@fumapress/core/plugins/link-validation";
import { openapiPlugin } from "fumadocs-openapi/plugin";
import { createOpenAPI } from "fumadocs-openapi/server";

const openapi = createOpenAPI({
  input: ["./openapi.yaml"],
});

export default defineConfig({
  content: {
    docs: {
      ...toFumadocsSource(await getCollection("docs"), await getCollection("meta")),
      baseDir: "docs",
    },
    openapi: await openapi.staticSource({ baseDir: "docs/api" }),
  },
  site: {
    name: "Fumapress",
    git: {
      user: "fuma-nama",
      repo: "fumapress",
      branch: "main",
    },
  },
  plugins: [openapiPlugin({ server: openapi }), linkValidationPlugin()],
});

import { getCollection } from "astro:content";
import { toFumadocsSource } from "@fumadocs/astro/source";
import { createPress } from "@fumapress/astro/config";
import { linkValidationPlugin } from "@fumapress/astro/plugins/link-validation";
import openapiPlugin from "fumadocs-openapi/press";
import { createOpenAPI } from "fumadocs-openapi/server";

const openapi = createOpenAPI({
  input: ["./openapi.yaml"],
});

export const app = createPress({
  docs: toFumadocsSource(await getCollection("docs"), await getCollection("meta"), {
    baseDir: "docs",
  }),
  openapi: await openapi.staticSource({ baseDir: "docs/api" }),
}).plugins(openapiPlugin({ server: openapi }), linkValidationPlugin());

export default app.config({
  site: {
    name: "Fumapress",
    git: {
      user: "fuma-nama",
      repo: "fumapress",
      branch: "main",
    },
  },
});

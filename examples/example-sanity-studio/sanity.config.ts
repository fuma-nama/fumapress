import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { visionTool } from "@sanity/vision";
import { schemaTypes } from "./schemaTypes";
import { codeInput } from "@sanity/code-input";

export default defineConfig({
  name: "default",
  title: "Fumapress Sanity",

  projectId: process.env.SANITY_STUDIO_PROJECT_ID!,
  dataset: process.env.SANITY_STUDIO_DATASET!,

  plugins: [codeInput(), structureTool(), visionTool()],

  schema: {
    types: schemaTypes,
  },
});

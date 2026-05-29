import type { MintlifyDocsJson } from "@/schema";

export const minimalDocs: MintlifyDocsJson = {
  theme: "mint",
  name: "Example Docs",
  colors: { primary: "#000000" },
  navigation: {
    pages: ["getting-started", "guides/setup"],
  },
};

export const multilingualDocs: MintlifyDocsJson = {
  theme: "mint",
  name: "Multilingual Docs",
  colors: { primary: "#000000" },
  navigation: {
    languages: [
      {
        language: "en",
        default: true,
        pages: ["getting-started"],
      },
      {
        language: "zh-Hans",
        pages: ["getting-started-cn"],
      },
    ],
  },
};

export const openapiDocs: MintlifyDocsJson = {
  theme: "mint",
  name: "API Docs",
  colors: { primary: "#000000" },
  navigation: { pages: ["overview"] },
  api: {
    openapi: [
      { source: "openapi/petstore.yaml", directory: "api-reference" },
      "openapi/legacy.json",
    ],
    playground: { proxy: false },
    url: "full",
  },
};

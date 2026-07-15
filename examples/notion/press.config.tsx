import { fumapressNotion, notionPlugin } from "@fumapress/notion";
import { Client } from "@notionhq/client";
import { defineConfig } from "fumapress";
import { flexsearchPlugin } from "fumapress/plugins/flexsearch";
import { llmsPlugin } from "fumapress/plugins/llms.txt";

const notion = fumapressNotion({
  client: new Client({ auth: getEnv("NOTION_TOKEN") }),
  dataSourceId: getEnv("NOTION_DATA_SOURCE_ID"),
});

export default defineConfig({
  content: notion.dynamicSource({
    properties: {
      title: "Name",
      slug: "Slug",
      description: "Description",
    },
    query: {
      filter: {
        property: "Published",
        checkbox: { equals: true },
      },
    },
  }),
  loaderOptions: { alwaysRevalidate: true },
  mode: "dynamic",
  site: {
    name: "Notion Example",
  },
}).plugins(notionPlugin(notion), llmsPlugin(), flexsearchPlugin());

function getEnv(name: "NOTION_TOKEN" | "NOTION_DATA_SOURCE_ID"): string {
  const value = process.env[name];
  if (value) return value;

  throw new Error(
    `[example-notion] Missing ${name}. Copy examples/notion/.env.example to .env.local and configure it.`,
  );
}

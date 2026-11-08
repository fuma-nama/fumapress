import { createNotion } from "@fumadocs/notion";
import notionPlugin from "@fumadocs/notion/press";
import { Client } from "@notionhq/client";
import { createPress } from "fumapress";

const notion = createNotion({
  client: new Client({ auth: getEnv("NOTION_TOKEN") }),
  dataSourceId: getEnv("NOTION_DATA_SOURCE_ID"),
});

export default createPress(
  notion.dynamicSource({
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
  { alwaysRevalidate: true },
)
  .plugins(notionPlugin({ notion }))
  .config({
    site: {
      name: "Notion Example",
    },
  });

function getEnv(name: "NOTION_TOKEN" | "NOTION_DATA_SOURCE_ID"): string {
  const value = process.env[name];
  if (value) return value;

  throw new Error(
    `[example-notion] Missing ${name}. Copy examples/notion/.env.example to .env.local and configure it.`,
  );
}

# Notion example

This example pulls published pages from a Notion data source and renders their blocks with `@fumapress/notion`.

## Configure Notion

1. Create a Notion database with these properties:

   | Property      | Type     | Purpose                                        |
   | ------------- | -------- | ---------------------------------------------- |
   | `Name`        | Title    | Page title                                     |
   | `Slug`        | Text     | URL path, for example `guides/getting-started` |
   | `Description` | Text     | Optional page description                      |
   | `Published`   | Checkbox | Only checked pages are included                |

2. Create an internal Notion connection with the **Read content** capability.
3. Give the connection access to the database from its **Content access** tab, or from the database's **••• → Add connections** menu.
4. Open the database's settings, select **Manage data sources**, open the data source's **•••** menu, and select **Copy data source ID**.
5. Copy the environment template and enter the installation token and data source ID:

   ```sh
   cp examples/notion/.env.example examples/notion/.env.local
   ```

   ```ini
   NOTION_TOKEN=ntn_...
   NOTION_DATA_SOURCE_ID=...
   ```

Keep the token server-only and never commit `.env.local`.

## Run the example

From the repository root:

```sh
pnpm install
pnpm --filter example-notion dev
```

Add or edit a checked page in Notion, then reload the matching URL. For example, a `Slug` value of `guides/getting-started` is available at `/guides/getting-started`.

The example uses `alwaysRevalidate: true` for immediate feedback during development. Production sites should normally trigger `revalidateLoader()` from a trusted webhook or revalidation route instead.

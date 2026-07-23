# Obsidian example

This example renders the Markdown notes in `public/vault` directly with `@fumapress/obsidian`.

## Run the example

From the repository root:

```sh
pnpm install
pnpm --filter example-obsidian dev
```

Open the local URL printed by Waku. Edit a note in `examples/obsidian/public/vault` while the development server is running; the Obsidian Vite plugin invalidates the vault snapshot and reloads the page.

The example keeps its vault under `public/vault`, so attachments are available at `/vault/*`. A vault stored elsewhere can use the `url` option to point at an upload or asset-serving route instead.

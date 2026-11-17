---
title: Deployment
description: Build the site and put it online.
---

`vite build` prerenders every page to `.output/public`, and builds a server for routes rendered on demand.

```npm
npm run build
```

Set the `preset` of Nitro to deploy to a platform:

```ts title="vite.config.ts"
export default defineConfig({
  plugins: [press({ nitro: { preset: "vercel" } })],
});
```

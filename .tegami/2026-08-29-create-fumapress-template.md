---
packages:
  npm:create-fumapress: patch
---

### Clean up the starter template

- The generated `press.config.tsx` uses your project name as `site.name`, and drops imports of
  plugins it never registered (they are enabled by the recommended preset anyway).
- The generated `.gitignore` covers `.env` and `.env.local`, so new projects don't commit secrets.

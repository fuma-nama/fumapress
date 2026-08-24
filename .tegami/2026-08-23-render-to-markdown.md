---
packages:
  "npm:fumapress": minor
---

### Markdown for every route (`fumapress/markdown`)

Server components can now define their own Markdown form:

```tsx
import { asMarkdown, md } from "fumapress/markdown";

function Callout({ title, children }) {
  if (asMarkdown()) return md.linePrefix("> ")`**${title}**\n${children}`;

  return <div className="callout">...</div>;
}
```

Calling `asMarkdown()` is the opt-in: `md` renders interpolated React nodes, with
`md.linePrefix(prefix)` and `md.indent(size)` for nested blocks. Components that never call it are
kept as JSX syntax (`<Card title="...">...</Card>`), and so are client components, wrap those in a
server component to give them a Markdown form. `renderToMarkdown(node)` renders a tree yourself.

With `llmsPlugin({ routes: "all" })`, every page created with `createPage()` (`src/pages/index.tsx`,
blog pages, custom routes) whose component calls `asMarkdown()` gets a `.md` version: static pages
are pre-rendered, dynamic pages are rendered on request. Plugins can observe the pages of other
plugins with the new `prepareCreatePages()` hook, which runs before any page is created.

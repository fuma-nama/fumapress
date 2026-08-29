---
packages:
  npm:fumapress: patch
---

### Deprecate `createLayoutSwitchAuto`

Write a `renderPage` function switching on `page.type` instead, plain code with the same result:

```tsx
renderPage: (props) => {
  if (props.page.type === "blog") return <BlogPage {...props} />;

  return <DocsPage {...props} />;
},
```

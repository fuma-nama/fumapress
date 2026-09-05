---
packages:
  npm:fumapress: patch
  npm:@fumapress/ai: patch
  npm:@fumapress/feedback: patch
  npm:@fumapress/notion: patch
  npm:@fumapress/tegami: patch
---

### Swap `cnfast` for `cn`

Class name merging now runs on [`cn`](https://github.com/shadcn-ui/cn) instead of `cnfast`. Both are drop-in replacements for `clsx` + `tailwind-merge`, so merge behavior and the classes you get out are unchanged.

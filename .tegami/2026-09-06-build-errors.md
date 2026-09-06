---
packages:
  npm:fumapress: minor
---

### Fail the build on prerender errors

`fumapress build` now exits with an error naming every prerendered route whose server components threw, instead of shipping the page as a blank shell with the error in its RSC payload.

---
packages:
  "npm:@fumapress/tegami": patch
---

### Fixed the first release into a new folder

- `fumapressPlugin()` creates the `dir` folder before it writes the changelog files, so the first release into a new folder no longer fails.

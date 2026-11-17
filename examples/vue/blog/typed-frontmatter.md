---
title: Typed frontmatter
description: A schema checks the frontmatter of each post.
date: 2026-11-16
tags: [content, schema]
---

The schema of the blog extends `pageSchema` with a `date` and `tags`. A post without a date fails the build, and the view of `/blog` reads `page.data.date` as a string.

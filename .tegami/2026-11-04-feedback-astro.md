---
packages:
  "npm:@fumapress/feedback": minor
---

### Feedback on Waku and Astro

- `feedbackPlugin()`, `githubFeedbackPlugin()` and `emailFeedbackPlugin()` work on Waku and Astro, and no longer depend on `fumapress`.
- Page feedback is the `feedback` footer item, `props.footer.feedback` in `ui.renderPage`. It also shows on pages of the glass layout.
- Actions run on the server at `/api/feedback/page` and `/api/feedback/text`, they no longer need to be Server Functions. A `Response` an action throws is the answer, like the error of Resend in `emailFeedbackPlugin()`. An invalid page URL answers 400.
- Actions exported from `'use client'` modules still run in the browser, also with `mode: "static"`.
- `feedbackPlugin()` accepts `beforeRequest`, like the integrations.
- `githubFeedbackPlugin()` finds the existing discussion of a page instead of opening a new one for each feedback.

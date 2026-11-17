import { createLoad } from "@fumapress/vue/client";
import { createPressApp } from "./app.ts";

const base = import.meta.env.BASE_URL;
const root = document.getElementById("app")!;
const loaded = JSON.parse(document.getElementById("__PRESS__")!.textContent!);
const { pathname, search, hash } = window.location;
const { app, router } = await createPressApp(
  pathname + search + hash,
  base,
  // the language the server rendered the document in
  document.documentElement.lang,
  createLoad(base, loaded),
  // the not found page, which static hosts serve at any URL without a file
  root.hasAttribute("data-not-found"),
);

app.mount(root);
router.restoreScroll();

import { createLoad } from "@fumapress/vue/client";
import { createPressApp } from "./app.ts";

const base = import.meta.env.BASE_URL;
const loaded = JSON.parse(document.getElementById("__PRESS__")!.textContent!);
const { pathname, search, hash } = window.location;
const { app, router } = await createPressApp(
  pathname + search + hash,
  base,
  // the language the server rendered the document in
  document.documentElement.lang,
  createLoad(base, loaded),
);

app.mount("#app");
router.restoreScroll();

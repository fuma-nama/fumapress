import { createFromReadableStream } from "@vitejs/plugin-rsc/ssr";
import { loadPageTrees } from "./client-entry";

loadPageTrees((url) =>
  createFromReadableStream(new Response(globalThis.PAGE_TREE_FILES?.get(url)).body!),
);

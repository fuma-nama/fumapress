import { defineAsyncComponent } from "vue";
import type { Theme } from "@fumapress/vue/client";
import { components } from "./components";
import Root from "./Root.vue";

// before the first paint, so the page never flashes the other color theme: what the theme provider applies afterwards
const themeScript = `(()=>{try{var e=localStorage.getItem("theme")||"system",t=e==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):e,d=document.documentElement;d.classList.remove("light","dark");d.classList.add(t);if(t==="light"||t==="dark")d.style.colorScheme=t}catch(e){}})()`;

/** the base theme: the providers, the not found page and the components of Markdown, without layouts for the pages */
export default {
  Root,
  // another layout, which only a URL without a page needs
  NotFound: defineAsyncComponent(() => import("./NotFound.vue")),
  components,
  head: [{ tag: "script", content: themeScript }],
} satisfies Theme;

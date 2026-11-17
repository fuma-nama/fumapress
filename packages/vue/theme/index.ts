import type { Theme } from "@fumapress/vue/client";
import { components } from "./components";
import Layout from "./Layout.vue";
import Root from "./Root.vue";

export { default as Layout } from "./Layout.vue";
export { default as Root } from "./Root.vue";
export { components } from "./components";

// before the first paint, so the page never flashes the other color theme: what the theme provider applies afterwards
const themeScript = `(()=>{try{var e=localStorage.getItem("theme")||"system",t=e==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):e,d=document.documentElement;d.classList.remove("light","dark");d.classList.add(t);if(t==="light"||t==="dark")d.style.colorScheme=t}catch(e){}})()`;

/** the default theme: Fumadocs UI, with the docs layout for content pages */
export default {
  Root,
  Layout,
  components,
  head: [{ tag: "script", content: themeScript }],
} satisfies Theme;

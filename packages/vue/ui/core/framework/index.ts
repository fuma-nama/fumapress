import type { ComputedRef } from "vue";
import { useRouter } from "@fumapress/vue/client";

export { useRouter } from "@fumapress/vue/client";
export { default as Image } from "./Image.vue";

export interface ImageProps {
  src?: string;
  alt?: string;
  /**
   * priority of image
   */
  priority?: boolean;
}

/** the path of the page, without the base path */
export function usePathname(): ComputedRef<string> {
  return useRouter().path;
}

import type { HTMLAttributes, VNode } from "vue";

export { default as Files } from "./Files.vue";
export { default as File } from "./File.vue";
export { default as Folder } from "./Folder.vue";

export interface FileProps {
  class?: HTMLAttributes["class"];
  name: string;
  /** or the slot `icon` */
  icon?: string | VNode;
}

export interface FolderProps {
  name: string;

  disabled?: boolean;

  /**
   * Open folder by default
   *
   * @defaultValue false
   */
  defaultOpen?: boolean;
}

import type { HTMLAttributes } from "vue";

export { default as ThemeSwitch } from "./ThemeSwitch.vue";

export interface ThemeSwitchProps {
  mode?: "light-dark" | "light-dark-system";
  class?: HTMLAttributes["class"];
}

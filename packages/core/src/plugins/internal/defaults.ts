import { fumapressTranslations } from "@/i18n";
import type { PressPlugin } from "@/app/plugin";
import type { AppShape } from "@/app/context";

export function applyDefaultsPlugin<C extends AppShape>(): PressPlugin<C>[] {
  return [
    {
      name: "core:i18n",
      init() {
        if (this.translationsConfig) {
          this.translationsConfig.extend(fumapressTranslations());
        }
      },
    },
    {
      name: "core:disable-search-if-needed",
      enforce: "post",
      init() {
        const hooks = (this.data["core:provider"] ??= []);
        hooks.push((data) => {
          // search-feature plugins must set the `search` prop, otherwise will disable search by default.
          data.search ??= { enabled: false };
          return data;
        });
      },
    },
  ];
}

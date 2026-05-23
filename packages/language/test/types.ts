import { aiTranslations } from "@fumapress/ai/i18n";
import { feedbackTranslations } from "@fumapress/feedback/i18n";
import { defineI18n } from "fumadocs-core/i18n";
import { openapiTranslations } from "fumadocs-openapi/i18n";
import { uiTranslations } from "fumadocs-ui/i18n";
import { fumapressTranslations } from "fumapress/i18n";
import { zhCN } from "../src/zh-cn";
import { zhTW } from "../src/zh-tw";

const i18n = defineI18n({
  languages: ["en", "cn"],
  defaultLanguage: "en",
});

const t1 = i18n
  .translations()
  .extend(uiTranslations())
  .extend(openapiTranslations())
  .extend(fumapressTranslations())
  .extend(feedbackTranslations())
  .extend(aiTranslations())
  .preset("cn", zhCN());

const t2 = i18n
  .translations()
  .extend(uiTranslations())
  .extend(openapiTranslations())
  .extend(fumapressTranslations())
  .extend(feedbackTranslations())
  .extend(aiTranslations())
  .preset("cn", zhTW());

console.log(t1, t2);

import { describe, expect, it } from "vitest";
import { createApp, i18n } from "./fixtures";

describe("localizePath", () => {
  it("prefixes every language by default", async () => {
    const ctx = await createApp({ i18n });

    expect(ctx.localizePath("en", "/blog")).toBe("/en/blog");
    expect(ctx.localizePath("cn", "/")).toBe("/cn");
  });

  it("keeps the hidden default language unprefixed", async () => {
    const ctx = await createApp({ i18n: { ...i18n, hideLocale: "default-locale" } });

    expect(ctx.localizePath("en", "/blog")).toBe("/blog");
    expect(ctx.localizePath("cn", "/blog")).toBe("/cn/blog");
  });

  it("leaves paths alone without i18n", async () => {
    expect((await createApp()).localizePath(undefined, "/blog")).toBe("/blog");
    expect((await createApp({ i18n })).localizePath(undefined, "/blog")).toBe("/blog");
  });
});

import { describe, expect, it } from "vitest";
import { resolveIconComponent, iconNameOf } from "@/icons";

describe("iconNameOf", () => {
  it("supports string and object icons", () => {
    expect(iconNameOf("book")).toBe("book");
    expect(iconNameOf({ name: "book", library: "lucide" })).toBe("book");
    expect(iconNameOf(undefined)).toBeUndefined();
  });
});

describe("resolveIconComponent", () => {
  it("resolves lucide icon names", async () => {
    expect(await resolveIconComponent("book")).toBeTypeOf("object");
  });

  it("translates common Font Awesome names", async () => {
    expect(await resolveIconComponent("gear")).toBeTypeOf("object");
    expect(await resolveIconComponent("magnifying-glass")).toBeTypeOf("object");
  });

  it("returns undefined for unknown names", async () => {
    expect(await resolveIconComponent("this-icon-does-not-exist")).toBeUndefined();
  });
});

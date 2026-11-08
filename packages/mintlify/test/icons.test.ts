import { describe, expect, it } from "vitest";
import { resolveIconComponent } from "@/icons";

describe("resolveIconComponent", () => {
  it("resolves lucide icon names", async () => {
    expect(await resolveIconComponent("book")).toBeTypeOf("object");
  });

  it("translates common Font Awesome names", async () => {
    expect(await resolveIconComponent("magnifying-glass")).toBeTypeOf("object");
  });

  it("returns undefined for unknown names", async () => {
    expect(await resolveIconComponent("this-icon-does-not-exist")).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import { isClientModule } from "@/island/plugin";

describe("client references", () => {
  it("detects the leading directive only", () => {
    expect(isClientModule('"use client";\nexport const a = 1;')).toBe(true);
    expect(isClientModule("'use client'\nexport const a = 1;")).toBe(true);
    expect(isClientModule("// comment\n/** doc */\n'use strict';\n\"use client\";")).toBe(true);
    expect(isClientModule("import a from 'a';\n'use client';")).toBe(false);
    expect(isClientModule("export const a = 'use client';")).toBe(false);
    expect(isClientModule("'use server';")).toBe(false);
  });
});

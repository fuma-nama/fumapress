import { describe, expect, it } from "vitest";
import { PageTreeFiles } from "@/components/page-tree";

describe("PageTreeFiles", () => {
  it("keeps content without page trees as is, a clone would be validated by React again", () => {
    const element = (
      <div title="a">
        <span>a</span>
        <span>b</span>
      </div>
    );
    const list = [<span key="a" />, <span key="b" />];
    const nested = <section data-nav={{ title: <span>c</span> }}>{list}</section>;

    expect(PageTreeFiles({ children: element })).toBe(element);
    expect(PageTreeFiles({ children: list })).toBe(list);
    expect(PageTreeFiles({ children: nested })).toBe(nested);
  });
});

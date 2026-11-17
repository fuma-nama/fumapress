import { h, type FunctionalComponent, type SVGAttributes } from "vue";

/** the elements of an icon: a tag and its attributes */
export type IconNode = [tag: string, attrs: Record<string, string | number>][];

export interface IconProps extends /* @vue-ignore */ SVGAttributes {
  /** @defaultValue 24 */
  size?: number | string;
  /** @defaultValue "currentColor" */
  color?: string;
  /** @defaultValue 2 */
  strokeWidth?: number | string;
  /** keep the stroke the same width at any `size` */
  absoluteStrokeWidth?: boolean;
}

const hasA11yProp = (props: Record<string, unknown>) =>
  Object.keys(props).some((key) => key.startsWith("aria-") || key === "role" || key === "title");

/** an icon of Lucide: the `<svg>` that `@lucide/vue` renders, without the package */
export function createIcon(name: string, node: IconNode): FunctionalComponent<IconProps> {
  // without declared props, the attributes are the props, and `class` reaches the `<svg>` by itself
  return (props, { slots }) => {
    const {
      size = 24,
      color = "currentColor",
      strokeWidth,
      "stroke-width": strokeWidthKebab,
      absoluteStrokeWidth,
      "absolute-stroke-width": absoluteKebab,
      class: _,
      ...rest
    } = props as Record<string, unknown>;
    const children = slots.default?.() ?? [];
    const width = strokeWidth ?? strokeWidthKebab ?? 2;
    const absolute = absoluteStrokeWidth ?? absoluteKebab;

    return h(
      "svg",
      {
        xmlns: "http://www.w3.org/2000/svg",
        width: size,
        height: size,
        fill: "none",
        stroke: color,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        "stroke-width":
          absolute === true || absolute === "" ? (Number(width) * 24) / Number(size) : width,
        class: `lucide lucide-${name}`,
        viewBox: "0 0 24 24",
        ...(children.length === 0 && !hasA11yProp(rest) && { "aria-hidden": "true" }),
        ...rest,
      },
      [...node.map(([tag, attrs]) => h(tag, attrs)), ...children],
    );
  };
}

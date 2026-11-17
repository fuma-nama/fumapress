import type { Element, ElementContent, Nodes, Parents } from "hast";
import { Fragment, h, type Component, type IntrinsicElementAttributes, type VNodeChild } from "vue";

// A port of `fumadocs-core/utils/hast-to-jsx`. Vue differs from React in what it takes: attribute names as they are
// written in HTML (`tabindex`, `stroke-width`) instead of React props, `style` strings as they are, `innerHTML` for
// `dangerouslySetInnerHTML`, and the children of a component as its default slot.

export type Components = {
  [Tag in keyof IntrinsicElementAttributes]: Component | keyof IntrinsicElementAttributes;
};

/** an ESTree expression */
export interface Expression {
  type: string;
}

/** an ESTree program */
export interface Program {
  type: "Program";
  body: unknown[];
}

/** Turns the ESTree of MDX nodes into values. */
export interface Evaluator {
  evaluateExpression(expression: Expression): unknown;
  evaluateProgram(program: Program): unknown;
}

export interface ToJsxOptions {
  components?: Partial<Components>;
  /** Required by MDX expressions, ESM, and JSX elements with expressions or capitalized names. */
  evaluator?: Evaluator;
}

// the MDX nodes of `mdast-util-mdx`, which isn't a dependency
interface MdxEstree {
  data?: { estree?: Program | null };
}

interface MdxJsxAttribute {
  type: "mdxJsxAttribute";
  name: string;
  value?: string | null | ({ type: "mdxJsxAttributeValueExpression"; value: string } & MdxEstree);
}

interface MdxJsxExpressionAttribute extends MdxEstree {
  type: "mdxJsxExpressionAttribute";
  value: string;
}

interface MdxJsxElement {
  type: "mdxJsxFlowElement" | "mdxJsxTextElement";
  name: string | null;
  attributes: (MdxJsxAttribute | MdxJsxExpressionAttribute)[];
  children: Node[];
}

interface MdxExpression extends MdxEstree {
  type: "mdxFlowExpression" | "mdxTextExpression";
  value: string;
}

interface MdxjsEsm extends MdxEstree {
  type: "mdxjsEsm";
  value: string;
}

type Node = Nodes | MdxJsxElement | MdxExpression | MdxjsEsm;

/** the ESTree nodes `jsxType()` creates */
type EstreeNode = { type: string } & Record<string, unknown>;

interface State extends ToJsxOptions {
  components: Partial<Components>;
}

interface Schema {
  /** known names, lowercase or as React props, to the attributes of Vue */
  names: Map<string, string>;
  commaSeparated: string[];
}

// the names `property-information` 7 knows: React props, or attributes when they have `-` or `:`
// (`stroke-width`, `xlink:href`); capitalized ones are `on*` handlers, `aria` lists `aria*` properties
const aria =
  "ActiveDescendant Atomic AutoComplete Busy Checked ColCount ColIndex ColSpan Controls Current DescribedBy Details Disabled DropEffect ErrorMessage Expanded FlowTo Grabbed HasPopup Hidden Invalid KeyShortcuts Label LabelledBy Level Live Modal MultiLine MultiSelectable Orientation Owns Placeholder PosInSet Pressed ReadOnly Relevant Required RoleDescription RowCount RowIndex RowSpan Selected SetSize Sort ValueMax ValueMin ValueNow ValueText";
const common =
  "role className content crossOrigin download height href hrefLang id lang max media method min name Abort AfterPrint BeforePrint Cancel CanPlay CanPlayThrough Change Click Close Copy CueChange Cut DblClick Drag DragEnd DragEnter DragExit DragLeave DragOver DragStart Drop DurationChange Emptied Ended Error Focus HashChange Input Invalid KeyDown KeyPress KeyUp Load LoadedData LoadedMetadata LoadStart Message MouseDown MouseEnter MouseLeave MouseMove MouseOut MouseOver MouseUp Offline Online PageHide PageShow Paste Pause Play Playing PopState Progress RateChange Reset Resize Scroll Seeked Seeking Select Stalled Storage Submit Suspend TimeUpdate Toggle Unload VolumeChange Waiting ping referrerPolicy rel style tabIndex target title type width color event rev version property xlink:actuate xlink:arcrole xlink:href xlink:role xlink:show xlink:title xlink:type xmlns:xlink xmlns xml:base xml:lang xml:space";
const html: Schema = {
  names: createNames(
    "abbr accept accept-charset accessKey action allow allowFullScreen allowPaymentRequest allowUserMedia alpha alt as async autoCapitalize autoComplete autoFocus autoPlay blocking capture charSet checked cite closedBy colorSpace cols colSpan command commandFor contentEditable controls controlsList coords data dateTime decoding default defer dir dirName disabled draggable encType enterKeyHint fetchPriority form formAction formEncType formMethod formNoValidate formTarget headers hidden high htmlFor http-equiv imageSizes imageSrcSet inert inputMode integrity is isMap itemID itemProp itemRef itemScope itemType kind label language list loading loop low manifest maxLength minLength multiple muted nonce noModule noValidate AuxClick BeforeMatch BeforeToggle BeforeUnload Blur ContextLost ContextMenu ContextRestored FormData LanguageChange LoadEnd MessageError RejectionHandled ScrollEnd SecurityPolicyViolation SlotChange UnhandledRejection Wheel open optimum pattern placeholder playsInline popover popoverTarget popoverTargetAction poster preload readOnly required reversed rows rowSpan sandbox scope scoped seamless selected shadowRootClonable shadowRootCustomElementRegistry shadowRootDelegatesFocus shadowRootMode shadowRootSerializable shape size sizes slot span spellCheck src srcDoc srcLang srcSet start step translate typeMustMatch useMap value wrap writingSuggestions align aLink archive axis background bgColor border borderColor bottomMargin cellPadding cellSpacing char charOff classID clear code codeBase codeType compact declare face frame frameBorder hSpace leftMargin link longDesc lowSrc marginHeight marginWidth noResize noHref noShade noWrap object profile prompt rightMargin rules scheme scrolling standby summary text topMargin valueType vAlign vLink vSpace allowTransparency autoCorrect autoSave credentialless disablePictureInPicture disableRemotePlayback exportParts part prefix results security unselectable",
    false,
  ),
  commaSeparated: ["accept", "coords", "exportparts"],
};
const svg: Schema = {
  names: createNames(
    "about accent-height accumulate additive alignment-baseline alphabetic amplitude arabic-form ascent attributeName attributeType azimuth bandwidth baseline-shift baseFrequency baseProfile bbox begin bias by calcMode cap-height clip clip-path clipPathUnits clip-rule color-interpolation color-interpolation-filters color-profile color-rendering contentScriptType contentStyleType cursor cx cy d datatype defaultAction descent diffuseConstant direction display dur divisor dominant-baseline dx dy edgeMode editable elevation enable-background end exponent externalResourcesRequired fill fill-opacity fill-rule filter filterRes filterUnits flood-color flood-opacity focusable focusHighlight font-family font-size font-size-adjust font-stretch font-style font-variant font-weight format fr from fx fy g1 g2 glyph-name glyph-orientation-horizontal glyph-orientation-vertical glyphRef gradientTransform gradientUnits handler hanging hatchContentUnits hatchUnits horiz-adv-x horiz-origin-x horiz-origin-y ideographic image-rendering initialVisibility in in2 intercept k k1 k2 k3 k4 kernelMatrix kernelUnitLength keyPoints keySplines keyTimes kerning lengthAdjust letter-spacing lighting-color limitingConeAngle local marker-end marker-mid marker-start markerHeight markerUnits markerWidth mask maskContentUnits mask-type maskUnits mathematical mediaCharacterEncoding mediaContentEncodings mediaSize mediaTime mode nav-down nav-down-left nav-down-right nav-left nav-next nav-prev nav-right nav-up nav-up-left nav-up-right numOctaves observer offset Activate Begin End FocusIn FocusOut MouseWheel Repeat Show Zoom opacity operator order orient orientation origin overflow overlay overline-position overline-thickness paint-order panose-1 path pathLength patternContentUnits patternTransform patternUnits phase pitch playbackOrder pointer-events points pointsAtX pointsAtY pointsAtZ preserveAlpha preserveAspectRatio primitiveUnits propagate r radius refX refY rendering-intent repeatCount repeatDur requiredExtensions requiredFeatures requiredFonts requiredFormats resource restart result rotate rx ry scale seed shape-rendering side slope snapshotTime specularConstant specularExponent spreadMethod spacing startOffset stdDeviation stemh stemv stitchTiles stop-color stop-opacity strikethrough-position strikethrough-thickness string stroke stroke-dasharray stroke-dashoffset stroke-linecap stroke-linejoin stroke-miterlimit stroke-opacity stroke-width surfaceScale syncBehavior syncBehaviorDefault syncMaster syncTolerance syncToleranceDefault systemLanguage tableValues targetX targetY text-anchor text-decoration text-rendering textLength timelineBegin transformBehavior typeof to transform transform-origin u1 u2 underline-position underline-thickness unicode unicode-bidi unicode-range units-per-em values v-alphabetic v-mathematical vector-effect v-hanging v-ideographic vert-adv-y vert-origin-x vert-origin-y viewBox viewTarget visibility widths word-spacing writing-mode x x1 x2 xChannelSelector x-height y y1 y2 yChannelSelector z zoomAndPan",
    true,
  ),
  commaSeparated: ["g1", "g2", "glyph-name"],
};
const tableElements = new Set(["table", "tbody", "thead", "tfoot", "tr"]);
// `escapeHtml()` of `@vue/shared`
const escapable = /["&'<>]/g;
const escapes: Record<string, string> = {
  '"': "&quot;",
  "&": "&amp;",
  "'": "&#39;",
  "<": "&lt;",
  ">": "&gt;",
};
// `estree-util-is-identifier-name`
const identifier = /^[$_\p{ID_Start}][$_\p{Join_Control}\p{ID_Continue}]*$/u;
const mdxError = "Cannot handle MDX estrees without `evaluator`";

/**
 * Convert hast, with MDX nodes, into Vue nodes like `toJsxRuntime()` from `hast-util-to-jsx-runtime`, but faster.
 */
export function toJsx(tree: Nodes, { components = {}, evaluator }: ToJsxOptions = {}): VNodeChild {
  const state: State = { components, evaluator };
  const result = one(tree, state, html, undefined);
  if (result && typeof result !== "string") return result;
  return h(Fragment, result ? [result] : undefined);
}

function one(node: Node, state: State, schema: Schema, key: string | undefined): VNodeChild {
  if (node.type === "element") return element(node, state, schema, key);
  if (node.type === "text") return node.value;
  if (node.type === "root") return create(Fragment, {}, children(node, state, schema), key);
  if (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") {
    // attributes are passed as they are
    return create(
      node.name === null ? Fragment : jsxType(node.name, state),
      jsxProps(node.attributes, state.evaluator),
      children(node, state, schema === html && node.name === "svg" ? svg : schema),
      key,
    );
  }
  // Read as the types above: a package that declares these nodes for hast, like a Markdown parser of the project,
  // can leave out their `estree`.
  if (node.type === "mdxFlowExpression" || node.type === "mdxTextExpression")
    return evaluate((node as MdxExpression).data?.estree, state.evaluator) as VNodeChild;
  if (node.type === "mdxjsEsm") {
    const estree = (node as MdxjsEsm).data?.estree;
    if (!estree || !state.evaluator) throw new Error(mdxError);
    return state.evaluator.evaluateProgram(estree) as VNodeChild;
  }
}

function element(
  node: Element,
  state: State,
  parentSchema: Schema,
  key: string | undefined,
): VNodeChild {
  const schema = parentSchema === html && node.tagName.toLowerCase() === "svg" ? svg : parentSchema;
  const props: Record<string, unknown> = {};
  let align: string | undefined;

  for (const name in node.properties) {
    let value: unknown = node.properties[name];
    if (value === null || value === undefined || Number.isNaN(value)) continue;
    if (name === "children" || !Object.hasOwn(node.properties, name)) continue;

    const prop = propertyName(schema, name);
    if (Array.isArray(value)) {
      value = schema.commaSeparated.includes(prop)
        ? // a trailing empty item stays visible, like `comma-separated-tokens`
          (value.join(", ") + (value.at(-1) === "" ? ", " : "")).trim()
        : value.join(" ").trim();
    }

    if (prop === "style") {
      // Vue takes the `style` attribute as it is
      props.style = typeof value === "object" ? value : String(value);
    } else if (
      prop === "align" &&
      typeof value === "string" &&
      (node.tagName === "td" || node.tagName === "th")
    ) {
      align = value;
    } else {
      props[prop] = value;
    }
  }

  if (align) props.style = props.style ? [props.style, { textAlign: align }] : { textAlign: align };

  const type = Object.hasOwn(state.components, node.tagName)
    ? state.components[node.tagName as keyof Components]
    : node.tagName;
  const first = node.children[0];
  // Vue's work per element dominates highlighted code, its spans render as one HTML string
  if (
    typeof type === "string" &&
    first?.type === "element" &&
    first.tagName === "span" &&
    !state.components.span &&
    !tableElements.has(node.tagName)
  ) {
    const html = toHtml(node.children);
    if (html !== undefined) {
      props.innerHTML = html;
      return create(type, props, [], key);
    }
  }
  return create(type, props, children(node, state, schema), key);
}

/** spans with class, style and `data-*` attributes, and text, as the HTML Vue renders; `undefined` for other content */
function toHtml(nodes: ElementContent[]): string | undefined {
  let html = "";
  for (const node of nodes) {
    if (node.type === "text") {
      html += escape(node.value);
      continue;
    }
    if (node.type !== "element" || node.tagName !== "span") return;

    html += "<span";
    for (const name in node.properties) {
      const value = node.properties[name];
      if (value === null || value === undefined || Number.isNaN(value) || name === "children")
        continue;
      if (name === "style" && typeof value === "string") {
        html += ` style="${escape(value)}"`;
        continue;
      }
      const attribute = name === "className" ? "class" : name;
      if (attribute !== "class" && !attribute.startsWith("data-")) return;
      if (typeof value !== "string" && typeof value !== "number" && !Array.isArray(value)) return;
      html += ` ${attribute}="${escape(Array.isArray(value) ? value.join(" ").trim() : String(value))}"`;
    }

    const children = toHtml(node.children);
    if (children === undefined) return;
    html += `>${children}</span>`;
  }
  return html;
}

function escape(value: string): string {
  return value.replace(escapable, (char) => escapes[char]!);
}

function children(node: Parents | MdxJsxElement, state: State, schema: Schema): VNodeChild[] {
  const out: VNodeChild[] = [];
  const table = node.type === "element" && tableElements.has(node.tagName);
  let counts: Map<string, number> | undefined;

  for (const child of node.children as Node[]) {
    let result: VNodeChild;
    if (child.type === "text") {
      result = child.value;
    } else {
      let key: string | undefined;
      const name =
        child.type === "element"
          ? child.tagName
          : child.type === "mdxJsxFlowElement" || child.type === "mdxJsxTextElement"
            ? child.name
            : undefined;
      if (name) {
        counts ??= new Map();
        const count = counts.get(name) ?? 0;
        key = `${name}-${count}`;
        counts.set(name, count + 1);
      }

      result = one(child, state, schema, key);
      if (result === undefined) continue;
    }
    // white space in tables, the HTML parser drops it
    if (table && typeof result === "string" && isWhitespace(result)) continue;
    out.push(result);
  }

  return out;
}

/** children of elements are an array, the ones of components their default slot */
function create(
  type: unknown,
  props: Record<string, unknown>,
  list: VNodeChild[],
  key: string | undefined,
): VNodeChild {
  const { children: prop, ...rest } = props;
  const children = list.length > 1 ? list : list[0] || prop;
  if (key) rest.key = key;

  const component = type as Parameters<typeof h>[0];
  if (children === undefined || children === null) return h(component, rest);
  if (typeof type === "string" || type === Fragment) {
    return h(component, rest, Array.isArray(children) ? children : [children]);
  }
  return h(component, rest, { default: () => children });
}

/** capitalized and member names are evaluated, like `findComponentFromName()` of `hast-util-to-jsx-runtime` */
function jsxType(name: string, { components, evaluator }: State): unknown {
  let expression: EstreeNode | undefined;
  if (name.includes(".")) {
    for (const part of name.split(".")) {
      const property: EstreeNode = identifier.test(part)
        ? { type: "Identifier", name: part }
        : { type: "Literal", value: part };
      const computed = property.type === "Literal";
      expression = expression
        ? { type: "MemberExpression", object: expression, property, computed, optional: false }
        : property;
    }
  } else if (identifier.test(name) && !/^[a-z]/.test(name)) {
    expression = { type: "Identifier", name };
  }

  if (!expression)
    return Object.hasOwn(components, name) ? components[name as keyof Components] : name;
  if (!evaluator) throw new Error(mdxError);
  return evaluator.evaluateExpression(expression);
}

function jsxProps(
  attributes: (MdxJsxAttribute | MdxJsxExpressionAttribute)[],
  evaluator?: Evaluator,
): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  for (const attribute of attributes) {
    if (attribute.type === "mdxJsxExpressionAttribute") {
      Object.assign(props, evaluate(attribute.data?.estree, evaluator, true));
    } else if (attribute.value && typeof attribute.value === "object") {
      props[attribute.name] = evaluate(attribute.value.data?.estree, evaluator);
    } else {
      props[attribute.name] = attribute.value === null ? true : attribute.value;
    }
  }
  return props;
}

/** evaluate the expression of an MDX estree, or the argument of `{...spread}` */
function evaluate(estree?: Program | null, evaluator?: Evaluator, spread = false): unknown {
  if (!estree || !evaluator) throw new Error(mdxError);
  let { expression: value } = estree.body[0] as { expression: Expression };
  if (spread)
    value = (value as unknown as { properties: { argument: Expression }[] }).properties[0]!
      .argument;
  return evaluator.evaluateExpression(value);
}

/**
 * Known names to the attributes of Vue: HTML attributes are case-insensitive and written in lowercase, the ones of
 * SVG keep their case when `caseSensitive`. Handlers keep their React names, which are Vue's.
 */
function createNames(list: string, caseSensitive: boolean): Map<string, string> {
  const names = new Map([["class", "class"]]);
  for (const name of aria.split(" ")) {
    const prop = `aria-${name.toLowerCase()}`;
    names.set(prop, prop).set(`aria${name}`, prop).set(`aria${name.toLowerCase()}`, prop);
  }

  add(common, false);
  add(list, caseSensitive);
  function add(list: string, caseSensitive: boolean) {
    for (let name of list.split(" ")) {
      const handler = name.charCodeAt(0) < 97;
      if (handler) name = `on${name}`;
      const prop = name.replace(/[-:](.)/g, (_, char: string) => char.toUpperCase());
      const attribute =
        prop === "className"
          ? "class"
          : prop === "htmlFor"
            ? "for"
            : handler || caseSensitive
              ? name
              : name.toLowerCase();
      names.set(name, attribute).set(prop, attribute).set(prop.toLowerCase(), attribute);
    }
  }
  return names;
}

/** the Vue attribute of a hast property name, like `find()` of `property-information` */
function propertyName({ names }: Schema, name: string): string {
  if (name.startsWith("data-")) return name;
  return names.get(name) ?? names.get(name.toLowerCase()) ?? dataName(name);
}

/** unknown `dataFooBar` names become `data-foo-bar` */
function dataName(name: string): string {
  if (name.charCodeAt(4) === 45 || /-[a-z]/.test(name)) return name;
  if (!/^data[-\w.:]+$/i.test(name)) return name;

  const rest = name.slice(4).replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
  return rest.charCodeAt(0) === 45 ? `data${rest}` : `data-${rest}`;
}

/** inter-element white space, like `hast-util-whitespace` */
function isWhitespace(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code !== 32 && code !== 9 && code !== 10 && code !== 12 && code !== 13) return false;
  }
  return true;
}

import { Fragment, type ReactNode } from "react";

/**
 * Minimal inline-Markdown renderer for `banner.content` and
 * `errors.404.description` (Mintlify supports links, bold & italic there,
 * custom components are not supported).
 */
export function renderInlineMarkdown(content: string): ReactNode {
  const pattern =
    /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_|`([^`]+)`/g;
  const nodes: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(content)) !== null) {
    if (match.index > last) nodes.push(content.slice(last, match.index));

    const [, linkText, linkHref, bold, boldAlt, italic, italicAlt, code] = match;

    if (linkText !== undefined && linkHref !== undefined) {
      nodes.push(
        <a href={linkHref} rel="noreferrer noopener">
          {renderInlineMarkdown(linkText)}
        </a>,
      );
    } else if (bold !== undefined || boldAlt !== undefined) {
      nodes.push(<b>{renderInlineMarkdown((bold ?? boldAlt)!)}</b>);
    } else if (italic !== undefined || italicAlt !== undefined) {
      nodes.push(<i>{renderInlineMarkdown((italic ?? italicAlt)!)}</i>);
    } else if (code !== undefined) {
      nodes.push(<code>{code}</code>);
    }

    last = match.index + match[0].length;
  }

  if (last < content.length) nodes.push(content.slice(last));

  return nodes.map((node, i) => <Fragment key={i}>{node}</Fragment>);
}

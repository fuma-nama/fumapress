/** the sample site of the preview: its page tree, a guide, and API pages like the ones of `fumadocs-openapi` */
import type { ReactNode } from "react";
import type * as PageTree from "fumadocs-core/page-tree";
import type { TOCItemType } from "fumadocs-core/toc";
import { Callout } from "fumadocs-ui/components/callout";
import { Card, Cards } from "fumadocs-ui/components/card";
import { CodeBlock, Pre } from "fumadocs-ui/components/codeblock";
import { Heading } from "fumadocs-ui/components/heading";
import { BookOpenIcon, BracesIcon, KeyRoundIcon, PlugIcon, WebhookIcon } from "lucide-react";
import { cn } from "../../cn";
import { previewPath } from "./options";
import { tokenize, type TokenKind } from "./tokens";

export const href = (slug: string) => `${previewPath}/${slug}`;

/* API pages */

type Method = "GET" | "POST" | "PATCH" | "DELETE";

interface Field {
  name: string;
  type: string;
  required?: boolean;
  description: string;
}

export interface Operation {
  slug: string;
  title: string;
  method: Method;
  path: string;
  description: string;
  body?: Field[];
  response: Field[];
  example: string;
}

const customer: Field[] = [
  { name: "id", type: "string", required: true, description: "The ID of the customer." },
  { name: "email", type: "string", required: true, description: "The email address." },
  { name: "name", type: "string", description: "The full name." },
  { name: "created", type: "integer", required: true, description: "Unix time of creation." },
];

export const operations: Operation[] = [
  {
    slug: "api/customers/list",
    title: "List Customers",
    method: "GET",
    path: "/v1/customers",
    description: "Returns the customers of your account, newest first.",
    response: [
      { name: "data", type: "Customer[]", required: true, description: "A page of customers." },
      { name: "next", type: "string", description: "The cursor of the next page." },
    ],
    example: `curl https://api.acme.dev/v1/customers \\
  -H "Authorization: Bearer $ACME_API_KEY"`,
  },
  {
    slug: "api/customers/create",
    title: "Create Customer",
    method: "POST",
    path: "/v1/customers",
    description: "Creates a customer. The email address must be unique in your account.",
    body: [
      { name: "email", type: "string", required: true, description: "The email address." },
      { name: "name", type: "string", description: "The full name." },
      { name: "metadata", type: "object", description: "Key-value pairs of your own." },
    ],
    response: customer,
    example: `curl https://api.acme.dev/v1/customers \\
  -H "Authorization: Bearer $ACME_API_KEY" \\
  -d email="ada@example.com"`,
  },
  {
    slug: "api/customers/update",
    title: "Update Customer",
    method: "PATCH",
    path: "/v1/customers/{id}",
    description: "Updates the fields you pass and leaves the others unchanged.",
    body: [
      { name: "email", type: "string", description: "The email address." },
      { name: "name", type: "string", description: "The full name." },
    ],
    response: customer,
    example: `curl -X PATCH https://api.acme.dev/v1/customers/cus_123 \\
  -H "Authorization: Bearer $ACME_API_KEY" \\
  -d name="Ada Lovelace"`,
  },
  {
    slug: "api/customers/delete",
    title: "Delete Customer",
    method: "DELETE",
    path: "/v1/customers/{id}",
    description: "Deletes a customer and cancels their subscriptions.",
    response: [
      { name: "id", type: "string", required: true, description: "The ID of the customer." },
      { name: "deleted", type: "boolean", required: true, description: "Always true." },
    ],
    example: `curl -X DELETE https://api.acme.dev/v1/customers/cus_123 \\
  -H "Authorization: Bearer $ACME_API_KEY"`,
  },
];

/** the colors of `MethodLabel` in `fumadocs-openapi` */
const methodColors: Record<Method, string> = {
  GET: "text-green-600 dark:text-green-400",
  POST: "text-blue-600 dark:text-blue-400",
  PATCH: "text-orange-600 dark:text-orange-400",
  DELETE: "text-red-600 dark:text-red-400",
};

function MethodLabel({ method, className }: { method: Method; className?: string }) {
  return (
    <span className={cn("font-mono font-medium", methodColors[method], className)}>{method}</span>
  );
}

/* the page tree */

/** the page tree, with the API reference of `fumadocs-openapi` as a root folder */
export function sampleTree(openapi: boolean): PageTree.Root {
  const children: PageTree.Node[] = [
    {
      type: "folder",
      name: "Guides",
      description: "Learn the basics",
      root: true,
      icon: <BookOpenIcon />,
      children: [
        { type: "page", name: "Quick Start", url: previewPath },
        { type: "page", name: "Authentication", url: href("authentication") },
        {
          type: "folder",
          name: "Concepts",
          children: [
            { type: "page", name: "Clients", url: href("concepts/clients") },
            { type: "page", name: "Requests", url: href("concepts/requests") },
            { type: "page", name: "Errors", url: href("concepts/errors") },
            { type: "page", name: "Pagination", url: href("concepts/pagination") },
          ],
        },
        { type: "separator", name: "Advanced" },
        { type: "page", name: "Webhooks", url: href("webhooks") },
        { type: "page", name: "Rate Limits", url: href("rate-limits") },
        { type: "page", name: "Testing", url: href("testing") },
      ],
    },
    {
      type: "folder",
      name: "Integrations",
      description: "Use it with your framework",
      root: true,
      icon: <PlugIcon />,
      children: [
        { type: "page", name: "Next.js", url: href("integrations/next") },
        { type: "page", name: "Waku", url: href("integrations/waku") },
        { type: "page", name: "Astro", url: href("integrations/astro") },
      ],
    },
  ];

  if (openapi)
    children.push({
      type: "folder",
      name: "API Reference",
      description: "Endpoints and types",
      root: true,
      icon: <BracesIcon />,
      children: [
        {
          type: "folder",
          name: "Customers",
          defaultOpen: true,
          children: operations.map((operation) => ({
            type: "page",
            // the name of `openapiPlugin` of `fumadocs-openapi/server`
            name: (
              <>
                {operation.title}{" "}
                <MethodLabel method={operation.method} className="ms-auto text-xs text-nowrap" />
              </>
            ),
            url: href(operation.slug),
          })),
        },
      ],
    });

  return { name: "Docs", children };
}

/* code blocks */

/** colors of `vitesse-light` and `catppuccin-mocha`, the code themes of this site */
const shiki: Partial<Record<TokenKind, [light: string, dark: string]>> = {
  plain: ["#393a34", "#cdd6f4"],
  keyword: ["#1e754f", "#cba6f7"],
  string: ["#b56959", "#a6e3a1"],
  function: ["#59873a", "#89b4fa"],
  constant: ["#a65e2b", "#fab387"],
  tag: ["#1e754f", "#89b4fa"],
  punctuation: ["#999999", "#9399b2"],
  comment: ["#a0ada0", "#7f849c"],
};

function Code({ title, code }: { title?: string; code: string }) {
  return (
    <CodeBlock title={title} className="shiki">
      <Pre>
        <code>
          {tokenize(code).map((line, i) => (
            <span key={i} className="line">
              {line.map((token, j) => {
                const [light, dark] = shiki[token.kind] ?? shiki.plain!;
                return (
                  <span key={j} style={{ "--shiki-light": light, "--shiki-dark": dark }}>
                    {token.text}
                  </span>
                );
              })}
            </span>
          ))}
        </code>
      </Pre>
    </CodeBlock>
  );
}

/* the guide */

export const guide = {
  title: "Quick Start",
  description: "Install the SDK and send your first request.",
  toc: [
    { title: "Installation", url: "#installation", depth: 2 },
    { title: "Creating a Client", url: "#creating-a-client", depth: 2 },
    { title: "Options", url: "#options", depth: 3 },
    { title: "Sending a Request", url: "#sending-a-request", depth: 2 },
    { title: "Next Steps", url: "#next-steps", depth: 2 },
  ] satisfies TOCItemType[],
};

export function GuideBody() {
  return (
    <>
      <p>
        This guide installs the SDK, creates a client and sends your first request. It takes about
        five minutes.
      </p>
      <Heading as="h2" id="installation">
        Installation
      </Heading>
      <p>Install the package with your package manager. It runs on Node.js 20 and later.</p>
      <Code code="npm install @acme/sdk" />
      <Heading as="h2" id="creating-a-client">
        Creating a Client
      </Heading>
      <p>A client holds your API key and sends every request of your app.</p>
      <Code
        title="lib/acme.ts"
        code={`import { Acme } from "@acme/sdk";

export const acme = new Acme({
  apiKey: process.env.ACME_API_KEY,
});`}
      />
      <Callout type="warn" title="Keep the key on the server">
        Anyone with your API key can make requests to your account.
      </Callout>
      <Heading as="h3" id="options">
        Options
      </Heading>
      <p>
        Set <code>timeout</code> to change how long a request waits, and <code>retries</code> to
        retry failed requests. Both have defaults that suit most apps.
      </p>
      <Heading as="h2" id="sending-a-request">
        Sending a Request
      </Heading>
      <p>Each resource is a property of the client, and its methods return promises.</p>
      <Code
        code={`const customer = await acme.customers.create({
  email: "ada@example.com",
});`}
      />
      <Heading as="h2" id="next-steps">
        Next Steps
      </Heading>
      <Cards>
        <Card
          icon={<KeyRoundIcon />}
          title="Authentication"
          description="Scope keys and rotate them."
          href={href("authentication")}
        />
        <Card
          icon={<WebhookIcon />}
          title="Webhooks"
          description="Get notified when events happen."
          href={href("webhooks")}
        />
      </Cards>
    </>
  );
}

/* an API page, with the markup of `APIPage` of `fumadocs-openapi` */

function Fields({ fields }: { fields: Field[] }): ReactNode {
  return (
    <div className="not-prose">
      {fields.map((field) => (
        <div key={field.name} className="border-t py-2.5 first:border-t-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-medium text-fd-primary">
              {field.name}
              {field.required && <span className="text-red-400">*</span>}
            </span>
            <span className="rounded-md border bg-fd-secondary px-1.5 font-mono text-xs leading-5 text-fd-muted-foreground">
              {field.type}
            </span>
          </div>
          <p className="mt-1 text-sm text-fd-muted-foreground">{field.description}</p>
        </div>
      ))}
    </div>
  );
}

function responseExample(operation: Operation): string {
  const values: Record<string, string> = {
    id: '"cus_123"',
    email: '"ada@example.com"',
    name: '"Ada Lovelace"',
    created: "1767225600",
    deleted: "true",
    next: '"cus_122"',
    data: "[]",
  };
  const lines = operation.response.map(
    (field, i, all) =>
      `  "${field.name}": ${values[field.name] ?? "null"}${i < all.length - 1 ? "," : ""}`,
  );
  return ["{", ...lines, "}"].join("\n");
}

export function OperationBody({ operation }: { operation: Operation }) {
  return (
    <div className="@container">
      <div className="not-prose mb-6 flex h-9 items-center gap-2 rounded-xl border bg-fd-card ps-2.5 pe-1 text-sm">
        <MethodLabel method={operation.method} className="text-xs" />
        <span className="truncate font-mono text-fd-muted-foreground">{operation.path}</span>
      </div>
      <div className="flex flex-col gap-x-6 gap-y-4 @4xl:flex-row @4xl:items-start">
        <div className="min-w-0 flex-1">
          {operation.body && (
            <>
              <h2 className="mt-0!">Request Body</h2>
              <Fields fields={operation.body} />
            </>
          )}
          <h2 className={cn(!operation.body && "mt-0!")}>Response Body</h2>
          <Fields fields={operation.response} />
        </div>
        <div className="@4xl:sticky @4xl:top-4 @4xl:w-85">
          <Code title="cURL" code={operation.example} />
          <Code title="200" code={responseExample(operation)} />
        </div>
      </div>
    </div>
  );
}

## @fumapress/graphql@1.0.0

### Redesign the core API for v1

Layouts move onto the config object (`renderPage`, `renderRoot`, `renderNotFound`, `defaultLayoutProps`), `content` replaces `loader`, and plugin types are renamed (`PressPlugin`, `AppShape`).

See the [migration guide](https://press.fumadocs.dev/docs/migrate).

### Add the GraphQL integration

Generate API docs from your GraphQL schema with `@fumadocs/graphql`:

```tsx title="press.config.tsx"
import { createGraphQL, graphqlPlugin } from "@fumapress/graphql";

const graphql = createGraphQL({
  input: [path.resolve("./schema.graphql")],
});

export default defineConfig({
  content: {
    docs: docs.toFumadocsSource(),
    graphql: await graphql.staticSource({ baseUrl: "/" }),
  },
}).plugins(graphqlPlugin({ server: graphql }));
```

## @fumapress/graphql@1.0.0-beta.2 (beta)

### Add the GraphQL integration

Generate API docs from your GraphQL schema with `@fumadocs/graphql`:

```tsx title="press.config.tsx"
import { createGraphQL, graphqlPlugin } from "@fumapress/graphql";

const graphql = createGraphQL({
  input: [path.resolve("./schema.graphql")],
});

export default defineConfig({
  content: {
    docs: docs.toFumadocsSource(),
    graphql: await graphql.staticSource({ baseUrl: "/" }),
  },
}).plugins(graphqlPlugin({ server: graphql }));
```

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

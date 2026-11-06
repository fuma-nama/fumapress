// `virtual:fumapress/client-references` of the browser, with the key the tests register on the server
export default {
  client: () => import("./client"),
} satisfies Record<string, () => Promise<Record<string, unknown>>>;

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";

type CreateMcpServerFn = () => McpServer | Promise<McpServer>;

const initializeRequestSchema = z.looseObject({
  method: z.literal("initialize"),
});

const initializeBodySchema = z.union([
  initializeRequestSchema,
  z
    .array(z.looseObject({ method: z.string() }))
    .refine((items) => items.some((item) => item.method === "initialize")),
]);

function isInitializeRequest(body: unknown) {
  return initializeBodySchema.safeParse(body).success;
}

function jsonRpcError(status: number, code: number, message: string) {
  return Response.json(
    {
      jsonrpc: "2.0",
      error: { code, message },
      id: null,
    },
    { status },
  );
}

export function createMcpRequestHandler(createServer: CreateMcpServerFn) {
  const transports = new Map<string, WebStandardStreamableHTTPServerTransport>();

  return async function handleMcpRequest(req: Request): Promise<Response> {
    const sessionId = req.headers.get("mcp-session-id") ?? undefined;

    if (sessionId) {
      const transport = transports.get(sessionId);
      if (!transport) return jsonRpcError(404, -32_001, "Session not found");

      return transport.handleRequest(req);
    }

    if (req.method !== "POST") {
      return jsonRpcError(400, -32_000, "Bad Request: Session ID required");
    }

    const body = await req
      .clone()
      .json()
      .catch(() => null);
    if (!isInitializeRequest(body)) {
      return jsonRpcError(400, -32_000, "Bad Request: Session ID required");
    }

    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      onsessioninitialized(id) {
        transports.set(id, transport);
      },
      onsessionclosed(id) {
        transports.delete(id);
      },
    });

    transport.onclose = () => {
      const id = transport.sessionId;
      if (id) transports.delete(id);
    };

    const server = await createServer();
    await server.connect(transport);

    return transport.handleRequest(req, { parsedBody: body });
  };
}

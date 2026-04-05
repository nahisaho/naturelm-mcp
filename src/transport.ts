import http from "node:http";
import crypto from "node:crypto";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "./tools/registry.js";
import type { NatureLMConfig } from "./types.js";

// --- Server ファクトリ (DES-NLM-023 §3.3) ---

export function createServer(registry: ToolRegistry): Server {
  const server = new Server(
    { name: "naturelm-mcp", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: registry.list().map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const result = await registry.call(name, args ?? {});
    return { content: result.content, isError: result.isError };
  });

  return server;
}

// --- readJsonBody ヘルパー ---

function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString()));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

// --- isInitializeRequest ヘルパー ---

function isInitializeRequest(msg: unknown): boolean {
  return (
    typeof msg === "object" &&
    msg !== null &&
    "method" in msg &&
    (msg as Record<string, unknown>).method === "initialize"
  );
}

// --- Graceful Shutdown (DES-NLM-027) ---

function setupGracefulShutdown(
  httpServer: http.Server,
  sessions: Map<string, { close(): Promise<void> }>,
): void {
  const shutdown = async () => {
    console.error("Shutting down...");
    for (const [id, transport] of sessions) {
      await transport.close().catch(() => {});
      sessions.delete(id);
    }
    httpServer.close();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

// --- stdio (DES-NLM-014) ---

async function startStdioTransport(registry: ToolRegistry): Promise<void> {
  const server = createServer(registry);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// --- SSE (DES-NLM-024) ---

export async function startSSETransport(
  registry: ToolRegistry,
  config: NatureLMConfig,
): Promise<http.Server> {
  const sessions = new Map<string, SSEServerTransport>();

  const httpServer = http.createServer(async (req, res) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/sse") {
      const server = createServer(registry);
      const transport = new SSEServerTransport("/message", res);
      sessions.set(transport.sessionId, transport);

      res.on("close", () => {
        sessions.delete(transport.sessionId);
        server.close().catch(() => {});
      });

      await server.connect(transport);
      return;
    }

    if (req.method === "POST" && url.pathname === "/message") {
      const sessionId = url.searchParams.get("sessionId");
      const transport = sessionId ? sessions.get(sessionId) : undefined;
      if (!transport) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid or missing sessionId" }));
        return;
      }
      await transport.handlePostMessage(req, res);
      return;
    }

    res.writeHead(404);
    res.end("Not Found");
  });

  setupGracefulShutdown(httpServer, sessions);

  return new Promise((resolve) => {
    httpServer.listen(config.port, config.host, () => {
      console.error(
        `NatureLM MCP Server (SSE) listening on http://${config.host}:${getPort(httpServer)}/sse`,
      );
      resolve(httpServer);
    });
  });
}

// --- Streamable HTTP (DES-NLM-025) ---

export async function startStreamableHTTPTransport(
  registry: ToolRegistry,
  config: NatureLMConfig,
): Promise<http.Server> {
  const sessions = new Map<string, StreamableHTTPServerTransport>();

  const httpServer = http.createServer(async (req, res) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);

    if (url.pathname !== "/mcp") {
      res.writeHead(404);
      res.end("Not Found");
      return;
    }

    // 既存セッションへのルーティング
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (sessionId && sessions.has(sessionId)) {
      const transport = sessions.get(sessionId)!;
      await transport.handleRequest(req, res);
      return;
    }

    // 無効なセッション ID は即 404
    if (sessionId && !sessions.has(sessionId)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32001, message: "Session not found" },
          id: null,
        }),
      );
      return;
    }

    // 初期化判定のため POST body を先読みする
    if (req.method === "POST") {
      let rawBody: unknown;
      try {
        rawBody = await readJsonBody(req);
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32700, message: "Parse error: Invalid JSON" },
            id: null,
          }),
        );
        return;
      }

      const messages = Array.isArray(rawBody) ? rawBody : [rawBody];
      const isInit = messages.some(isInitializeRequest);

      if (!isInit) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            error: {
              code: -32000,
              message: "Bad Request: Mcp-Session-Id header is required",
            },
            id: null,
          }),
        );
        return;
      }

      // 初期化リクエスト: 新しい Server + Transport ペアを生成
      const server = createServer(registry);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
        onsessioninitialized: (id) => {
          sessions.set(id, transport);
        },
      });

      transport.onclose = () => {
        if (transport.sessionId) {
          sessions.delete(transport.sessionId);
        }
      };

      await server.connect(transport);
      await transport.handleRequest(req, res, rawBody);
      return;
    }

    // セッション ID なし + GET/DELETE → 400
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Bad Request: No valid session" },
        id: null,
      }),
    );
  });

  setupGracefulShutdown(httpServer, sessions);

  return new Promise((resolve) => {
    httpServer.listen(config.port, config.host, () => {
      console.error(
        `NatureLM MCP Server (Streamable HTTP) listening on http://${config.host}:${getPort(httpServer)}/mcp`,
      );
      resolve(httpServer);
    });
  });
}

// --- ポート取得ヘルパー ---

function getPort(server: http.Server): number {
  const addr = server.address();
  if (addr && typeof addr === "object") return addr.port;
  return 0;
}

// --- エントリポイント (DES-NLM-023 §3.4) ---

export async function startTransport(
  registry: ToolRegistry,
  config: NatureLMConfig,
): Promise<http.Server | void> {
  switch (config.transport) {
    case "stdio":
      return startStdioTransport(registry);
    case "sse":
      return startSSETransport(registry, config);
    case "http":
      return startStreamableHTTPTransport(registry, config);
  }
}

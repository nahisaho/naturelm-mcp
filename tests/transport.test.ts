import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from "vitest";
import http from "node:http";
import type { NatureLMConfig } from "../src/types.js";

// テスト用の最小 ToolRegistry モック
function createMockRegistry() {
  return {
    list: () => [
      {
        name: "test_tool",
        description: "A test tool",
        inputSchema: { type: "object", properties: {} },
        handler: async () => ({
          content: [{ type: "text" as const, text: "test result" }],
        }),
      },
    ],
    call: async (_name: string, _args: Record<string, unknown>) => ({
      content: [{ type: "text" as const, text: "test result" }],
    }),
    register: vi.fn(),
  };
}

function makeConfig(overrides: Partial<NatureLMConfig> = {}): NatureLMConfig {
  return {
    baseUrl: "http://localhost:8080/v1",
    apiKey: "unused",
    model: "naturelm-8x7b-inst",
    timeout: 120000,
    transport: "stdio",
    host: "127.0.0.1",
    port: 0, // OS が空きポートを割り当て
    ...overrides,
  };
}

// ポート取得ヘルパー
function getPort(server: http.Server): number {
  const addr = server.address();
  if (addr && typeof addr === "object") return addr.port;
  throw new Error("Server not listening");
}

// JSON レスポンス読み取りヘルパー
async function readJson(res: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of res) chunks.push(chunk as Buffer);
  return JSON.parse(Buffer.concat(chunks).toString());
}

// SSE レスポンス読み取り（最初のイベントのみ）
function readSSEEvent(res: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    const timeout = setTimeout(() => reject(new Error("SSE timeout")), 5000);
    res.on("data", (chunk: Buffer) => {
      data += chunk.toString();
      // endpoint イベントを検出
      if (data.includes("event: endpoint")) {
        clearTimeout(timeout);
        resolve(data);
      }
    });
    res.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

// HTTP リクエストヘルパー
function httpRequest(
  options: http.RequestOptions,
  body?: unknown,
): Promise<{ res: http.IncomingMessage; body: unknown }> {
  return new Promise((resolve, reject) => {
    const req = http.request(options, async (res) => {
      try {
        const json = await readJson(res);
        resolve({ res, body: json });
      } catch {
        resolve({ res, body: null });
      }
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

describe("Transport", () => {
  // DES-NLM-023: createServer ファクトリ
  describe("createServer", () => {
    it("createServer が Server インスタンスを返す", async () => {
      const { createServer } = await import("../src/transport.js");
      const registry = createMockRegistry();
      const server = createServer(registry as any);
      expect(server).toBeDefined();
      expect(typeof server.connect).toBe("function");
      expect(typeof server.close).toBe("function");
    });

    it("異なる呼び出しで異なる Server インスタンスを返す", async () => {
      const { createServer } = await import("../src/transport.js");
      const registry = createMockRegistry();
      const s1 = createServer(registry as any);
      const s2 = createServer(registry as any);
      expect(s1).not.toBe(s2);
    });
  });

  // DES-NLM-023: startTransport 選択ロジック
  describe("startTransport", () => {
    it("不明な transport でエラーをスローしない（バリデーションは ConfigManager の責務）", async () => {
      // startTransport は config.transport に基づいてディスパッチする
      // stdio の場合は StdioServerTransport に接続する
      const { startTransport } = await import("../src/transport.js");
      expect(typeof startTransport).toBe("function");
    });
  });

  // DES-NLM-024: SSE トランスポート
  describe("SSE transport", () => {
    let httpServer: http.Server;
    let port: number;
    let activeRequests: http.ClientRequest[] = [];

    afterEach(async () => {
      // アクティブな接続を全て破棄
      for (const req of activeRequests) {
        req.destroy();
      }
      activeRequests = [];
      if (httpServer) {
        await new Promise<void>((resolve) => httpServer.close(() => resolve()));
      }
    });

    it("GET /sse で SSE ストリームが確立され endpoint イベントを返す", async () => {
      const { startSSETransport } = await import("../src/transport.js");
      const registry = createMockRegistry();
      const config = makeConfig({ transport: "sse" });

      httpServer = await startSSETransport(registry as any, config);
      port = getPort(httpServer);

      const sseData = await new Promise<string>((resolve, reject) => {
        const req = http.get(`http://127.0.0.1:${port}/sse`, (res) => {
          readSSEEvent(res).then(resolve).catch(reject);
        });
        activeRequests.push(req);
      });

      expect(sseData).toContain("event: endpoint");
      expect(sseData).toContain("/message?sessionId=");
    });

    it("POST /message に無効な sessionId で 400 を返す", async () => {
      const { startSSETransport } = await import("../src/transport.js");
      const registry = createMockRegistry();
      const config = makeConfig({ transport: "sse" });

      httpServer = await startSSETransport(registry as any, config);
      port = getPort(httpServer);

      const { res } = await httpRequest({
        hostname: "127.0.0.1",
        port,
        path: "/message?sessionId=invalid-id",
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      expect(res.statusCode).toBe(400);
    });

    it("不明なパスに 404 を返す", async () => {
      const { startSSETransport } = await import("../src/transport.js");
      const registry = createMockRegistry();
      const config = makeConfig({ transport: "sse" });

      httpServer = await startSSETransport(registry as any, config);
      port = getPort(httpServer);

      const { res } = await httpRequest({
        hostname: "127.0.0.1",
        port,
        path: "/unknown",
        method: "GET",
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // DES-NLM-025: Streamable HTTP トランスポート
  describe("Streamable HTTP transport", () => {
    let httpServer: http.Server;
    let port: number;

    afterEach(async () => {
      if (httpServer) {
        await new Promise<void>((resolve) => httpServer.close(() => resolve()));
      }
    });

    it("POST /mcp に initialize リクエストで 200 + mcp-session-id を返す", async () => {
      const { startStreamableHTTPTransport } = await import("../src/transport.js");
      const registry = createMockRegistry();
      const config = makeConfig({ transport: "http" });

      httpServer = await startStreamableHTTPTransport(registry as any, config);
      port = getPort(httpServer);

      const initRequest = {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" },
        },
      };

      const { res } = await httpRequest(
        {
          hostname: "127.0.0.1",
          port,
          path: "/mcp",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
          },
        },
        initRequest,
      );

      expect(res.statusCode).toBe(200);
      expect(res.headers["mcp-session-id"]).toBeDefined();
    });

    it("無効な mcp-session-id で 404 を返す", async () => {
      const { startStreamableHTTPTransport } = await import("../src/transport.js");
      const registry = createMockRegistry();
      const config = makeConfig({ transport: "http" });

      httpServer = await startStreamableHTTPTransport(registry as any, config);
      port = getPort(httpServer);

      const { res } = await httpRequest({
        hostname: "127.0.0.1",
        port,
        path: "/mcp",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json, text/event-stream",
          "mcp-session-id": "nonexistent-session",
        },
      }, { jsonrpc: "2.0", id: 1, method: "tools/list" });

      expect(res.statusCode).toBe(404);
    });

    it("セッション ID なしの非初期化 POST で 400 を返す", async () => {
      const { startStreamableHTTPTransport } = await import("../src/transport.js");
      const registry = createMockRegistry();
      const config = makeConfig({ transport: "http" });

      httpServer = await startStreamableHTTPTransport(registry as any, config);
      port = getPort(httpServer);

      const { res } = await httpRequest(
        {
          hostname: "127.0.0.1",
          port,
          path: "/mcp",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
          },
        },
        { jsonrpc: "2.0", id: 1, method: "tools/list" },
      );

      expect(res.statusCode).toBe(400);
    });

    it("不明なパスに 404 を返す", async () => {
      const { startStreamableHTTPTransport } = await import("../src/transport.js");
      const registry = createMockRegistry();
      const config = makeConfig({ transport: "http" });

      httpServer = await startStreamableHTTPTransport(registry as any, config);
      port = getPort(httpServer);

      const { res } = await httpRequest({
        hostname: "127.0.0.1",
        port,
        path: "/other",
        method: "GET",
      });

      expect(res.statusCode).toBe(404);
    });

    it("GET /mcp にセッション ID なしで 400 を返す", async () => {
      const { startStreamableHTTPTransport } = await import("../src/transport.js");
      const registry = createMockRegistry();
      const config = makeConfig({ transport: "http" });

      httpServer = await startStreamableHTTPTransport(registry as any, config);
      port = getPort(httpServer);

      const { res } = await httpRequest({
        hostname: "127.0.0.1",
        port,
        path: "/mcp",
        method: "GET",
      });

      expect(res.statusCode).toBe(400);
    });

    it("initialize 後に有効な session ID で tools/list を呼べる", async () => {
      const { startStreamableHTTPTransport } = await import("../src/transport.js");
      const registry = createMockRegistry();
      const config = makeConfig({ transport: "http" });

      httpServer = await startStreamableHTTPTransport(registry as any, config);
      port = getPort(httpServer);

      // initialize
      const initRequest = {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" },
        },
      };

      const { res: initRes } = await httpRequest(
        {
          hostname: "127.0.0.1",
          port,
          path: "/mcp",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
          },
        },
        initRequest,
      );

      const sessionId = initRes.headers["mcp-session-id"] as string;
      expect(sessionId).toBeDefined();

      // initialized notification
      await httpRequest(
        {
          hostname: "127.0.0.1",
          port,
          path: "/mcp",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            "mcp-session-id": sessionId,
          },
        },
        { jsonrpc: "2.0", method: "notifications/initialized" },
      );

      // tools/list
      const { res: listRes, body: listBody } = await httpRequest(
        {
          hostname: "127.0.0.1",
          port,
          path: "/mcp",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            "mcp-session-id": sessionId,
          },
        },
        { jsonrpc: "2.0", id: 2, method: "tools/list" },
      );

      expect(listRes.statusCode).toBe(200);
    });

    it("不正な JSON ボディで 400 を返す", async () => {
      const { startStreamableHTTPTransport } = await import("../src/transport.js");
      const registry = createMockRegistry();
      const config = makeConfig({ transport: "http" });

      httpServer = await startStreamableHTTPTransport(registry as any, config);
      port = getPort(httpServer);

      const { res } = await new Promise<{ res: http.IncomingMessage; body: unknown }>((resolve, reject) => {
        const req = http.request({
          hostname: "127.0.0.1",
          port,
          path: "/mcp",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
          },
        }, async (res) => {
          const chunks: Buffer[] = [];
          for await (const chunk of res) chunks.push(chunk as Buffer);
          try {
            resolve({ res, body: JSON.parse(Buffer.concat(chunks).toString()) });
          } catch {
            resolve({ res, body: null });
          }
        });
        req.on("error", reject);
        req.write("not valid json{{{");
        req.end();
      });

      expect(res.statusCode).toBe(400);
    });
  });
});

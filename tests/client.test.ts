import { describe, it, expect, vi, beforeEach } from "vitest";
import { NatureLMClient } from "../src/client.js";
import type { NatureLMConfig } from "../src/types.js";

// OpenAI SDK をモック
vi.mock("openai", () => {
  const MockOpenAI = vi.fn();
  return { default: MockOpenAI };
});

const defaultConfig: NatureLMConfig = {
  baseUrl: "http://localhost:8080/v1",
  apiKey: "test-key",
  model: "naturelm-8x7b-inst",
  timeout: 120000,
  transport: "stdio",
  host: "127.0.0.1",
  port: 3000,
};

// テスト用: バックオフを 0ms にして sleep 待機を排除
const NO_BACKOFF = 0;

describe("NatureLMClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // REQ-NLM-019: 正常応答
  it("正常応答時に文字列を返す", async () => {
    const { default: MockOpenAI } = await import("openai");
    vi.mocked(MockOpenAI).mockImplementation(
      () =>
        ({
          chat: {
            completions: {
              create: vi.fn().mockResolvedValue({
                choices: [{ message: { content: "CCO" } }],
              }),
            },
          },
        }) as any,
    );

    const client = new NatureLMClient(defaultConfig, NO_BACKOFF);
    const result = await client.chat([{ role: "user", content: "What is ethanol?" }]);
    expect(result).toBe("CCO");
  });

  // REQ-NLM-012: ECONNREFUSED リトライ後エラー
  it("ECONNREFUSED でリトライ後エラーメッセージを返す", async () => {
    const { default: MockOpenAI } = await import("openai");
    const error = new Error("connect ECONNREFUSED");
    (error as any).code = "ECONNREFUSED";
    vi.mocked(MockOpenAI).mockImplementation(
      () =>
        ({
          chat: {
            completions: {
              create: vi.fn().mockRejectedValue(error),
            },
          },
        }) as any,
    );

    const client = new NatureLMClient(defaultConfig, NO_BACKOFF);
    const result = await client.chat([{ role: "user", content: "test" }]);
    expect(result).toContain("接続できません");
    expect(result).toContain(defaultConfig.baseUrl);
  });

  // REQ-NLM-012: ENOTFOUND 即時エラー
  it("ENOTFOUND で即時エラーメッセージを返す", async () => {
    const { default: MockOpenAI } = await import("openai");
    const error = new Error("getaddrinfo ENOTFOUND");
    (error as any).code = "ENOTFOUND";
    vi.mocked(MockOpenAI).mockImplementation(
      () =>
        ({
          chat: {
            completions: {
              create: vi.fn().mockRejectedValue(error),
            },
          },
        }) as any,
    );

    const client = new NatureLMClient(defaultConfig, NO_BACKOFF);
    const result = await client.chat([{ role: "user", content: "test" }]);
    expect(result).toContain("ホスト名を解決できません");
  });

  // REQ-NLM-012: ETIMEDOUT リトライ後エラー
  it("ETIMEDOUT でリトライ後エラーメッセージを返す", async () => {
    const { default: MockOpenAI } = await import("openai");
    const error = new Error("connect ETIMEDOUT");
    (error as any).code = "ETIMEDOUT";
    vi.mocked(MockOpenAI).mockImplementation(
      () =>
        ({
          chat: {
            completions: {
              create: vi.fn().mockRejectedValue(error),
            },
          },
        }) as any,
    );

    const client = new NatureLMClient(defaultConfig, NO_BACKOFF);
    const result = await client.chat([{ role: "user", content: "test" }]);
    expect(result).toContain("タイムアウト");
  });

  // REQ-NLM-012: healthCheck 成功
  it("healthCheck が true を返す（正常時）", async () => {
    const { default: MockOpenAI } = await import("openai");
    vi.mocked(MockOpenAI).mockImplementation(
      () =>
        ({
          models: {
            list: vi.fn().mockResolvedValue({
              data: [{ id: "naturelm-8x7b-inst", object: "model", owned_by: "nvidia" }],
            }),
          },
          chat: {
            completions: {
              create: vi.fn(),
            },
          },
        }) as any,
    );

    const client = new NatureLMClient(defaultConfig, NO_BACKOFF);
    const result = await client.healthCheck();
    expect(result).toBe(true);
  });

  // REQ-NLM-012: healthCheck 失敗
  it("healthCheck が false を返す（接続失敗時）", async () => {
    const { default: MockOpenAI } = await import("openai");
    vi.mocked(MockOpenAI).mockImplementation(
      () =>
        ({
          models: {
            list: vi.fn().mockRejectedValue(new Error("connection failed")),
          },
          chat: {
            completions: {
              create: vi.fn(),
            },
          },
        }) as any,
    );

    const client = new NatureLMClient(defaultConfig, NO_BACKOFF);
    const result = await client.healthCheck();
    expect(result).toBe(false);
  });

  // REQ-NLM-012: listModels
  it("listModels がモデル一覧を返す", async () => {
    const { default: MockOpenAI } = await import("openai");
    const models = [
      { id: "naturelm-8x7b-inst", object: "model", owned_by: "nvidia" },
      { id: "other-model", object: "model", owned_by: "test" },
    ];
    vi.mocked(MockOpenAI).mockImplementation(
      () =>
        ({
          models: {
            list: vi.fn().mockResolvedValue({ data: models }),
          },
          chat: {
            completions: {
              create: vi.fn(),
            },
          },
        }) as any,
    );

    const client = new NatureLMClient(defaultConfig, NO_BACKOFF);
    const result = await client.listModels();
    expect(result).toHaveLength(2);
    expect(result[0]!.id).toBe("naturelm-8x7b-inst");
  });
});

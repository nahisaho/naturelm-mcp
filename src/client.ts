import OpenAI from "openai";
import type { ChatMessage, ChatOptions, INatureLMClient, ModelInfo, NatureLMConfig } from "./types.js";

const MAX_CONNECTION_RETRIES = 3;
const BACKOFF_BASE_MS = 1000;

function isRetryableError(error: unknown): { retryable: boolean; code: string } {
  const code = (error as any)?.code ?? "";
  if (code === "ECONNREFUSED" || code === "ETIMEDOUT") {
    return { retryable: true, code };
  }
  return { retryable: false, code };
}

async function retryConnection<T>(
  fn: () => Promise<T>,
  config: NatureLMConfig,
  backoffBaseMs = BACKOFF_BASE_MS,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_CONNECTION_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const { retryable, code } = isRetryableError(error);

      if (code === "ENOTFOUND") {
        throw new ConnectionError(
          "ホスト名を解決できません。WSL環境の場合、Windows側IPアドレスを NATURELM_BASE_URL に設定してください",
        );
      }

      if (!retryable) {
        throw error;
      }

      lastError = error;
      if (attempt < MAX_CONNECTION_RETRIES - 1) {
        await sleep(backoffBaseMs * 2 ** attempt);
      }
    }
  }

  const { code } = isRetryableError(lastError);
  if (code === "ECONNREFUSED") {
    throw new ConnectionError(
      `NatureLM APIに接続できません。サーバーが起動しているか、ベースURL (${config.baseUrl}) が正しいか確認してください`,
    );
  }
  throw new ConnectionError(
    `NatureLM APIがタイムアウトしました (${config.timeout}ms)。NATURELM_TIMEOUT で調整できます`,
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class ConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConnectionError";
  }
}

export class NatureLMClient implements INatureLMClient {
  private client: OpenAI;
  private config: NatureLMConfig;
  private backoffBaseMs: number;

  constructor(config: NatureLMConfig, backoffBaseMs = BACKOFF_BASE_MS) {
    this.config = config;
    this.backoffBaseMs = backoffBaseMs;
    this.client = new OpenAI({
      baseURL: config.baseUrl,
      apiKey: config.apiKey,
      timeout: config.timeout,
    });
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    try {
      const response = await retryConnection(
        () =>
          this.client.chat.completions.create({
            model: this.config.model,
            messages,
            temperature: options?.temperature ?? 0.7,
            max_tokens: options?.maxTokens ?? 512,
            seed: options?.seed,
          }),
        this.config,
        this.backoffBaseMs,
      );
      return response.choices[0]?.message?.content ?? "";
    } catch (error) {
      if (error instanceof ConnectionError) {
        return error.message;
      }
      return String((error as Error).message ?? error);
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    const response = await this.client.models.list();
    return (response as any).data.map((m: any) => ({
      id: m.id as string,
      object: m.object as string,
      owned_by: m.owned_by as string,
    }));
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.listModels();
      return true;
    } catch {
      return false;
    }
  }
}

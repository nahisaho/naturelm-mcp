export type JSONSchema = Record<string, unknown>;

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  seed?: number;
}

export interface ModelInfo {
  id: string;
  object: string;
  owned_by: string;
}

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  metadata?: {
    attempts?: number;
    raw_response?: string;
    tags_found?: string[];
  };
  isError?: boolean;
}

export type TransportMode = "stdio" | "sse" | "http";

export interface NatureLMConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeout: number;
  transport: TransportMode;
  host: string;
  port: number;
}

export interface NormalizedResponse {
  content: string;
  raw_response: string;
  tags_found: string[];
}

export interface INatureLMClient {
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<string>;
  listModels(): Promise<ModelInfo[]>;
  healthCheck(): Promise<boolean>;
}

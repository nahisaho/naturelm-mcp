import type { INatureLMClient } from "../types.js";
import type { ToolDefinition } from "./registry.js";
import { ResponseNormalizer } from "../normalizer.js";

export function createAskNaturelmTool(client: INatureLMClient): ToolDefinition {
  return {
    name: "ask_naturelm",
    description: "Ask NatureLM a free-form scientific question",
    inputSchema: {
      type: "object",
      properties: {
        question: { type: "string", description: "Scientific question in natural language" },
        temperature: { type: "number", default: 0.7 },
        max_tokens: { type: "integer", default: 512 },
      },
      required: ["question"],
    },
    handler: async (args) => {
      const question = args.question as string;
      const temperature = (args.temperature as number) ?? 0.7;
      const maxTokens = (args.max_tokens as number) ?? 512;
      const normalizer = new ResponseNormalizer();

      const raw = await client.chat(
        [{ role: "user", content: question }],
        { temperature, maxTokens },
      );

      const normalized = normalizer.normalize(raw);

      return {
        content: [{ type: "text", text: normalized.content }],
        metadata: {
          raw_response: normalized.raw_response,
          tags_found: normalized.tags_found,
        },
      };
    },
  };
}

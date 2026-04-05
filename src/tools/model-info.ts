import type { INatureLMClient } from "../types.js";
import type { ToolDefinition } from "./registry.js";

export function createModelInfoTool(client: INatureLMClient): ToolDefinition {
  return {
    name: "get_model_info",
    description: "Get NatureLM model information and capabilities",
    inputSchema: {
      type: "object",
      properties: {},
    },
    handler: async () => {
      const models = await client.listModels();
      const text = models
        .map((m) => `- ${m.id} (owned_by: ${m.owned_by})`)
        .join("\n");

      return {
        content: [{ type: "text", text: text || "No models found" }],
      };
    },
  };
}

import type { INatureLMClient } from "../types.js";
import type { ToolDefinition } from "./registry.js";
import { RetryEngine } from "../retry.js";

export function createRetrosynthesisTool(client: INatureLMClient): ToolDefinition {
  return {
    name: "retrosynthesis",
    description: "[Experimental] Propose retrosynthesis routes for a target molecule",
    inputSchema: {
      type: "object",
      properties: {
        smiles: { type: "string", description: "Target molecule SMILES" },
        max_retries: { type: "integer", default: 5 },
      },
      required: ["smiles"],
    },
    handler: async (args) => {
      const smiles = args.smiles as string;
      const maxRetries = (args.max_retries as number) ?? 5;

      const engine = new RetryEngine();
      const { result, attempts } = await engine.executeWithRetry(
        async (temperature, seed) => {
          return await client.chat(
            [{ role: "user", content: `Perform retrosynthesis on the molecule ${smiles}` }],
            { temperature, seed },
          );
        },
        { maxRetries, baseTemperature: 0.7, temperatureStep: 0.15, maxTemperature: 1.0 },
      );

      return {
        content: [{ type: "text", text: result }],
        metadata: { attempts },
      };
    },
  };
}

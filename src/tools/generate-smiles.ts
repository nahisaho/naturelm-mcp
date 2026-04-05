import type { INatureLMClient } from "../types.js";
import type { ToolDefinition } from "./registry.js";
import { RetryEngine } from "../retry.js";
import { ResponseNormalizer } from "../normalizer.js";

export function createGenerateSmilesTool(client: INatureLMClient): ToolDefinition {
  return {
    name: "generate_smiles",
    description: "Generate SMILES notation for a molecule by name or desired properties",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Molecule name (e.g. 'caffeine') or desired properties (e.g. 'molecule with 4 hydrogen bond donors')",
        },
        temperature: { type: "number", default: 0.7 },
        max_retries: { type: "integer", default: 5 },
      },
      required: ["query"],
    },
    handler: async (args) => {
      const query = args.query as string;
      const maxRetries = (args.max_retries as number) ?? 5;
      const baseTemperature = (args.temperature as number) ?? 0.7;

      const engine = new RetryEngine();
      const normalizer = new ResponseNormalizer();

      const { result, attempts } = await engine.executeWithRetry(
        async (temperature, seed) => {
          const raw = await client.chat(
            [{ role: "user", content: `What is the SMILES notation for ${query}?` }],
            { temperature, seed },
          );
          const smiles = normalizer.extractSmiles(raw);
          return smiles ?? "";
        },
        { maxRetries, baseTemperature, temperatureStep: 0.15, maxTemperature: 1.0 },
      );

      return {
        content: [{ type: "text", text: result }],
        metadata: { attempts },
      };
    },
  };
}

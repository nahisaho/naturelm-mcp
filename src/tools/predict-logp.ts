import type { INatureLMClient } from "../types.js";
import type { ToolDefinition } from "./registry.js";

export function createPredictLogpTool(client: INatureLMClient): ToolDefinition {
  return {
    name: "predict_logp",
    description: "Predict the logP value of a molecule from its SMILES",
    inputSchema: {
      type: "object",
      properties: {
        smiles: { type: "string", description: "SMILES notation of the molecule" },
      },
      required: ["smiles"],
    },
    handler: async (args) => {
      const smiles = args.smiles as string;
      const raw = await client.chat([
        { role: "user", content: `Predict the logP value of the molecule ${smiles}` },
      ]);

      const match = raw.match(/-?\d+\.?\d*/);
      const value = match ? match[0] : raw;
      const text = `logP: ${value}\n\nRaw response: ${raw}`;

      return {
        content: [{ type: "text", text }],
      };
    },
  };
}

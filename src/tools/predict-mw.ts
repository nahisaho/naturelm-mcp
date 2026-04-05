import type { INatureLMClient } from "../types.js";
import type { ToolDefinition } from "./registry.js";

export function createPredictMwTool(client: INatureLMClient): ToolDefinition {
  return {
    name: "predict_molecular_weight",
    description: "Predict the molecular weight of a molecule from its SMILES (AI prediction, use as reference)",
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
        { role: "user", content: `Predict the molecular weight of the molecule ${smiles}` },
      ]);

      const match = raw.match(/-?\d+\.?\d*/);
      const value = match ? match[0] : raw;
      const text = `Molecular Weight: ${value}\n\n注: AI予測値であり参考値です\n\nRaw response: ${raw}`;

      return {
        content: [{ type: "text", text }],
      };
    },
  };
}

import type { INatureLMClient } from "../types.js";
import type { ToolDefinition } from "./registry.js";
import { ResponseNormalizer } from "../normalizer.js";

export function createPredictMaterialTool(client: INatureLMClient): ToolDefinition {
  return {
    name: "predict_material_composition",
    description: "[Experimental] Predict material composition for target properties",
    inputSchema: {
      type: "object",
      properties: {
        description: { type: "string", description: "Target material properties" },
      },
      required: ["description"],
    },
    handler: async (args) => {
      const description = args.description as string;
      const normalizer = new ResponseNormalizer();

      const raw = await client.chat([
        { role: "user", content: `Predict a material composition for the following properties: ${description}` },
      ]);

      const composition = normalizer.extractMaterial(raw);
      const content = composition ?? raw;
      const text = `${content}\n\n注: 専門家による検証を推奨`;

      return {
        content: [{ type: "text", text }],
        metadata: { raw_response: raw },
      };
    },
  };
}

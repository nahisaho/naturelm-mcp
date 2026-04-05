import type { INatureLMClient } from "../types.js";
import type { ToolDefinition } from "./registry.js";
import { ResponseNormalizer } from "../normalizer.js";

export function createGenerateProteinTool(client: INatureLMClient): ToolDefinition {
  return {
    name: "generate_protein_sequence",
    description: "[Experimental] Generate a protein sequence for given properties",
    inputSchema: {
      type: "object",
      properties: {
        description: { type: "string", description: "Desired protein properties or function" },
      },
      required: ["description"],
    },
    handler: async (args) => {
      const description = args.description as string;
      const normalizer = new ResponseNormalizer();

      const raw = await client.chat([
        { role: "user", content: `Generate a protein sequence with the following properties: ${description}` },
      ]);

      const sequence = normalizer.extractProtein(raw);
      const content = sequence ?? raw;
      const text = `${content}\n\n注: 専門家による検証を推奨`;

      return {
        content: [{ type: "text", text }],
        metadata: { raw_response: raw },
      };
    },
  };
}

import type { INatureLMClient } from "../types.js";
import type { ToolDefinition } from "./registry.js";

export function createValidateSmilesTool(client: INatureLMClient): ToolDefinition {
  return {
    name: "validate_smiles",
    description: "[Experimental] Validate a SMILES string using NatureLM",
    inputSchema: {
      type: "object",
      properties: {
        smiles: { type: "string", description: "SMILES string to validate" },
      },
      required: ["smiles"],
    },
    handler: async (args) => {
      const smiles = args.smiles as string;
      const raw = await client.chat([
        { role: "user", content: `Is the following SMILES valid? ${smiles}` },
      ]);

      const lower = raw.toLowerCase();
      const isValid = lower.includes("valid") && !lower.includes("invalid");
      const verdict = isValid ? "Valid" : "Invalid";
      const text = `${verdict}: ${raw}\n\n注: 参考値。確定的検証にはRDKit等を使用してください`;

      return {
        content: [{ type: "text", text }],
      };
    },
  };
}

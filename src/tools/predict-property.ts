import type { INatureLMClient } from "../types.js";
import type { ToolDefinition } from "./registry.js";

const SUPPORTED_PROPERTIES = [
  "solubility",
  "boiling_point",
  "melting_point",
  "pka",
  "polar_surface_area",
  "hydrogen_bond_donors",
  "hydrogen_bond_acceptors",
  "rotatable_bonds",
];

export function createPredictPropertyTool(client: INatureLMClient): ToolDefinition {
  return {
    name: "predict_property",
    description: "Predict a molecular property from SMILES",
    inputSchema: {
      type: "object",
      properties: {
        smiles: { type: "string", description: "SMILES notation" },
        property_name: {
          type: "string",
          description: "Property to predict (e.g. 'solubility', 'boiling_point')",
        },
      },
      required: ["smiles", "property_name"],
    },
    handler: async (args) => {
      const smiles = args.smiles as string;
      const propertyName = args.property_name as string;

      if (!SUPPORTED_PROPERTIES.includes(propertyName)) {
        return {
          content: [{ type: "text", text: `サポートされていない物性です: ${propertyName}` }],
          isError: true,
        };
      }

      const raw = await client.chat([
        { role: "user", content: `Predict the ${propertyName} of the molecule ${smiles}` },
      ]);

      return {
        content: [{ type: "text", text: raw }],
      };
    },
  };
}

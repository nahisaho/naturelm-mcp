import { ConfigManager } from "./config.js";
import { NatureLMClient } from "./client.js";
import { ToolRegistry } from "./tools/registry.js";
import { startTransport } from "./transport.js";

import { createGenerateSmilesTool } from "./tools/generate-smiles.js";
import { createValidateSmilesTool } from "./tools/validate-smiles.js";
import { createPredictLogpTool } from "./tools/predict-logp.js";
import { createPredictMwTool } from "./tools/predict-mw.js";
import { createPredictPropertyTool } from "./tools/predict-property.js";
import { createRetrosynthesisTool } from "./tools/retrosynthesis.js";
import { createGenerateProteinTool } from "./tools/generate-protein.js";
import { createPredictMaterialTool } from "./tools/predict-material.js";
import { createAskNaturelmTool } from "./tools/ask-naturelm.js";
import { createModelInfoTool } from "./tools/model-info.js";

async function main(): Promise<void> {
  const config = ConfigManager.load(process.argv.slice(2));

  // transport バリデーション (REQ-NLM-023)
  if (!ConfigManager.isValidTransport(config.transport)) {
    console.error(`Error: Invalid transport "${config.transport}". Must be one of: stdio, sse, http`);
    process.exit(1);
  }

  const client = new NatureLMClient(config);

  // ToolRegistry に全 10 ツールを登録
  const registry = new ToolRegistry();
  registry.register(createGenerateSmilesTool(client));
  registry.register(createValidateSmilesTool(client));
  registry.register(createPredictLogpTool(client));
  registry.register(createPredictMwTool(client));
  registry.register(createPredictPropertyTool(client));
  registry.register(createRetrosynthesisTool(client));
  registry.register(createGenerateProteinTool(client));
  registry.register(createPredictMaterialTool(client));
  registry.register(createAskNaturelmTool(client));
  registry.register(createModelInfoTool(client));

  // 起動時 healthCheck + モデル検証 (DES-NLM-021)
  const healthy = await client.healthCheck();
  if (healthy) {
    const models = await client.listModels();
    const modelIds = models.map((m) => m.id);
    if (!modelIds.includes(config.model)) {
      console.error(
        `Warning: Model "${config.model}" not found in available models: [${modelIds.join(", ")}]`,
      );
    }
    console.error(
      `NatureLM MCP Server started. API: ${config.baseUrl}, Model: ${config.model}, Key: ${ConfigManager.maskApiKey(config.apiKey)}, Transport: ${config.transport}`,
    );
  } else {
    console.error(
      `Warning: Cannot connect to NatureLM API at ${config.baseUrl}. Server will start but tools may fail.`,
    );
  }

  // トランスポート起動（Server 生成は transport.ts に委譲）
  await startTransport(registry, config);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

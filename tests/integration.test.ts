import { describe, it, expect, vi } from "vitest";
import type { INatureLMClient } from "../src/types.js";
import { ToolRegistry } from "../src/tools/registry.js";
import { createGenerateSmilesTool } from "../src/tools/generate-smiles.js";
import { createValidateSmilesTool } from "../src/tools/validate-smiles.js";
import { createPredictLogpTool } from "../src/tools/predict-logp.js";
import { createPredictMwTool } from "../src/tools/predict-mw.js";
import { createPredictPropertyTool } from "../src/tools/predict-property.js";
import { createRetrosynthesisTool } from "../src/tools/retrosynthesis.js";
import { createGenerateProteinTool } from "../src/tools/generate-protein.js";
import { createPredictMaterialTool } from "../src/tools/predict-material.js";
import { createAskNaturelmTool } from "../src/tools/ask-naturelm.js";
import { createModelInfoTool } from "../src/tools/model-info.js";

function createMockClient(): INatureLMClient {
  return {
    chat: vi.fn().mockResolvedValue("<mol><m>C<m>C<m>O</mol>"),
    listModels: vi.fn().mockResolvedValue([
      { id: "naturelm-8x7b-inst", object: "model", owned_by: "nvidia" },
    ]),
    healthCheck: vi.fn().mockResolvedValue(true),
  };
}

describe("統合: ToolRegistry + 全 10 ツール", () => {
  function buildRegistry(client: INatureLMClient): ToolRegistry {
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
    return registry;
  }

  // REQ-NLM-014/015: 全 10 ツールが登録される
  it("list() が全 10 ツールを返す", () => {
    const registry = buildRegistry(createMockClient());
    const tools = registry.list();
    expect(tools).toHaveLength(10);
    const names = tools.map((t) => t.name);
    expect(names).toContain("generate_smiles");
    expect(names).toContain("validate_smiles");
    expect(names).toContain("predict_logp");
    expect(names).toContain("predict_molecular_weight");
    expect(names).toContain("predict_property");
    expect(names).toContain("retrosynthesis");
    expect(names).toContain("generate_protein_sequence");
    expect(names).toContain("predict_material_composition");
    expect(names).toContain("ask_naturelm");
    expect(names).toContain("get_model_info");
  });

  // REQ-NLM-014: MCP tools/call 経由でツール実行
  it("call() で generate_smiles を実行できる", async () => {
    const registry = buildRegistry(createMockClient());
    const result = await registry.call("generate_smiles", { query: "ethanol" });
    expect(result.content[0]!.text).toBe("CCO");
  });

  it("call() で get_model_info を実行できる", async () => {
    const registry = buildRegistry(createMockClient());
    const result = await registry.call("get_model_info", {});
    expect(result.content[0]!.text).toContain("naturelm-8x7b-inst");
  });

  // REQ-NLM-012: 接続エラー時に適切なメッセージが返る
  it("接続エラー時のツール呼び出しがエラーメッセージを返す", async () => {
    const client: INatureLMClient = {
      chat: vi.fn().mockResolvedValue(""),
      listModels: vi.fn().mockResolvedValue([]),
      healthCheck: vi.fn().mockResolvedValue(false),
    };
    const registry = buildRegistry(client);
    const result = await registry.call("generate_smiles", {
      query: "ethanol",
      max_retries: 1,
    });
    // RetryEngine が空出力をリトライ後に失敗メッセージを返す
    expect(result.content[0]!.text).toContain("失敗");
  });

  // 未登録ツール呼び出し
  it("未登録ツール名でエラーを返す", async () => {
    const registry = buildRegistry(createMockClient());
    const result = await registry.call("nonexistent_tool", {});
    expect(result.isError).toBe(true);
  });
});

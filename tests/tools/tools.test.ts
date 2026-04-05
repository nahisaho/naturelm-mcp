import { describe, it, expect, vi } from "vitest";
import type { INatureLMClient, ChatMessage, ChatOptions, ModelInfo } from "../../src/types.js";
import { createGenerateSmilesTool } from "../../src/tools/generate-smiles.js";
import { createValidateSmilesTool } from "../../src/tools/validate-smiles.js";
import { createPredictLogpTool } from "../../src/tools/predict-logp.js";
import { createPredictMwTool } from "../../src/tools/predict-mw.js";
import { createPredictPropertyTool } from "../../src/tools/predict-property.js";
import { createRetrosynthesisTool } from "../../src/tools/retrosynthesis.js";
import { createGenerateProteinTool } from "../../src/tools/generate-protein.js";
import { createPredictMaterialTool } from "../../src/tools/predict-material.js";
import { createAskNaturelmTool } from "../../src/tools/ask-naturelm.js";
import { createModelInfoTool } from "../../src/tools/model-info.js";

function createMockClient(chatResponse: string): INatureLMClient {
  return {
    chat: vi.fn().mockResolvedValue(chatResponse),
    listModels: vi.fn().mockResolvedValue([
      { id: "naturelm-8x7b-inst", object: "model", owned_by: "nvidia" },
    ]),
    healthCheck: vi.fn().mockResolvedValue(true),
  };
}

// --- DES-NLM-001: generate_smiles ---
describe("generate_smiles", () => {
  it("REQ-NLM-001: 正常応答から SMILES を抽出して返却", async () => {
    const client = createMockClient("<mol><m>C<m>C<m>O</mol>");
    const tool = createGenerateSmilesTool(client);
    const result = await tool.handler({ query: "ethanol" });
    expect(result.content[0]!.text).toBe("CCO");
  });

  it("REQ-NLM-016: metadata.attempts が設定される", async () => {
    const client = createMockClient("<mol><m>C<m>C<m>O</mol>");
    const tool = createGenerateSmilesTool(client);
    const result = await tool.handler({ query: "ethanol" });
    expect(result.metadata?.attempts).toBe(1);
  });

  it("REQ-NLM-016: 空出力時にリトライが発動", async () => {
    let callCount = 0;
    const client: INatureLMClient = {
      chat: vi.fn().mockImplementation(async () => {
        callCount++;
        return callCount === 1 ? "no tags here" : "<mol><m>C<m>C<m>O</mol>";
      }),
      listModels: vi.fn().mockResolvedValue([]),
      healthCheck: vi.fn().mockResolvedValue(true),
    };
    const tool = createGenerateSmilesTool(client);
    const result = await tool.handler({ query: "ethanol" });
    expect(result.content[0]!.text).toBe("CCO");
    expect(result.metadata?.attempts).toBe(2);
  });
});

// --- DES-NLM-002: validate_smiles ---
describe("validate_smiles", () => {
  it("REQ-NLM-002: valid 応答で Valid を返す", async () => {
    const client = createMockClient("The SMILES CCO is valid.");
    const tool = createValidateSmilesTool(client);
    const result = await tool.handler({ smiles: "CCO" });
    expect(result.content[0]!.text).toContain("Valid");
  });

  it("REQ-NLM-002: invalid 応答で Invalid を返す", async () => {
    const client = createMockClient("The SMILES XYZ is invalid.");
    const tool = createValidateSmilesTool(client);
    const result = await tool.handler({ smiles: "XYZ" });
    expect(result.content[0]!.text).toContain("Invalid");
  });

  it("REQ-NLM-002: 注釈が含まれる", async () => {
    const client = createMockClient("valid");
    const tool = createValidateSmilesTool(client);
    const result = await tool.handler({ smiles: "CCO" });
    expect(result.content[0]!.text).toContain("RDKit");
  });
});

// --- DES-NLM-003: predict_logp ---
describe("predict_logp", () => {
  it("REQ-NLM-003: 応答から数値を抽出", async () => {
    const client = createMockClient("The predicted logP is -0.31");
    const tool = createPredictLogpTool(client);
    const result = await tool.handler({ smiles: "CCO" });
    expect(result.content[0]!.text).toContain("-0.31");
    expect(result.content[0]!.text).toContain("logP");
  });
});

// --- DES-NLM-004: predict_molecular_weight ---
describe("predict_molecular_weight", () => {
  it("REQ-NLM-004: 数値抽出とAI注釈", async () => {
    const client = createMockClient("The molecular weight is 46.07 g/mol.");
    const tool = createPredictMwTool(client);
    const result = await tool.handler({ smiles: "CCO" });
    expect(result.content[0]!.text).toContain("46.07");
    expect(result.content[0]!.text).toContain("参考値");
  });
});

// --- DES-NLM-005: predict_property ---
describe("predict_property", () => {
  it("REQ-NLM-005: 対応物性で応答を返す", async () => {
    const client = createMockClient("Solubility: miscible in water");
    const tool = createPredictPropertyTool(client);
    const result = await tool.handler({ smiles: "CCO", property_name: "solubility" });
    expect(result.content[0]!.text).toContain("miscible");
  });

  it("REQ-NLM-005: 未対応物性でエラーを返す", async () => {
    const client = createMockClient("");
    const tool = createPredictPropertyTool(client);
    const result = await tool.handler({ smiles: "CCO", property_name: "unknown_prop" });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("サポートされていない物性です");
  });
});

// --- DES-NLM-006: retrosynthesis ---
describe("retrosynthesis", () => {
  it("REQ-NLM-006: 応答を返す", async () => {
    const client = createMockClient("Precursors: CC=O + H2");
    const tool = createRetrosynthesisTool(client);
    const result = await tool.handler({ smiles: "CCO" });
    expect(result.content[0]!.text).toContain("Precursors");
    expect(result.metadata?.attempts).toBe(1);
  });
});

// --- DES-NLM-007: generate_protein_sequence ---
describe("generate_protein_sequence", () => {
  it("REQ-NLM-007: タンパク質配列を抽出", async () => {
    const client = createMockClient("<protein>MKTLLILAVL</protein>");
    const tool = createGenerateProteinTool(client);
    const result = await tool.handler({ description: "kinase inhibitor" });
    expect(result.content[0]!.text).toContain("MKTLLILAVL");
    expect(result.content[0]!.text).toContain("専門家による検証を推奨");
  });
});

// --- DES-NLM-008: predict_material_composition ---
describe("predict_material_composition", () => {
  it("REQ-NLM-008: 材料組成を抽出", async () => {
    const client = createMockClient("<material>Fe2O3</material>");
    const tool = createPredictMaterialTool(client);
    const result = await tool.handler({ description: "high-temperature superconductor" });
    expect(result.content[0]!.text).toContain("Fe2O3");
    expect(result.content[0]!.text).toContain("専門家による検証を推奨");
  });
});

// --- DES-NLM-009: ask_naturelm ---
describe("ask_naturelm", () => {
  it("REQ-NLM-009: 自由形式クエリの応答を返す", async () => {
    const client = createMockClient("Water has the formula H2O.");
    const tool = createAskNaturelmTool(client);
    const result = await tool.handler({ question: "What is water?" });
    expect(result.content[0]!.text).toContain("H2O");
  });

  it("REQ-NLM-009: 科学トークンがあれば正規化", async () => {
    const client = createMockClient("<mol><m>O</mol>");
    const tool = createAskNaturelmTool(client);
    const result = await tool.handler({ question: "What is water SMILES?" });
    expect(result.content[0]!.text).toBe("O");
    expect(result.metadata?.tags_found).toContain("mol");
  });
});

// --- DES-NLM-010: get_model_info ---
describe("get_model_info", () => {
  it("REQ-NLM-010: モデル一覧を返す", async () => {
    const client = createMockClient("");
    const tool = createModelInfoTool(client);
    const result = await tool.handler({});
    expect(result.content[0]!.text).toContain("naturelm-8x7b-inst");
    expect(result.content[0]!.text).toContain("nvidia");
  });
});

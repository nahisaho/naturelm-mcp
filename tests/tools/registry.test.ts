import { describe, it, expect } from "vitest";
import { ToolRegistry, type ToolDefinition } from "../../src/tools/registry.js";

describe("ToolRegistry", () => {
  function createMockTool(name: string): ToolDefinition {
    return {
      name,
      description: `Mock tool: ${name}`,
      inputSchema: { type: "object", properties: {} },
      handler: async () => ({
        content: [{ type: "text" as const, text: `result from ${name}` }],
      }),
    };
  }

  // REQ-NLM-015: ツール登録と一覧取得
  describe("register / list", () => {
    it("登録したツールが list で取得できる", () => {
      const registry = new ToolRegistry();
      registry.register(createMockTool("tool_a"));
      registry.register(createMockTool("tool_b"));
      const tools = registry.list();
      const names = tools.map((tool: ToolDefinition) => tool.name);
      expect(tools).toHaveLength(2);
      expect(names).toContain("tool_a");
      expect(names).toContain("tool_b");
    });

    it("登録なしの場合は空配列を返す", () => {
      const registry = new ToolRegistry();
      expect(registry.list()).toEqual([]);
    });
  });

  // REQ-NLM-015: ツール呼び出し
  describe("call", () => {
    it("ツール呼び出しが handler を実行する", async () => {
      const registry = new ToolRegistry();
      registry.register(createMockTool("my_tool"));
      const result = await registry.call("my_tool", {});
      expect(result.content[0]!.text).toBe("result from my_tool");
    });

    it("未登録ツール名でエラーを返す", async () => {
      const registry = new ToolRegistry();
      const result = await registry.call("nonexistent", {});
      expect(result.isError).toBe(true);
      expect(result.content[0]!.text).toContain("nonexistent");
    });
  });
});

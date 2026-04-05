import { describe, it, expect } from "vitest";
import { PromptTemplate } from "../src/prompt-template.js";

describe("PromptTemplate", () => {
  // REQ-NLM-018: Completions API ラッパー
  describe("wrapForCompletions", () => {
    it("正しいフォーマットでラップする", () => {
      const result = PromptTemplate.wrapForCompletions("What is caffeine?");
      expect(result).toBe(
        "Instruction: What is caffeine?\n\n\nResponse:\n",
      );
    });

    it("空文字列もラップする", () => {
      const result = PromptTemplate.wrapForCompletions("");
      expect(result).toBe("Instruction: \n\n\nResponse:\n");
    });
  });

  // REQ-NLM-018: ストップシーケンス
  describe("stopSequences", () => {
    it('["Instruction:", "</s>"] を返す', () => {
      expect(PromptTemplate.stopSequences()).toEqual([
        "Instruction:",
        "</s>",
      ]);
    });
  });
});

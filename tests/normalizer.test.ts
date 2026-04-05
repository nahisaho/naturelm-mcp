import { describe, it, expect } from "vitest";
import { ResponseNormalizer } from "../src/normalizer.js";

describe("ResponseNormalizer", () => {
  const normalizer = new ResponseNormalizer();

  // REQ-NLM-017: SMILES 抽出
  describe("extractSmiles", () => {
    it("<mol><m>C<m>C<m>O</mol> から 'CCO' を抽出する", () => {
      const result = normalizer.extractSmiles("<mol><m>C<m>C<m>O</mol>");
      expect(result).toBe("CCO");
    });

    it("タグなしの場合は null を返す", () => {
      const result = normalizer.extractSmiles("This is plain text");
      expect(result).toBeNull();
    });

    it("複雑な SMILES を正しく抽出する", () => {
      const result = normalizer.extractSmiles(
        "The molecule is <mol><m>C<m>(<m>C<m>(<m>C<m>)<m>=<m>O<m>)<m>O</mol>.",
      );
      expect(result).toBe("C(C(C)=O)O");
    });
  });

  // REQ-NLM-017: タンパク質配列抽出
  describe("extractProtein", () => {
    it("<protein>MKTLLILAVL...</protein> から配列を抽出する", () => {
      const result = normalizer.extractProtein(
        "<protein>MKTLLILAVL</protein>",
      );
      expect(result).toBe("MKTLLILAVL");
    });

    it("タグなしの場合は null を返す", () => {
      const result = normalizer.extractProtein("No protein here");
      expect(result).toBeNull();
    });
  });

  // REQ-NLM-017: 材料組成抽出
  describe("extractMaterial", () => {
    it("<material>Fe2O3</material> から組成を抽出する", () => {
      const result = normalizer.extractMaterial(
        "<material>Fe2O3</material>",
      );
      expect(result).toBe("Fe2O3");
    });

    it("タグなしの場合は null を返す", () => {
      const result = normalizer.extractMaterial("No material here");
      expect(result).toBeNull();
    });
  });

  // REQ-NLM-022: normalize
  describe("normalize", () => {
    it("タグなしテキストはそのまま返却する", () => {
      const result = normalizer.normalize("Plain response text");
      expect(result.content).toBe("Plain response text");
      expect(result.raw_response).toBe("Plain response text");
      expect(result.tags_found).toEqual([]);
    });

    it("raw_response に元テキストを保持する", () => {
      const raw = "Answer: <mol><m>C<m>C<m>O</mol>";
      const result = normalizer.normalize(raw);
      expect(result.raw_response).toBe(raw);
    });

    it("tags_found に検出されたタグ種別を含む", () => {
      const result = normalizer.normalize(
        "<mol><m>C<m>C<m>O</mol> and <protein>MKTL</protein>",
      );
      expect(result.tags_found).toContain("mol");
      expect(result.tags_found).toContain("protein");
    });

    it("mol タグ検出時は SMILES を content に設定する", () => {
      const result = normalizer.normalize("<mol><m>C<m>C<m>O</mol>");
      expect(result.content).toBe("CCO");
    });
  });
});

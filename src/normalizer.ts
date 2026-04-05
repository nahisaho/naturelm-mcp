import type { NormalizedResponse } from "./types.js";

export class ResponseNormalizer {
  normalize(raw: string): NormalizedResponse {
    const tags_found: string[] = [];

    if (/<mol>/.test(raw)) tags_found.push("mol");
    if (/<protein>/.test(raw)) tags_found.push("protein");
    if (/<material>/.test(raw)) tags_found.push("material");

    let content: string;
    if (tags_found.includes("mol")) {
      content = this.extractSmiles(raw) ?? raw;
    } else if (tags_found.includes("protein")) {
      content = this.extractProtein(raw) ?? raw;
    } else if (tags_found.includes("material")) {
      content = this.extractMaterial(raw) ?? raw;
    } else {
      content = raw;
    }

    return { content, raw_response: raw, tags_found };
  }

  extractSmiles(raw: string): string | null {
    const match = raw.match(/<mol>(.*?)<\/mol>/s);
    if (!match) return null;
    return match[1]!.replace(/<m>/g, "");
  }

  extractProtein(raw: string): string | null {
    const match = raw.match(/<protein>(.*?)<\/protein>/s);
    return match?.[1] ?? null;
  }

  extractMaterial(raw: string): string | null {
    const match = raw.match(/<material>(.*?)<\/material>/s);
    return match?.[1] ?? null;
  }
}

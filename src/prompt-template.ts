export class PromptTemplate {
  static wrapForCompletions(input: string): string {
    return `Instruction: ${input}\n\n\nResponse:\n`;
  }

  static stopSequences(): string[] {
    return ["Instruction:", "</s>"];
  }
}

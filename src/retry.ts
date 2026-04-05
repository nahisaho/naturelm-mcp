import { randomInt } from "node:crypto";

export interface RetryOptions {
  maxRetries: number;
  baseTemperature: number;
  temperatureStep: number;
  maxTemperature: number;
}

export class RetryEngine {
  async executeWithRetry(
    fn: (temperature: number, seed: number) => Promise<string>,
    options: RetryOptions,
  ): Promise<{ result: string; attempts: number }> {
    if (options.maxRetries === 0) {
      return { result: "生成に失敗しました。より具体的なプロンプトをお試しください", attempts: 0 };
    }

    for (let attempt = 0; attempt < options.maxRetries; attempt++) {
      const seed = randomInt(0, 2 ** 31);
      const temperature = Math.min(
        options.baseTemperature + attempt * options.temperatureStep,
        options.maxTemperature,
      );
      const result = await fn(temperature, seed);
      if (result !== "") {
        return { result, attempts: attempt + 1 };
      }
    }

    return {
      result: "生成に失敗しました。より具体的なプロンプトをお試しください",
      attempts: options.maxRetries,
    };
  }
}

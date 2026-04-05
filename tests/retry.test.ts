import { describe, it, expect } from "vitest";
import { RetryEngine, type RetryOptions } from "../src/retry.js";

describe("RetryEngine", () => {
  const defaultOptions: RetryOptions = {
    maxRetries: 5,
    baseTemperature: 0.7,
    temperatureStep: 0.15,
    maxTemperature: 1.0,
  };

  // REQ-NLM-016: 初回成功
  it("初回成功時は attempts=1 を返す", async () => {
    const engine = new RetryEngine();
    const result = await engine.executeWithRetry(
      async () => "CCO",
      defaultOptions,
    );
    expect(result.result).toBe("CCO");
    expect(result.attempts).toBe(1);
  });

  // REQ-NLM-016: 空文字列リトライ
  it("空文字列応答でリトライし、2回目で成功した場合 attempts=2", async () => {
    const engine = new RetryEngine();
    let callCount = 0;
    const result = await engine.executeWithRetry(
      async () => {
        callCount++;
        return callCount === 1 ? "" : "result";
      },
      defaultOptions,
    );
    expect(result.result).toBe("result");
    expect(result.attempts).toBe(2);
  });

  // REQ-NLM-016: 温度上限のリスペクト
  it("温度が maxTemperature を超えないことを確認", async () => {
    const engine = new RetryEngine();
    const temperatures: number[] = [];
    await engine.executeWithRetry(
      async (temperature: number) => {
        temperatures.push(temperature);
        return temperatures.length >= 5 ? "done" : "";
      },
      defaultOptions,
    );
    for (const temp of temperatures) {
      expect(temp).toBeLessThanOrEqual(defaultOptions.maxTemperature);
    }
  });

  // REQ-NLM-016: 全リトライ失敗
  it("全リトライ失敗時にエラーメッセージを返す", async () => {
    const engine = new RetryEngine();
    const result = await engine.executeWithRetry(
      async () => "",
      { ...defaultOptions, maxRetries: 3 },
    );
    expect(result.result).toContain("失敗");
    expect(result.attempts).toBe(3);
  });

  // REQ-NLM-016: maxRetries=0
  it("maxRetries=0 で即座にエラーを返す", async () => {
    const engine = new RetryEngine();
    const result = await engine.executeWithRetry(
      async () => "",
      { ...defaultOptions, maxRetries: 0 },
    );
    expect(result.result).toContain("失敗");
    expect(result.attempts).toBe(0);
  });

  // REQ-NLM-016: シード変更の確認
  it("リトライごとに数値のシードが渡される", async () => {
    const engine = new RetryEngine();
    const seeds: number[] = [];

    await engine.executeWithRetry(
      async (_temperature: number, seed: number) => {
        seeds.push(seed);
        return seeds.length >= 3 ? "done" : "";
      },
      { ...defaultOptions, maxRetries: 5 },
    );

    expect(seeds).toHaveLength(3);
    for (const seed of seeds) {
      expect(Number.isInteger(seed)).toBe(true);
      expect(Number.isFinite(seed)).toBe(true);
    }
  });
});

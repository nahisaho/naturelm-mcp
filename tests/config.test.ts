import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ConfigManager } from "../src/config.js";

describe("ConfigManager", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.NATURELM_BASE_URL;
    delete process.env.NATURELM_API_KEY;
    delete process.env.NATURELM_MODEL;
    delete process.env.NATURELM_TIMEOUT;
    delete process.env.NATURELM_TRANSPORT;
    delete process.env.NATURELM_HOST;
    delete process.env.NATURELM_PORT;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // REQ-NLM-011: デフォルト構成値
  describe("デフォルト値", () => {
    it("baseUrl のデフォルトは http://localhost:8080/v1", () => {
      const config = ConfigManager.load();
      expect(config.baseUrl).toBe("http://localhost:8080/v1");
    });

    it("apiKey のデフォルトは 'unused'", () => {
      const config = ConfigManager.load();
      expect(config.apiKey).toBe("unused");
    });

    it("model のデフォルトは 'naturelm-8x7b-inst'", () => {
      const config = ConfigManager.load();
      expect(config.model).toBe("naturelm-8x7b-inst");
    });

    it("timeout のデフォルトは 120000", () => {
      const config = ConfigManager.load();
      expect(config.timeout).toBe(120000);
    });
  });

  // REQ-NLM-011: 環境変数からの読み取り
  describe("環境変数", () => {
    it("NATURELM_BASE_URL を反映する", () => {
      process.env.NATURELM_BASE_URL = "http://example.com/v1";
      const config = ConfigManager.load();
      expect(config.baseUrl).toBe("http://example.com/v1");
    });

    it("NATURELM_API_KEY を反映する", () => {
      process.env.NATURELM_API_KEY = "test-key-12345";
      const config = ConfigManager.load();
      expect(config.apiKey).toBe("test-key-12345");
    });

    it("NATURELM_MODEL を反映する", () => {
      process.env.NATURELM_MODEL = "custom-model";
      const config = ConfigManager.load();
      expect(config.model).toBe("custom-model");
    });

    it("NATURELM_TIMEOUT を数値として反映する", () => {
      process.env.NATURELM_TIMEOUT = "60000";
      const config = ConfigManager.load();
      expect(config.timeout).toBe(60000);
    });
  });

  // REQ-NLM-011: CLI引数が環境変数より優先
  describe("CLI引数の優先", () => {
    it("--api-url が環境変数より優先される", () => {
      process.env.NATURELM_BASE_URL = "http://env.example.com/v1";
      const config = ConfigManager.load(["--api-url", "http://cli.example.com/v1"]);
      expect(config.baseUrl).toBe("http://cli.example.com/v1");
    });

    it("--api-key が環境変数より優先される", () => {
      process.env.NATURELM_API_KEY = "env-key";
      const config = ConfigManager.load(["--api-key", "cli-key"]);
      expect(config.apiKey).toBe("cli-key");
    });

    it("--model が環境変数より優先される", () => {
      process.env.NATURELM_MODEL = "env-model";
      const config = ConfigManager.load(["--model", "cli-model"]);
      expect(config.model).toBe("cli-model");
    });

    it("--timeout が環境変数より優先される", () => {
      process.env.NATURELM_TIMEOUT = "60000";
      const config = ConfigManager.load(["--timeout", "30000"]);
      expect(config.timeout).toBe(30000);
    });
  });

  // REQ-NLM-020: API キーマスク
  describe("maskApiKey", () => {
    it("先頭4文字 + **** を返す", () => {
      expect(ConfigManager.maskApiKey("abcdefgh")).toBe("abcd****");
    });

    it("4文字未満のキーもマスクする", () => {
      expect(ConfigManager.maskApiKey("ab")).toBe("ab****");
    });
  });

  // REQ-NLM-023: トランスポートモード選択
  describe("transport デフォルト値", () => {
    it("transport のデフォルトは 'stdio'", () => {
      const config = ConfigManager.load();
      expect(config.transport).toBe("stdio");
    });

    it("host のデフォルトは '127.0.0.1'", () => {
      const config = ConfigManager.load();
      expect(config.host).toBe("127.0.0.1");
    });

    it("port のデフォルトは 3000", () => {
      const config = ConfigManager.load();
      expect(config.port).toBe(3000);
    });
  });

  // REQ-NLM-023/026: 環境変数からの transport/host/port 読み取り
  describe("transport 環境変数", () => {
    it("NATURELM_TRANSPORT を反映する", () => {
      process.env.NATURELM_TRANSPORT = "sse";
      const config = ConfigManager.load();
      expect(config.transport).toBe("sse");
    });

    it("NATURELM_HOST を反映する", () => {
      process.env.NATURELM_HOST = "0.0.0.0";
      const config = ConfigManager.load();
      expect(config.host).toBe("0.0.0.0");
    });

    it("NATURELM_PORT を数値として反映する", () => {
      process.env.NATURELM_PORT = "8080";
      const config = ConfigManager.load();
      expect(config.port).toBe(8080);
    });
  });

  // REQ-NLM-023/026: CLI引数が環境変数より優先
  describe("transport CLI引数の優先", () => {
    it("--transport が環境変数より優先される", () => {
      process.env.NATURELM_TRANSPORT = "sse";
      const config = ConfigManager.load(["--transport", "http"]);
      expect(config.transport).toBe("http");
    });

    it("--host が環境変数より優先される", () => {
      process.env.NATURELM_HOST = "0.0.0.0";
      const config = ConfigManager.load(["--host", "192.168.1.1"]);
      expect(config.host).toBe("192.168.1.1");
    });

    it("--port が環境変数より優先される", () => {
      process.env.NATURELM_PORT = "8080";
      const config = ConfigManager.load(["--port", "9090"]);
      expect(config.port).toBe(9090);
    });
  });

  // REQ-NLM-023: 不正な transport 値のバリデーション
  describe("transport バリデーション", () => {
    it("不正な transport 値で validateTransport が false を返す", () => {
      expect(ConfigManager.isValidTransport("stdio")).toBe(true);
      expect(ConfigManager.isValidTransport("sse")).toBe(true);
      expect(ConfigManager.isValidTransport("http")).toBe(true);
      expect(ConfigManager.isValidTransport("websocket")).toBe(false);
      expect(ConfigManager.isValidTransport("")).toBe(false);
    });
  });
});

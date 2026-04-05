import type { NatureLMConfig, TransportMode } from "./types.js";

const VALID_TRANSPORTS: ReadonlySet<string> = new Set(["stdio", "sse", "http"]);

const DEFAULTS: NatureLMConfig = {
  baseUrl: "http://localhost:8080/v1",
  apiKey: "unused",
  model: "naturelm-8x7b-inst",
  timeout: 120000,
  transport: "stdio",
  host: "127.0.0.1",
  port: 3000,
};

const CLI_FLAGS: Record<string, keyof NatureLMConfig> = {
  "--api-url": "baseUrl",
  "--api-key": "apiKey",
  "--model": "model",
  "--timeout": "timeout",
  "--transport": "transport",
  "--host": "host",
  "--port": "port",
};

export class ConfigManager {
  static load(argv?: string[]): NatureLMConfig {
    const config: NatureLMConfig = { ...DEFAULTS };

    // ENV layer
    if (process.env.NATURELM_BASE_URL) config.baseUrl = process.env.NATURELM_BASE_URL;
    if (process.env.NATURELM_API_KEY) config.apiKey = process.env.NATURELM_API_KEY;
    if (process.env.NATURELM_MODEL) config.model = process.env.NATURELM_MODEL;
    if (process.env.NATURELM_TIMEOUT) config.timeout = Number(process.env.NATURELM_TIMEOUT);
    if (process.env.NATURELM_TRANSPORT) config.transport = process.env.NATURELM_TRANSPORT as string as TransportMode;
    if (process.env.NATURELM_HOST) config.host = process.env.NATURELM_HOST;
    if (process.env.NATURELM_PORT) config.port = Number(process.env.NATURELM_PORT);

    // CLI layer (highest priority)
    const args = argv ?? [];
    for (let i = 0; i < args.length; i++) {
      const flag = args[i];
      const value = args[i + 1];
      if (flag && value && flag in CLI_FLAGS) {
        const key = CLI_FLAGS[flag]!;
        if (key === "timeout" || key === "port") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (config as any)[key] = Number(value);
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (config as any)[key] = value;
        }
        i++; // skip value
      }
    }

    return config;
  }

  static isValidTransport(value: string): value is TransportMode {
    return VALID_TRANSPORTS.has(value);
  }

  static maskApiKey(key: string): string {
    return key.slice(0, 4) + "****";
  }
}

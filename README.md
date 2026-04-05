# NatureLM MCP Server

An MCP (Model Context Protocol) server that provides access to [NatureLM](https://github.com/microsoft/NatureLM) — Microsoft Research AI for Science's foundation model for small molecules, materials, proteins, DNA, and RNA.

## Features

- **10 scientific MCP tools** for molecular design, property prediction, and more
- **3 transport modes**: stdio, SSE, and Streamable HTTP
- Connects to any OpenAI-compatible NatureLM API server
- Automatic retry with seed variation and temperature escalation for empty outputs
- Scientific token extraction (`<mol>`, `<protein>`, `<material>` tags)

## Tools

| Tool | Description |
|------|-------------|
| `generate_smiles` | Generate SMILES notation for a molecule by name or desired properties |
| `validate_smiles` | Validate a SMILES string using NatureLM *(experimental)* |
| `predict_logp` | Predict the logP value of a molecule from its SMILES |
| `predict_molecular_weight` | Predict molecular weight from SMILES (AI prediction, use as reference) |
| `predict_property` | Predict a molecular property (e.g. solubility, boiling point) from SMILES |
| `retrosynthesis` | Propose retrosynthesis routes for a target molecule *(experimental)* |
| `generate_protein_sequence` | Generate a protein sequence for given properties *(experimental)* |
| `predict_material_composition` | Predict material composition for target properties *(experimental)* |
| `ask_naturelm` | Ask NatureLM a free-form scientific question |
| `get_model_info` | Get NatureLM model information and capabilities |

## Prerequisites

- **Node.js** 20+
- **NatureLM API server** running with an OpenAI-compatible endpoint (e.g. via [llama.cpp](https://github.com/ggml-org/llama.cpp), [vLLM](https://github.com/vllm-project/vllm), etc.)

## Installation

```bash
git clone https://github.com/nahisaho/naturelm-mcp.git
cd naturelm-mcp
npm install
npm run build
```

## Configuration

Settings are loaded in priority order: **CLI args > Environment variables > Defaults**.

| Setting | ENV | CLI | Default |
|---------|-----|-----|---------|
| API Base URL | `NATURELM_BASE_URL` | `--api-url` | `http://localhost:8080/v1` |
| API Key | `NATURELM_API_KEY` | `--api-key` | `unused` |
| Model ID | `NATURELM_MODEL` | `--model` | `naturelm-8x7b-inst` |
| Timeout (ms) | `NATURELM_TIMEOUT` | `--timeout` | `120000` |
| Transport | `NATURELM_TRANSPORT` | `--transport` | `stdio` |
| Bind Host | `NATURELM_HOST` | `--host` | `127.0.0.1` |
| Bind Port | `NATURELM_PORT` | `--port` | `3000` |

## Usage

### stdio (default)

```bash
node dist/index.js --api-url http://192.168.1.100:8080/v1
```

#### Claude Desktop configuration

```json
{
  "mcpServers": {
    "naturelm": {
      "command": "node",
      "args": ["/path/to/naturelm-mcp/dist/index.js"],
      "env": {
        "NATURELM_BASE_URL": "http://192.168.1.100:8080/v1"
      }
    }
  }
}
```

### SSE

```bash
node dist/index.js --transport sse --port 3000
```

Clients connect via `GET /sse` and send messages via `POST /message?sessionId=...`.

> **Note**: SSE transport is deprecated in the MCP SDK. Use Streamable HTTP for new integrations.

### Streamable HTTP

```bash
node dist/index.js --transport http --port 3000
```

Clients interact via `POST /mcp` (initialize), then use the `mcp-session-id` header for subsequent requests. Supports `POST`, `GET`, and `DELETE` on `/mcp`.

## Development

```bash
# Type check
npm run check

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with tsx (no build required)
npm run dev
```

## Architecture

```
src/
├── index.ts              # Entrypoint: config, registry, healthcheck
├── config.ts             # ConfigManager (ENV / CLI / defaults)
├── transport.ts          # Transport factory (stdio / SSE / Streamable HTTP)
├── client.ts             # NatureLMClient (OpenAI-compatible API client)
├── retry.ts              # RetryEngine (empty output retry with seed/temp escalation)
├── normalizer.ts         # ResponseNormalizer (scientific tag extraction)
├── prompt-template.ts    # PromptTemplate (Instruction/Response format)
├── types.ts              # Shared type definitions
└── tools/
    ├── registry.ts       # ToolRegistry (register / list / call)
    ├── generate-smiles.ts
    ├── validate-smiles.ts
    ├── predict-logp.ts
    ├── predict-mw.ts
    ├── predict-property.ts
    ├── retrosynthesis.ts
    ├── generate-protein.ts
    ├── predict-material.ts
    ├── ask-naturelm.ts
    └── model-info.ts
```

## License

MIT

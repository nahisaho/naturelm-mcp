# NatureLM MCP Server

[NatureLM](https://github.com/microsoft/NatureLM)（Microsoft Research AI for Science が開発した科学基盤モデル）を MCP（Model Context Protocol）経由で利用可能にするサーバーです。小分子・材料・タンパク質・DNA・RNA を横断した科学タスクを実行できます。

## 特徴

- **10 種類の科学 MCP ツール** — 分子設計、物性予測、逆合成分析など
- **3 つのトランスポート** — stdio / SSE / Streamable HTTP
- OpenAI 互換の NatureLM API サーバーに接続
- 空出力時の自動リトライ（シード変更 + 温度昇温）
- 科学トークンの自動抽出（`<mol>`, `<protein>`, `<material>` タグ）

## ツール一覧

| ツール | 説明 |
|--------|------|
| `generate_smiles` | 分子名や特性から SMILES 表記を生成 |
| `validate_smiles` | SMILES 文字列の妥当性を検証 *（実験的）* |
| `predict_logp` | SMILES から logP（分配係数）を予測 |
| `predict_molecular_weight` | SMILES から分子量を予測（AI 推定、参考値） |
| `predict_property` | SMILES から分子特性（溶解度、沸点等）を予測 |
| `retrosynthesis` | 目標分子の逆合成経路を提案 *（実験的）* |
| `generate_protein_sequence` | 指定した特性を持つタンパク質配列を生成 *（実験的）* |
| `predict_material_composition` | 目標特性に対する材料組成を予測 *（実験的）* |
| `ask_naturelm` | NatureLM に自由形式の科学的質問を送信 |
| `get_model_info` | NatureLM のモデル情報と能力を取得 |

## 前提条件

- **Node.js** 20 以上
- **NatureLM API サーバー** が OpenAI 互換エンドポイントとして稼働していること（[llama.cpp](https://github.com/ggml-org/llama.cpp)、[vLLM](https://github.com/vllm-project/vllm) 等）

## インストール

```bash
git clone https://github.com/nahisaho/naturelm-mcp.git
cd naturelm-mcp
npm install
npm run build
```

## 設定

設定は **CLI 引数 > 環境変数 > デフォルト** の優先順位で読み込まれます。

| 設定項目 | 環境変数 | CLI 引数 | デフォルト |
|---------|---------|----------|-----------|
| API ベース URL | `NATURELM_BASE_URL` | `--api-url` | `http://localhost:8080/v1` |
| API キー | `NATURELM_API_KEY` | `--api-key` | `unused` |
| モデル ID | `NATURELM_MODEL` | `--model` | `naturelm-8x7b-inst` |
| タイムアウト (ms) | `NATURELM_TIMEOUT` | `--timeout` | `120000` |
| トランスポート | `NATURELM_TRANSPORT` | `--transport` | `stdio` |
| バインドホスト | `NATURELM_HOST` | `--host` | `127.0.0.1` |
| バインドポート | `NATURELM_PORT` | `--port` | `3000` |

## 使い方

### stdio（デフォルト）

```bash
node dist/index.js --api-url http://192.168.1.100:8080/v1
```

#### Claude Desktop での設定例

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

クライアントは `GET /sse` で接続し、`POST /message?sessionId=...` でメッセージを送信します。

> **注意**: SSE トランスポートは MCP SDK で非推奨です。新規導入には Streamable HTTP を推奨します。

### Streamable HTTP

```bash
node dist/index.js --transport http --port 3000
```

クライアントは `POST /mcp` で初期化し、以降は `mcp-session-id` ヘッダを付与してリクエストします。`/mcp` エンドポイントで `POST`・`GET`・`DELETE` をサポートします。

## 開発

```bash
# 型チェック
npm run check

# テスト実行
npm test

# テスト（ウォッチモード）
npm run test:watch

# tsx で直接実行（ビルド不要）
npm run dev
```

## アーキテクチャ

```
src/
├── index.ts              # エントリポイント: 設定, レジストリ, ヘルスチェック
├── config.ts             # ConfigManager（ENV / CLI / デフォルト）
├── transport.ts          # トランスポートファクトリ（stdio / SSE / Streamable HTTP）
├── client.ts             # NatureLMClient（OpenAI 互換 API クライアント）
├── retry.ts              # RetryEngine（空出力リトライ: シード変更 + 温度昇温）
├── normalizer.ts         # ResponseNormalizer（科学トークン抽出）
├── prompt-template.ts    # PromptTemplate（Instruction/Response 形式）
├── types.ts              # 共通型定義
└── tools/
    ├── registry.ts       # ToolRegistry（登録 / 一覧 / 実行）
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

## ライセンス

MIT

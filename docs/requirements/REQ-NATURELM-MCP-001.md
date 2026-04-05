# NatureLM MCP Server 要件定義書

| メタデータ | 値 |
|-----------|-----|
| **ドキュメントID** | REQ-NATURELM-MCP-001 |
| **バージョン** | 1.4.0 |
| **ステータス** | Approved |
| **作成日** | 2026-04-05 |
| **作成者** | AI Assistant |

---

## 1. 概要

### 1.1 プロジェクト概要

NatureLM MCP Server は、Microsoft Research AI for Science が開発した科学基盤モデル「NatureLM」を MCP（Model Context Protocol）経由で利用可能にするサーバーである。

本プロジェクトでは、Windows 上で稼働する OpenAI 互換の NatureLM API サーバーを外部依存として利用し、MCP クライアントから科学タスクを安全かつ一貫したインターフェースで実行可能にする。

NatureLM は小分子・材料・タンパク質・DNA・RNA を横断する科学ドメインに特化した LLM であり、SMILES 生成、物性予測、逆合成分析等の科学的タスクを実行できる。

### 1.2 目的

- Claude Desktop / VS Code 等の MCP クライアントから NatureLM の機能を利用可能にする
- 科学研究・創薬・材料科学の分野で AI アシスタントによる分子設計支援を実現する
- OpenAI 互換 API で動作する NatureLM サーバーを MCP ツールとして抽象化する

### 1.3 スコープ

| 項目 | 内容 |
|------|------|
| **対象システム** | NatureLM MCP Server |
| **接続先** | Windows 上で稼働する NatureLM OpenAI 互換 API（検証済み: `http://192.168.224.1:8080/v1`、`/chat/completions`、`/completions`、`/models`） |
| **対象ユーザー** | 科学研究者、創薬研究者、AI アシスタント利用者 |
| **プラットフォーム** | Node.js / TypeScript |

### 1.4 現時点の前提

- NatureLM は Windows 上で OpenAI 互換 API として稼働している
- MCP Server は NatureLM 本体を内包せず、HTTP 経由で外部 API を呼び出す
- OpenAI 互換 API は `chat.completions` を主契約とし、`models` により利用可能モデルを取得できる
- 科学トークンのデコードは API サーバー側で実施されることを前提とするが、MCP Server 側でも応答正規化を行う

### 1.5 検証済み接続情報

- WSL から見える Windows ホスト IP は `192.168.224.1` である
- NatureLM API のベース URL は `http://192.168.224.1:8080/v1` で疎通確認済みである
- `GET /models` は HTTP 200 を返し、モデル `naturelm-8x7b-inst` が取得できる
- `POST /chat/completions` は HTTP 200 を返し、実推論応答を返却できる
- 以上の値は 2026-04-05 時点の検証結果であり、実装では環境変数または CLI 引数で上書き可能とする

---

## 2. ステークホルダー

| ステークホルダー | 役割 | 関心事 |
|-----------------|------|--------|
| 科学研究者 | エンドユーザー | 分子設計、物性予測の精度と使いやすさ |
| 創薬研究者 | エンドユーザー | SMILES 生成、逆合成分析の信頼性 |
| MCP クライアント | システム | 標準的な MCP プロトコル準拠 |
| MCP Server 開発者 / 運用者 | 開発・運用 | Windows 上の NatureLM への接続性、設定容易性、障害解析性 |
| NatureLM API | 外部依存 | OpenAI 互換 API の安定性 |

---

## 3. 機能要件

### 3.1 MCP ツール: SMILES 生成

#### REQ-NLM-001: SMILES 生成ツール

**種別**: EVENT-DRIVEN  
**優先度**: P0

**要件**:
WHEN ユーザーが分子名または特性を指定して SMILES 生成を要求する,
THE システム SHALL NatureLM API を呼び出して SMILES 表記を生成し、結果を返却する。

**受入基準**:
- [ ] `generate_smiles` ツールが MCP プロトコルで公開される
- [ ] 分子名（例: "caffeine", "aspirin"）から SMILES を生成できる
- [ ] 特性指定（例: "4つの水素結合ドナーを持つ分子"）から SMILES を生成できる
- [ ] 生成結果に `<mol>...</mol>` タグが含まれる場合、SMILES 部分のみを抽出して返却する
- [ ] 生成失敗時はエラーメッセージを返却する

**トレーサビリティ**: DES-NLM-001  
**パッケージ**: `naturelm-mcp`

---

#### REQ-NLM-002: SMILES 検証ツール ⚠️ 実験的

**種別**: EVENT-DRIVEN  
**優先度**: P1  
**ステータス**: 実験的（NatureLM での検証タスクは未実証）

**要件**:
WHEN ユーザーが SMILES 文字列の検証を要求する,
THE システム SHALL NatureLM に SMILES の妥当性を問い合わせ、検証結果を返却する。

**受入基準**:
- [ ] `validate_smiles` ツールが MCP プロトコルで公開される
- [ ] 有効な SMILES 文字列の場合は true を返却する
- [ ] 無効な SMILES 文字列の場合は false とエラー理由を返却する
- [ ] 結果は参考値として扱い、確定的な検証には RDKit 等の専用ライブラリを使用すること

**トレーサビリティ**: DES-NLM-002  
**パッケージ**: `naturelm-mcp`

---

### 3.2 MCP ツール: 物性予測

#### REQ-NLM-003: logP 予測ツール

**種別**: EVENT-DRIVEN  
**優先度**: P0

**要件**:
WHEN ユーザーが SMILES 文字列を指定して logP 予測を要求する,
THE システム SHALL NatureLM API を呼び出して logP 値を予測し、数値結果を返却する。

**受入基準**:
- [ ] `predict_logp` ツールが MCP プロトコルで公開される
- [ ] SMILES 文字列を入力として受け取る
- [ ] logP 値を数値として返却する
- [ ] 予測不可能な場合はエラーメッセージを返却する

**トレーサビリティ**: DES-NLM-003  
**パッケージ**: `naturelm-mcp`

---

#### REQ-NLM-004: 分子量予測ツール

**種別**: EVENT-DRIVEN  
**優先度**: P0

**要件**:
WHEN ユーザーが SMILES 文字列を指定して分子量予測を要求する,
THE システム SHALL NatureLM API を呼び出して分子量を予測し、数値結果を返却する。

**受入基準**:
- [ ] `predict_molecular_weight` ツールが MCP プロトコルで公開される
- [ ] SMILES 文字列を入力として受け取る
- [ ] 分子量を数値（g/mol）として返却する
- [ ] 予測不可能な場合はエラーメッセージを返却する
- [ ] ⚠️ 返却値は AI 予測値であり、参考値として扱うこと（精度検証において誤差が確認されている）

**トレーサビリティ**: DES-NLM-004  
**パッケージ**: `naturelm-mcp`

---

#### REQ-NLM-005: 汎用物性予測ツール

**種別**: EVENT-DRIVEN  
**優先度**: P1

**要件**:
WHEN ユーザーが SMILES 文字列と物性名を指定して物性予測を要求する,
THE システム SHALL NatureLM API を呼び出して指定された物性を予測し、結果を返却する。

**受入基準**:
- [ ] `predict_property` ツールが MCP プロトコルで公開される
- [ ] SMILES 文字列と物性名（例: "solubility", "boiling_point"）を入力として受け取る
- [ ] 予測結果を適切な形式で返却する
- [ ] サポートされていない物性の場合はエラーメッセージを返却する

**トレーサビリティ**: DES-NLM-005  
**パッケージ**: `naturelm-mcp`

---

### 3.3 MCP ツール: 逆合成分析

#### REQ-NLM-006: 逆合成分析ツール ⚠️ 実験的

**種別**: EVENT-DRIVEN  
**優先度**: P1  
**ステータス**: 実験的（量子化モデルでは空出力になる場合がある）

**要件**:
WHEN ユーザーが SMILES 文字列を指定して逆合成分析を要求する,
THE システム SHALL NatureLM API を呼び出して合成経路を提案し、結果を返却する。

**受入基準**:
- [ ] `retrosynthesis` ツールが MCP プロトコルで公開される
- [ ] ターゲット分子の SMILES を入力として受け取る
- [ ] 合成前駆体の SMILES リストを返却する
- [ ] 合成経路が見つからない場合はエラーメッセージを返却する
- [ ] 空出力時はリトライ機能（REQ-NLM-016）を使用して再試行する

**トレーサビリティ**: DES-NLM-006  
**パッケージ**: `naturelm-mcp`

---

### 3.4 MCP ツール: タンパク質・材料

#### REQ-NLM-007: タンパク質配列生成ツール ⚠️ 実験的

**種別**: EVENT-DRIVEN  
**優先度**: P2  
**ステータス**: 実験的（量子化モデルでの生成品質は未検証）

**要件**:
WHEN ユーザーがタンパク質の特性を指定して配列生成を要求する,
THE システム SHALL NatureLM API を呼び出してタンパク質配列を生成し、結果を返却する。

**受入基準**:
- [ ] `generate_protein_sequence` ツールが MCP プロトコルで公開される
- [ ] タンパク質の特性・機能を入力として受け取る
- [ ] アミノ酸配列を返却する
- [ ] `<protein>...</protein>` タグから配列を抽出して返却する
- [ ] 生成結果は参考値として扱い、専門家による検証を推奨する旨を明記する

**トレーサビリティ**: DES-NLM-007  
**パッケージ**: `naturelm-mcp`

---

#### REQ-NLM-008: 材料組成予測ツール ⚠️ 実験的

**種別**: EVENT-DRIVEN  
**優先度**: P2  
**ステータス**: 実験的（量子化モデルでの生成品質は未検証）

**要件**:
WHEN ユーザーが材料の特性を指定して組成予測を要求する,
THE システム SHALL NatureLM API を呼び出して材料組成を予測し、結果を返却する。

**受入基準**:
- [ ] `predict_material_composition` ツールが MCP プロトコルで公開される
- [ ] 目標特性を入力として受け取る
- [ ] 材料組成（元素と比率）を返却する
- [ ] `<material>...</material>` タグから組成を抽出して返却する
- [ ] 生成結果は参考値として扱い、専門家による検証を推奨する旨を明記する

**トレーサビリティ**: DES-NLM-008  
**パッケージ**: `naturelm-mcp`

---

### 3.5 MCP ツール: ユーティリティ

#### REQ-NLM-009: 自由形式クエリツール

**種別**: EVENT-DRIVEN  
**優先度**: P1

**要件**:
WHEN ユーザーが科学的な質問を自由形式で入力する,
THE システム SHALL NatureLM API を呼び出して回答を生成し、結果を返却する。

**受入基準**:
- [ ] `ask_naturelm` ツールが MCP プロトコルで公開される
- [ ] 自由形式のテキストを入力として受け取る
- [ ] NatureLM の回答をそのまま返却する
- [ ] 科学トークン（`<mol>`, `<protein>` 等）を含む回答も正しく返却する

**トレーサビリティ**: DES-NLM-009  
**パッケージ**: `naturelm-mcp`

---

#### REQ-NLM-010: モデル情報取得ツール

**種別**: UBIQUITOUS  
**優先度**: P2

**要件**:
THE システム SHALL NatureLM モデルの情報（名前、バージョン、ケイパビリティ）を取得するツールを提供する。

**受入基準**:
- [ ] `get_model_info` ツールが MCP プロトコルで公開される
- [ ] モデル名、バージョン、対応タスク一覧を返却する

**トレーサビリティ**: DES-NLM-010  
**パッケージ**: `naturelm-mcp`

---

## 4. 非機能要件

### 4.1 接続性

#### REQ-NLM-011: API エンドポイント設定

**種別**: UBIQUITOUS  
**優先度**: P0

**要件**:
THE システム SHALL 環境変数またはコマンドライン引数で NatureLM OpenAI 互換 API のベース URL を設定可能とする。

**受入基準**:
- [ ] `NATURELM_BASE_URL` 環境変数または `--api-url` 引数でベース URL を設定できる
- [ ] NatureLM と MCP Server が同一 OS 上で動作する場合の既定値は `http://localhost:8080/v1` とする
- [ ] WSL から Windows 上の NatureLM を利用する場合の推奨値は `http://192.168.224.1:8080/v1` とする
- [ ] 起動時に `GET /models` または同等の軽量確認で接続確認を行う
- [ ] Linux / WSL 上で稼働する MCP Server から Windows 上の NatureLM に接続するため、固定 IP に依存しない
- [ ] 現在の検証環境 `http://192.168.224.1:8080/v1` を明示設定した場合に接続確認が成功する

**トレーサビリティ**: DES-NLM-011  
**パッケージ**: `naturelm-mcp`

---

#### REQ-NLM-012: 接続エラーハンドリング

**種別**: COMPLEX  
**優先度**: P0

**要件**:
IF NatureLM API への接続に失敗する, THEN THE システム SHALL 適切なエラーメッセージを返却し、MCP サーバープロセスを継続可能な状態に保つ。

**受入基準**:
- [ ] API 接続タイムアウト時にエラーメッセージを返却する
- [ ] API サーバーダウン時にエラーメッセージを返却する
- [ ] Windows 側のバインドアドレスまたはファイアウォールが原因で到達不能な場合、設定確認の手掛かりを含む
- [ ] リトライ機能を提供する（最大3回、指数バックオフ）

**トレーサビリティ**: DES-NLM-012  
**パッケージ**: `naturelm-mcp`

---

### 4.2 パフォーマンス

#### REQ-NLM-013: タイムアウト設定

**種別**: UBIQUITOUS  
**優先度**: P1

**要件**:
THE システム SHALL API リクエストのタイムアウトを設定可能とし、デフォルト値を120秒とする。

**受入基準**:
- [ ] `NATURELM_TIMEOUT` 環境変数でタイムアウトを設定できる
- [ ] デフォルトタイムアウトは120秒（NatureLM は CPU 推論で低速なため）
- [ ] タイムアウト発生時は適切なエラーメッセージを返却する

**トレーサビリティ**: DES-NLM-013  
**パッケージ**: `naturelm-mcp`

---

### 4.3 MCP プロトコル準拠

#### REQ-NLM-014: MCP 標準準拠

**種別**: UBIQUITOUS  
**優先度**: P0

**要件**:
THE システム SHALL MCP（Model Context Protocol）標準に準拠したサーバーとして動作する。

**受入基準**:
- [ ] `@modelcontextprotocol/sdk` を使用して MCP サーバーを実装する
- [ ] stdio トランスポートをサポートする
- [ ] SSE トランスポートをサポートする（REQ-NLM-024 で拡張）
- [ ] Streamable HTTP トランスポートをサポートする（REQ-NLM-025 で拡張）
- [ ] `tools/list` で全ツールの一覧を返却する
- [ ] `tools/call` でツールを実行できる
- [ ] Claude Desktop の `mcp_servers` 設定で利用可能である

**トレーサビリティ**: DES-NLM-014  
**パッケージ**: `naturelm-mcp`

---

#### REQ-NLM-015: ツールスキーマ定義

**種別**: UBIQUITOUS  
**優先度**: P0

**要件**:
THE システム SHALL 各ツールに対して JSON Schema 形式の入力スキーマを定義する。

**受入基準**:
- [ ] 全ツールに `inputSchema` が定義されている
- [ ] 必須パラメータと任意パラメータが明確に定義されている
- [ ] パラメータの型と説明が記載されている

**トレーサビリティ**: DES-NLM-015  
**パッケージ**: `naturelm-mcp`

---

### 4.4 NatureLM 固有の対応

#### REQ-NLM-016: 空出力リトライ機能

**種別**: EVENT-DRIVEN  
**優先度**: P0

**要件**:
WHEN NatureLM API が空の出力（即座に EOS トークンを出力）を返却する,
THE システム SHALL シード変更と温度昇温を行い、自動リトライを実行する。

**受入基準**:
- [ ] 空出力を検出した場合、最大5回までリトライする
- [ ] リトライごとにランダムシードを変更する
- [ ] リトライごとに temperature を +0.15 ずつ昇温する（最大1.0）
- [ ] 全リトライ失敗時は「生成に失敗しました。より具体的なプロンプトをお試しください」と返却する
- [ ] リトライ回数を応答メタデータに含める

**トレーサビリティ**: DES-NLM-016  
**パッケージ**: `naturelm-mcp`

---

#### REQ-NLM-017: 科学トークン抽出機能

**種別**: EVENT-DRIVEN  
**優先度**: P0

**要件**:
WHEN NatureLM API の応答に科学トークン（`<mol>`, `<protein>`, `<material>` 等）が含まれる,
THE システム SHALL タグ内のコンテンツを抽出して整形した結果を返却する。

**受入基準**:
- [ ] `<mol>...</mol>` タグから SMILES 表記を抽出し、`<m>` プレフィックスを除去する
- [ ] `<protein>...</protein>` タグからアミノ酸配列を抽出する
- [ ] `<material>...</material>` タグから材料組成を抽出する
- [ ] 抽出元の生データも `raw_response` フィールドで返却する
- [ ] タグが見つからない場合は応答をそのまま返却する

**トレーサビリティ**: DES-NLM-017  
**パッケージ**: `naturelm-mcp`

---

#### REQ-NLM-018: プロンプトテンプレート適用

**種別**: OPTIONAL  
**優先度**: P0

**要件**:
WHERE 接続先の NatureLM API が生プロンプト入力または Completions API での明示テンプレート指定を要求する,
THE システム SHALL NatureLM の Instruction-Response テンプレートを内部的に適用可能とする。

**受入基準**:
- [ ] Completions API を使用する構成では、ユーザー入力を `Instruction: {input}\n\n\nResponse:\n` 形式でラップできる
- [ ] 必要な構成ではストップシーケンス `Instruction:` と `</s>` を設定できる
- [ ] Chat Completions API がそのまま利用可能な構成では、メッセージ API を優先し二重ラップしない
- [ ] テンプレート適用の有無は内部処理とし、ユーザーには意識させない

**トレーサビリティ**: DES-NLM-018  
**パッケージ**: `naturelm-mcp`

---

#### REQ-NLM-019: OpenAI 互換 Chat Completions 利用

**種別**: EVENT-DRIVEN  
**優先度**: P0

**要件**:
WHEN MCP ツールが NatureLM の推論を要求する,
THE システム SHALL NatureLM OpenAI 互換 API の `POST /chat/completions` を優先的に使用して推論を実行する。

**受入基準**:
- [ ] OpenAI 互換クライアント経由で `chat.completions.create()` を利用する
- [ ] `model`、`messages`、`temperature`、`max_tokens` を設定してリクエストする
- [ ] ツール要件に応じて `max_retries` 等の拡張パラメータを渡せる
- [ ] 現在の検証済み NatureLM API では Chat Completions を既定の推論経路とする
- [ ] API 応答から最終テキストを抽出して各 MCP ツールの戻り値へ変換する

**トレーサビリティ**: DES-NLM-019  
**パッケージ**: `naturelm-mcp`

---

#### REQ-NLM-020: API キー設定

**種別**: UBIQUITOUS  
**優先度**: P1

**要件**:
THE システム SHALL NatureLM OpenAI 互換 API の認証情報を設定可能とする。

**受入基準**:
- [ ] `NATURELM_API_KEY` 環境変数または `--api-key` 引数で API キーを設定できる
- [ ] API キーが不要な環境でもダミー値で動作できる
- [ ] ログおよびエラーメッセージに API キーの平文を出力しない

**トレーサビリティ**: DES-NLM-020  
**パッケージ**: `naturelm-mcp`

---

#### REQ-NLM-021: モデル識別子設定

**種別**: UBIQUITOUS  
**優先度**: P1

**要件**:
THE システム SHALL NatureLM のモデル識別子を設定可能とする。

**受入基準**:
- [ ] `NATURELM_MODEL` 環境変数または `--model` 引数でモデル識別子を設定できる
- [ ] デフォルトモデル識別子は `naturelm-8x7b-inst` とする
- [ ] 起動時の接続確認で利用可能モデル一覧と整合しない場合、警告またはエラーを返却する

**トレーサビリティ**: DES-NLM-021  
**パッケージ**: `naturelm-mcp`

---

#### REQ-NLM-022: 応答正規化

**種別**: EVENT-DRIVEN  
**優先度**: P0

**要件**:
WHEN NatureLM OpenAI 互換 API が推論結果を返却する,
THE システム SHALL タグ付き応答とプレーンテキスト応答の両方を正規化して MCP ツールの結果に変換する。

**受入基準**:
- [ ] `<mol>...</mol>`、`<protein>...</protein>`、`<material>...</material>` を含む応答を整形できる
- [ ] 既にプレーンテキストへデコード済みの応答もそのまま扱える
- [ ] ツール固有の整形後も `raw_response` として元応答を保持できる
- [ ] 正規化不能な場合は生応答を失わずに返却する

**トレーサビリティ**: DES-NLM-022  
**パッケージ**: `naturelm-mcp`

---

### 4.5 マルチトランスポート対応

#### REQ-NLM-023: トランスポートモード選択

**種別**: UBIQUITOUS
**優先度**: P0

**要件**:
THE システム SHALL 起動時にトランスポートモード（stdio / sse / http）を選択可能とする。

**受入基準**:
- [ ] `--transport` CLI 引数で `stdio`、`sse`、`http` のいずれかを指定できる
- [ ] `NATURELM_TRANSPORT` 環境変数でも指定できる（CLI が優先）
- [ ] 未指定時のデフォルトは `stdio` とする
- [ ] 不正な値が指定された場合、エラーメッセージを出力して終了する

**トレーサビリティ**: DES-NLM-023
**パッケージ**: `naturelm-mcp`

---

#### REQ-NLM-024: SSE トランスポート

**種別**: EVENT-DRIVEN
**優先度**: P1
**ステータス**: レガシー互換（SDK で deprecated。Streamable HTTP を推奨）

**要件**:
WHEN ユーザーが `--transport sse` を指定して MCP Server を起動する,
THE システム SHALL SSE（Server-Sent Events）トランスポートで MCP プロトコルを提供する。

**受入基準**:
- [ ] `GET /sse` で SSE 接続を確立できる
- [ ] `POST /message` で JSON-RPC メッセージを送信できる
- [ ] SDK の `SSEServerTransport` を使用する
- [ ] 複数クライアント接続時、セッションごとに独立した SSE ストリームを提供する

**トレーサビリティ**: DES-NLM-024
**パッケージ**: `naturelm-mcp`

---

#### REQ-NLM-025: Streamable HTTP トランスポート

**種別**: EVENT-DRIVEN
**優先度**: P0

**要件**:
WHEN ユーザーが `--transport http` を指定して MCP Server を起動する,
THE システム SHALL Streamable HTTP トランスポート（stateful mode）で MCP プロトコルを提供する。

**受入基準**:
- [ ] エンドポイントは `/mcp`（固定）とする
- [ ] POST / GET / DELETE メソッドを受け付ける
- [ ] stateful mode で動作し、セッション ID をレスポンスヘッダに含める
- [ ] 無効なセッション ID のリクエストには 404 Not Found を返却する
- [ ] 初期化リクエスト以外でセッション ID が欠落している場合は 400 Bad Request を返却する
- [ ] SDK の `StreamableHTTPServerTransport` を使用する

**トレーサビリティ**: DES-NLM-025
**パッケージ**: `naturelm-mcp`

---

#### REQ-NLM-026: HTTP バインド設定

**種別**: UBIQUITOUS
**優先度**: P0

**要件**:
THE システム SHALL SSE および Streamable HTTP トランスポート使用時のバインドアドレスとポートを設定可能とする。

**受入基準**:
- [ ] `NATURELM_HOST` 環境変数または `--host` 引数でバインドアドレスを指定できる
- [ ] `NATURELM_PORT` 環境変数または `--port` 引数でポート番号を指定できる
- [ ] デフォルトホストは `127.0.0.1` とする
- [ ] デフォルトポートは `3000` とする
- [ ] CLI 引数は環境変数より優先する

**トレーサビリティ**: DES-NLM-026
**パッケージ**: `naturelm-mcp`

---

## 5. 技術制約

| 制約 | 内容 |
|------|------|
| ランタイム | Node.js 20+ |
| 言語 | TypeScript 5.3+ / ESM |
| MCP SDK | `@modelcontextprotocol/sdk` 最新版 |
| HTTP クライアント | `openai` パッケージ（OpenAI 互換 API） |
| 依存 | NatureLM API サーバーが稼働していること |

---

## 6. 用語集

| 用語 | 定義 |
|------|------|
| **SMILES** | Simplified Molecular Input Line Entry System。分子構造のテキスト表記 |
| **logP** | 分配係数。分子の親水性/疎水性を示す指標 |
| **NatureLM** | Microsoft Research AI for Science が開発した科学基盤 LLM |
| **MCP** | Model Context Protocol。LLM とツール間の通信プロトコル |
| **逆合成** | 目標分子から出発物質を逆算する合成経路設計手法 |

---

## 7. 変更履歴

| バージョン | 日付 | 変更者 | 変更内容 |
|-----------|------|--------|----------|
| 1.0.0 | 2026-04-05 | AI Assistant | 初版作成 |
| 1.1.0 | 2026-04-05 | AI Assistant | レビュー指摘反映: 実験的機能ラベル追加、空出力リトライ要件追加、科学トークン抽出要件追加 |
| 1.2.0 | 2026-04-05 | GitHub Copilot | Windows 上の OpenAI 互換 NatureLM 前提を明文化し、接続設定・認証・モデル設定・互換 API 契約を追加 |
| 1.2.1 | 2026-04-05 | GitHub Copilot | WSL からの実測結果に基づき、Windows ホスト IP、ベース URL、疎通確認済みモデル ID を追記 |
| 1.2.2 | 2026-04-06 | GitHub Copilot | レビュー指摘を反映し、版番号整合、接続既定値の明確化、テンプレート適用要件と Chat Completions 要件の衝突を解消 |
| 1.3.0 | 2026-04-06 | GitHub Copilot | レビュー PASS。ステータスを Approved に変更 |
| 1.4.0 | 2026-04-06 | GitHub Copilot | REQ-NLM-023~026 追加: SSE / Streamable HTTP マルチトランスポート対応。REQ-NLM-014 受入基準を拡張 |

---

## 8. 承認

| 役割 | 名前 | 日付 | 署名 |
|------|------|------|------|
| プロダクトオーナー | nahisaho | 2026-04-06 | ✅ 承認 |
| 技術リード | GitHub Copilot | 2026-04-06 | ✅ 承認 |

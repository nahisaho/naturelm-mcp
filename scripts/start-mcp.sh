#!/usr/bin/env bash
# =============================================================================
# NatureLM MCP Server 起動スクリプト
# =============================================================================
# vLLM サーバー起動後に実行し、MCP サーバーを起動する
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="${SCRIPT_DIR}/.."
VLLM_URL="${VLLM_URL:-http://localhost:8080/v1}"
TRANSPORT="${TRANSPORT:-stdio}"
MCP_PORT="${MCP_PORT:-3000}"
MCP_HOST="${MCP_HOST:-0.0.0.0}"

echo "============================================"
echo " NatureLM MCP Server"
echo "============================================"
echo "  vLLM API: $VLLM_URL"
echo "  Transport: $TRANSPORT"
if [ "$TRANSPORT" != "stdio" ]; then
  echo "  Port: $MCP_PORT"
  echo "  Host: $MCP_HOST"
fi
echo "============================================"

cd "$PROJECT_DIR"

if [ "$TRANSPORT" = "stdio" ]; then
  exec node dist/src/index.js \
    --api-url "$VLLM_URL" \
    --model "naturelm-8x7b-inst"
else
  exec node dist/src/index.js \
    --api-url "$VLLM_URL" \
    --model "naturelm-8x7b-inst" \
    --transport "$TRANSPORT" \
    --port "$MCP_PORT" \
    --host "$MCP_HOST"
fi

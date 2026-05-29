#!/usr/bin/env bash
# =============================================================================
# NatureLM-8x7B-Inst vLLM Setup Script for NVIDIA DGX Spark
# =============================================================================
# DGX Spark (GB10 Grace Blackwell) に vLLM をインストールし、
# NatureLM-8x7B-Inst を OpenAI 互換 API サーバーとして起動するスクリプト
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV_DIR="${SCRIPT_DIR}/../.venv"
MODEL_PATH="${MODEL_PATH:-/home/nahisaho/models/NatureLM-8x7B-Inst}"
HOST="${VLLM_HOST:-0.0.0.0}"
PORT="${VLLM_PORT:-8080}"

echo "============================================"
echo " NatureLM vLLM Setup for DGX Spark"
echo "============================================"

# 1. Python venv の作成
if [ ! -d "$VENV_DIR" ]; then
  echo "[1/4] Creating Python virtual environment..."
  python3 -m venv "$VENV_DIR"
else
  echo "[1/4] Virtual environment already exists."
fi
source "$VENV_DIR/bin/activate"

# 2. vLLM のインストール
if ! python3 -c "import vllm" 2>/dev/null; then
  echo "[2/4] Installing vLLM and dependencies..."
  pip install --upgrade pip
  pip install vllm
else
  echo "[2/4] vLLM already installed: $(python3 -c 'import vllm; print(vllm.__version__)')"
fi

# 3. モデルパス確認
echo "[3/4] Checking model at: $MODEL_PATH"
if [ ! -f "$MODEL_PATH/config.json" ]; then
  echo "ERROR: Model not found at $MODEL_PATH"
  echo "Please set MODEL_PATH to your NatureLM-8x7B-Inst directory."
  exit 1
fi
echo "  Architecture: $(python3 -c "import json; print(json.load(open('$MODEL_PATH/config.json'))['architectures'][0])")"
echo "  Model type: $(python3 -c "import json; print(json.load(open('$MODEL_PATH/config.json'))['model_type'])")"

# 4. vLLM サーバー起動
echo "[4/4] Starting vLLM server..."
echo "  Model: $MODEL_PATH"
echo "  Host:  $HOST"
echo "  Port:  $PORT"
echo ""
echo "  API endpoint: http://${HOST}:${PORT}/v1"
echo "============================================"

exec python3 -m vllm.entrypoints.openai.api_server \
  --model "$MODEL_PATH" \
  --host "$HOST" \
  --port "$PORT" \
  --served-model-name "naturelm-8x7b-inst" \
  --trust-remote-code \
  --dtype auto \
  --max-model-len 4096

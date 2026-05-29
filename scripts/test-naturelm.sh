#!/usr/bin/env bash
# =============================================================================
# NatureLM MCP 動作テストスクリプト
# =============================================================================
# vLLM サーバーが稼働中の状態で実行し、NatureLM API の動作を確認する
# =============================================================================
set -euo pipefail

VLLM_URL="${VLLM_URL:-http://localhost:8080/v1}"

echo "============================================"
echo " NatureLM API Test"
echo "============================================"

# Test 1: モデル一覧
echo ""
echo "--- Test 1: List Models ---"
curl -s "$VLLM_URL/models" | python3 -m json.tool 2>/dev/null || echo "FAILED"

# Test 2: 分子生成 (SMILES)
echo ""
echo "--- Test 2: Generate SMILES (aspirin-like molecule) ---"
curl -s "$VLLM_URL/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "naturelm-8x7b-inst",
    "messages": [
      {"role": "user", "content": "Instruction: Generate a molecule with analgesic and anti-inflammatory properties similar to aspirin.\nResponse:"}
    ],
    "max_tokens": 256,
    "temperature": 0.7
  }' | python3 -m json.tool 2>/dev/null || echo "FAILED"

# Test 3: タンパク質配列生成
echo ""
echo "--- Test 3: Generate Protein Sequence ---"
curl -s "$VLLM_URL/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "naturelm-8x7b-inst",
    "messages": [
      {"role": "user", "content": "Instruction: Generate a stable and soluble protein sequence.\nResponse:"}
    ],
    "max_tokens": 512,
    "temperature": 0.7
  }' | python3 -m json.tool 2>/dev/null || echo "FAILED"

# Test 4: 材料組成予測
echo ""
echo "--- Test 4: Predict Material Composition ---"
curl -s "$VLLM_URL/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "naturelm-8x7b-inst",
    "messages": [
      {"role": "user", "content": "Instruction: Draft a material that includes Sr, Nd, Bi, O.\nResponse:"}
    ],
    "max_tokens": 256,
    "temperature": 0.7
  }' | python3 -m json.tool 2>/dev/null || echo "FAILED"

# Test 5: 分子特性予測
echo ""
echo "--- Test 5: Predict Molecular Property (logP) ---"
curl -s "$VLLM_URL/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "naturelm-8x7b-inst",
    "messages": [
      {"role": "user", "content": "Instruction: Predict the logP value of <mol>CC(=O)Oc1ccccc1C(=O)O</mol>\nResponse:"}
    ],
    "max_tokens": 128,
    "temperature": 0.1
  }' | python3 -m json.tool 2>/dev/null || echo "FAILED"

echo ""
echo "============================================"
echo " Tests completed."
echo "============================================"

#!/usr/bin/env bash
# =============================================================================
# GALACTICA MCP + NatureLM (vLLM) + NatureLM MCP 統合起動スクリプト
# =============================================================================
# DGX Spark (GB10, 128GB unified memory) 向け
#
# 起動順序:
#   1. GALACTICA MCP Server   (port 3002, HTTP transport)
#   2. NatureLM on vLLM       (port 8080, OpenAI-compatible API)
#   3. NatureLM MCP Server    (port 3001, HTTP transport)
#
# 使い方:
#   ./start-galactica-naturelm.sh          # 全サービス起動
#   ./start-galactica-naturelm.sh stop     # 全サービス停止
#   ./start-galactica-naturelm.sh status   # ステータス確認
#   ./start-galactica-naturelm.sh restart  # 全サービス再起動
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="/tmp/shikigami-logs"
mkdir -p "$LOG_DIR"

# --- 設定 ---
GALACTICA_DIR="${SCRIPT_DIR}/galactica-mcp"
GALACTICA_VENV="${GALACTICA_DIR}/.venv"
GALACTICA_PORT=3002
GALACTICA_LOG="${LOG_DIR}/galactica-mcp.log"
GALACTICA_PID="${LOG_DIR}/galactica-mcp.pid"

NATURELM_MCP_DIR="${SCRIPT_DIR}/naturelm-mcp"
NATURELM_MCP_PORT=3001
NATURELM_MCP_LOG="${LOG_DIR}/naturelm-mcp.log"
NATURELM_MCP_PID="${LOG_DIR}/naturelm-mcp.pid"

VLLM_VENV="${NATURELM_MCP_DIR}/.venv"
VLLM_PORT=8080
VLLM_LOG="${LOG_DIR}/vllm-naturelm.log"
VLLM_PID="${LOG_DIR}/vllm-naturelm.pid"
MODEL_PATH="${MODEL_PATH:-/home/nahisaho/models/NatureLM-8x7B-Inst}"

# --- DGX Spark メモリ最適化オプション ---
# GALACTICA (~13GB) + NatureLM 8x7B 4bit (~27GB) が共存するための設定
VLLM_GPU_UTIL="${VLLM_GPU_UTIL:-0.5}"
VLLM_MAX_MODEL_LEN="${VLLM_MAX_MODEL_LEN:-2048}"

# --- カラー出力 ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }
log_step()  { echo -e "${BLUE}[STEP]${NC}  $*"; }

# --- ユーティリティ ---
is_running() {
    local pidfile="$1"
    if [ -f "$pidfile" ]; then
        local pid
        pid=$(cat "$pidfile")
        if kill -0 "$pid" 2>/dev/null; then
            return 0
        fi
        rm -f "$pidfile"
    fi
    return 1
}

wait_for_port() {
    local port="$1"
    local name="$2"
    local timeout="${3:-300}"
    local elapsed=0
    while [ $elapsed -lt $timeout ]; do
        if curl -s --max-time 2 "http://localhost:${port}" >/dev/null 2>&1 || \
           curl -s --max-time 2 "http://localhost:${port}/v1/models" >/dev/null 2>&1; then
            return 0
        fi
        sleep 5
        elapsed=$((elapsed + 5))
        printf "\r  待機中... %ds / %ds" "$elapsed" "$timeout"
    done
    echo ""
    return 1
}

stop_service() {
    local name="$1"
    local pidfile="$2"
    if is_running "$pidfile"; then
        local pid
        pid=$(cat "$pidfile")
        log_info "${name} を停止中... (PID: ${pid})"
        # setsid で起動したプロセスグループ全体を停止
        kill -- -"$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
        local wait=0
        while kill -0 "$pid" 2>/dev/null && [ $wait -lt 30 ]; do
            sleep 1
            wait=$((wait + 1))
        done
        if kill -0 "$pid" 2>/dev/null; then
            log_warn "${name} が応答しないため強制終了します"
            kill -9 -- -"$pid" 2>/dev/null || kill -9 "$pid" 2>/dev/null || true
        fi
        rm -f "$pidfile"
        log_info "${name} を停止しました"
    else
        log_info "${name} は起動していません"
    fi
}

# =============================================================================
# status コマンド
# =============================================================================
do_status() {
    echo "============================================"
    echo " SHIKIGAMI サービスステータス"
    echo "============================================"

    # GALACTICA MCP
    if is_running "$GALACTICA_PID"; then
        local gpid; gpid=$(cat "$GALACTICA_PID")
        echo -e " GALACTICA MCP   : ${GREEN}● 稼働中${NC} (PID: ${gpid}, port: ${GALACTICA_PORT})"
    else
        echo -e " GALACTICA MCP   : ${RED}○ 停止${NC}"
    fi

    # vLLM NatureLM
    if is_running "$VLLM_PID"; then
        local vpid; vpid=$(cat "$VLLM_PID")
        echo -e " NatureLM vLLM   : ${GREEN}● 稼働中${NC} (PID: ${vpid}, port: ${VLLM_PORT})"
    else
        echo -e " NatureLM vLLM   : ${RED}○ 停止${NC}"
    fi

    # NatureLM MCP
    if is_running "$NATURELM_MCP_PID"; then
        local npid; npid=$(cat "$NATURELM_MCP_PID")
        echo -e " NatureLM MCP    : ${GREEN}● 稼働中${NC} (PID: ${npid}, port: ${NATURELM_MCP_PORT})"
    else
        echo -e " NatureLM MCP    : ${RED}○ 停止${NC}"
    fi

    echo "============================================"
    echo " ログ: ${LOG_DIR}/"
    echo "============================================"
}

# =============================================================================
# stop コマンド
# =============================================================================
do_stop() {
    echo "============================================"
    echo " 全サービス停止"
    echo "============================================"
    stop_service "NatureLM MCP"    "$NATURELM_MCP_PID"
    stop_service "NatureLM vLLM"   "$VLLM_PID"
    stop_service "GALACTICA MCP"   "$GALACTICA_PID"
    log_info "全サービスを停止しました"
}

# =============================================================================
# start コマンド
# =============================================================================
do_start() {
    echo "============================================"
    echo " GALACTICA + NatureLM 統合起動"
    echo " DGX Spark メモリ最適化モード"
    echo "============================================"

    # -------------------------------------------------------
    # 1. GALACTICA MCP Server
    # -------------------------------------------------------
    log_step "[1/3] GALACTICA MCP Server (port ${GALACTICA_PORT})"

    if is_running "$GALACTICA_PID"; then
        log_info "既に稼働中です (PID: $(cat "$GALACTICA_PID"))"
    else
        if [ ! -f "${GALACTICA_VENV}/bin/python" ]; then
            log_error "GALACTICA venv が見つかりません: ${GALACTICA_VENV}"
            exit 1
        fi

        setsid "${GALACTICA_VENV}/bin/python" "${GALACTICA_DIR}/server.py" \
            --model standard \
            --transport http \
            --host 0.0.0.0 \
            --port "$GALACTICA_PORT" \
            --preload \
            > "$GALACTICA_LOG" 2>&1 &
        echo $! > "$GALACTICA_PID"
        disown
        log_info "起動しました (PID: $(cat "$GALACTICA_PID"))"

        log_info "GALACTICA モデルロード待機中..."
        if wait_for_port "$GALACTICA_PORT" "GALACTICA MCP" 180; then
            echo ""
            log_info "GALACTICA MCP: 準備完了 ✅"
        else
            log_error "GALACTICA MCP: タイムアウト (ログ: ${GALACTICA_LOG})"
            exit 1
        fi
    fi

    # -------------------------------------------------------
    # 2. NatureLM on vLLM (4bit 量子化 + メモリ制限)
    # -------------------------------------------------------
    log_step "[2/3] NatureLM on vLLM (port ${VLLM_PORT})"

    if is_running "$VLLM_PID"; then
        log_info "既に稼働中です (PID: $(cat "$VLLM_PID"))"
    else
        if [ ! -f "${MODEL_PATH}/config.json" ]; then
            log_error "モデルが見つかりません: ${MODEL_PATH}"
            exit 1
        fi

        if [ ! -f "${VLLM_VENV}/bin/python" ]; then
            log_error "vLLM venv が見つかりません: ${VLLM_VENV}"
            exit 1
        fi

        # bitsandbytes 確認
        if ! "${VLLM_VENV}/bin/python" -c "import bitsandbytes" 2>/dev/null; then
            log_warn "bitsandbytes がありません。インストール中..."
            "${VLLM_VENV}/bin/pip" install --quiet bitsandbytes
        fi

        log_info "メモリ最適化: gpu_util=${VLLM_GPU_UTIL}, max_model_len=${VLLM_MAX_MODEL_LEN}, 4bit量子化"

        setsid "${VLLM_VENV}/bin/python" -m vllm.entrypoints.openai.api_server \
            --model "$MODEL_PATH" \
            --host 0.0.0.0 \
            --port "$VLLM_PORT" \
            --served-model-name "naturelm-8x7b-inst" \
            --trust-remote-code \
            --dtype auto \
            --quantization bitsandbytes \
            --load-format bitsandbytes \
            --gpu-memory-utilization "$VLLM_GPU_UTIL" \
            --max-model-len "$VLLM_MAX_MODEL_LEN" \
            --enforce-eager \
            > "$VLLM_LOG" 2>&1 &
        echo $! > "$VLLM_PID"
        disown
        log_info "起動しました (PID: $(cat "$VLLM_PID"))"

        log_info "NatureLM モデルロード待機中 (最大5分)..."
        if wait_for_port "$VLLM_PORT" "NatureLM vLLM" 300; then
            echo ""
            log_info "NatureLM vLLM: 準備完了 ✅"
        else
            # プロセスが生きているかチェック
            if is_running "$VLLM_PID"; then
                log_warn "vLLM はまだロード中の可能性があります (ログ: ${VLLM_LOG})"
            else
                log_error "NatureLM vLLM: 起動失敗 (ログ: ${VLLM_LOG})"
                tail -20 "$VLLM_LOG"
                exit 1
            fi
        fi
    fi

    # -------------------------------------------------------
    # 3. NatureLM MCP Server
    # -------------------------------------------------------
    log_step "[3/3] NatureLM MCP Server (port ${NATURELM_MCP_PORT})"

    if is_running "$NATURELM_MCP_PID"; then
        log_info "既に稼働中です (PID: $(cat "$NATURELM_MCP_PID"))"
    else
        # vLLM が応答可能か最終確認
        if ! curl -s --max-time 5 "http://localhost:${VLLM_PORT}/v1/models" >/dev/null 2>&1; then
            log_error "vLLM (port ${VLLM_PORT}) が応答しません。NatureLM MCP を起動できません。"
            exit 1
        fi

        cd "$NATURELM_MCP_DIR"
        setsid node dist/src/index.js \
            --transport http \
            --host 0.0.0.0 \
            --port "$NATURELM_MCP_PORT" \
            --base-url "http://localhost:${VLLM_PORT}/v1" \
            > "$NATURELM_MCP_LOG" 2>&1 &
        echo $! > "$NATURELM_MCP_PID"
        disown
        cd - >/dev/null
        log_info "起動しました (PID: $(cat "$NATURELM_MCP_PID"))"

        if wait_for_port "$NATURELM_MCP_PORT" "NatureLM MCP" 30; then
            echo ""
            log_info "NatureLM MCP: 準備完了 ✅"
        else
            log_warn "NatureLM MCP: ポート応答待ち (ログ: ${NATURELM_MCP_LOG})"
        fi
    fi

    # -------------------------------------------------------
    # サマリー
    # -------------------------------------------------------
    echo ""
    echo "============================================"
    echo " 起動完了 ✅"
    echo "============================================"
    echo " GALACTICA MCP   : http://localhost:${GALACTICA_PORT}/mcp"
    echo " NatureLM vLLM   : http://localhost:${VLLM_PORT}/v1"
    echo " NatureLM MCP    : http://localhost:${NATURELM_MCP_PORT}/mcp"
    echo ""
    echo " ログ: ${LOG_DIR}/"
    echo "============================================"
}

# =============================================================================
# メイン
# =============================================================================
case "${1:-start}" in
    start)   do_start  ;;
    stop)    do_stop   ;;
    restart) do_stop; sleep 3; do_start ;;
    status)  do_status ;;
    *)
        echo "Usage: $0 {start|stop|restart|status}"
        exit 1
        ;;
esac

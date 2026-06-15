#!/usr/bin/env bash
set -uo pipefail

timestamp() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

usage() {
  cat <<'EOF'
用法：
  bash infra/deployment/live-acceptance-commands.sh [--mode auto|docker|external] [--output-dir <dir>] [--keep-services]

说明：
  - 默认 --mode auto：优先使用显式提供的 external Neo4j/Redis；否则尝试 Docker/Compose。
  - 只要依赖不可达，就输出结构化失败结果；严禁回退到 mock。
  - 成功时会完成 preflight、bring-up、import、health、detail、overview、search、suggest、subgraph、path、stats、relations/:id/evidence 验收。

环境变量：
  REPO_ROOT                  默认 /workspace/project/mag7-supply-chain
  BACKEND_DIR                默认 $REPO_ROOT/backend
  PACKAGE_DIR                默认 /workspace/agents/evidence-collector/output/mag7-full-package
  EXPECTED_PACKAGE_SNAPSHOT  默认 snapshot:2026-06-15.full.18
  EXPECTED_RELATION_COUNT    默认 312
  EXPECTED_EVIDENCE_COUNT    默认 410
  API_BASE                   默认 http://127.0.0.1:4000
  HOST                       默认 127.0.0.1
  PORT                       默认 4000
  GRAPH_RUNTIME_MODE         默认 live，且必须保持 live
  NEO4J_URI                  external 模式必填；docker 模式默认 bolt://127.0.0.1:7687
  NEO4J_USERNAME             external 模式必填；docker 模式默认 neo4j
  NEO4J_PASSWORD             external 模式必填；docker 模式默认 mag7-dev-password
  NEO4J_DATABASE             external 模式必填；docker 模式默认 neo4j
  REDIS_URL                  external 模式必填；docker 模式默认 redis://127.0.0.1:6379
EOF
}

MODE="auto"
OUTPUT_DIR=""
KEEP_SERVICES="false"

while (($# > 0)); do
  case "$1" in
    --mode)
      MODE="${2:-}"
      shift 2
      ;;
    --output-dir)
      OUTPUT_DIR="${2:-}"
      shift 2
      ;;
    --keep-services)
      KEEP_SERVICES="true"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "未知参数: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ "$MODE" != "auto" && "$MODE" != "docker" && "$MODE" != "external" ]]; then
  echo "--mode 只支持 auto、docker、external" >&2
  exit 1
fi

REPO_ROOT="${REPO_ROOT:-/workspace/project/mag7-supply-chain}"
BACKEND_DIR="${BACKEND_DIR:-$REPO_ROOT/backend}"
PACKAGE_DIR="${PACKAGE_DIR:-/workspace/agents/evidence-collector/output/mag7-full-package}"
PACKAGE_MANIFEST="${PACKAGE_DIR}/mag7-full-package-manifest.json"
EXPECTED_PACKAGE_SNAPSHOT="${EXPECTED_PACKAGE_SNAPSHOT:-snapshot:2026-06-15.full.18}"
EXPECTED_RELATION_COUNT="${EXPECTED_RELATION_COUNT:-312}"
EXPECTED_EVIDENCE_COUNT="${EXPECTED_EVIDENCE_COUNT:-410}"
API_BASE="${API_BASE:-http://127.0.0.1:4000}"

export HOST="${HOST:-127.0.0.1}"
export PORT="${PORT:-4000}"
export GRAPH_RUNTIME_MODE="${GRAPH_RUNTIME_MODE:-live}"
export NEO4J_URI="${NEO4J_URI:-}"
export NEO4J_USERNAME="${NEO4J_USERNAME:-}"
export NEO4J_PASSWORD="${NEO4J_PASSWORD:-}"
export NEO4J_DATABASE="${NEO4J_DATABASE:-}"
export REDIS_URL="${REDIS_URL:-}"

OUTPUT_DIR="${OUTPUT_DIR:-$(mktemp -d /tmp/mag7-live-acceptance-full18-XXXXXX)}"
mkdir -p "$OUTPUT_DIR" "$OUTPUT_DIR/http" "$OUTPUT_DIR/logs" "$OUTPUT_DIR/docker"

PREFLIGHT_JSON="$OUTPUT_DIR/preflight.json"
MODE_JSON="$OUTPUT_DIR/mode-selection.json"
BRINGUP_JSON="$OUTPUT_DIR/bringup.json"
IMPORT_JSON="$OUTPUT_DIR/import-summary.json"
IMPORT_FAILURE_JSON="$OUTPUT_DIR/import-failure.json"
HTTP_SUMMARY_JSON="$OUTPUT_DIR/http-smoke-summary.json"
RESULT_JSON="$OUTPUT_DIR/result.json"
PREREQ_JSON="$OUTPUT_DIR/minimal-external-prerequisites.json"
SERVER_LOG="$OUTPUT_DIR/logs/backend-live.log"
COMMANDS_LOG="$OUTPUT_DIR/logs/commands.log"

BUILD_FRONTEND_OUT="$OUTPUT_DIR/logs/build-frontend.stdout.log"
BUILD_FRONTEND_ERR="$OUTPUT_DIR/logs/build-frontend.stderr.log"
BUILD_BACKEND_OUT="$OUTPUT_DIR/logs/build-backend.stdout.log"
BUILD_BACKEND_ERR="$OUTPUT_DIR/logs/build-backend.stderr.log"
INSTALL_ROOT_OUT="$OUTPUT_DIR/logs/install-root.stdout.log"
INSTALL_ROOT_ERR="$OUTPUT_DIR/logs/install-root.stderr.log"
INSTALL_BACKEND_OUT="$OUTPUT_DIR/logs/install-backend.stdout.log"
INSTALL_BACKEND_ERR="$OUTPUT_DIR/logs/install-backend.stderr.log"
IMPORT_STDOUT="$OUTPUT_DIR/logs/import.stdout.log"
IMPORT_STDERR="$OUTPUT_DIR/logs/import.stderr.log"

SERVER_PID=""
STARTED_DOCKER_SERVICES="false"
SELECTED_MODE="unknown"
COMPOSE_BIN=""

printf '{}\n' >"$MODE_JSON"
printf '{}\n' >"$BRINGUP_JSON"
printf '{}\n' >"$IMPORT_FAILURE_JSON"

write_minimal_prerequisites() {
  jq -n \
    --arg snapshot "$EXPECTED_PACKAGE_SNAPSHOT" \
    '{
      snapshot: $snapshot,
      current_status: "blocked",
      required_to_unblock_real_data_launch: [
        "Node.js v22.22.3 + npm + curl + jq",
        "可达的 Neo4j 5.26 兼容实例",
        "可达的 Redis 7.4 兼容实例",
        "若需要对外 smoke 或同源 `/api` 联调，准备一个可临时托管 Node API 的运行器和待接入的 Cloudflare Zone",
        "live 模式环境变量：NEO4J_URI、NEO4J_USERNAME、NEO4J_PASSWORD、NEO4J_DATABASE、REDIS_URL",
        "重新执行本脚本并拿到 source=neo4j 的导入结果、health=ok、detail/overview/search/suggest/subgraph/path/stats/relations/:id/evidence 全部成功返回"
      ],
      external_env_template: {
        GRAPH_RUNTIME_MODE: "live",
        NEO4J_URI: "bolt://<reachable-neo4j-host>:7687",
        NEO4J_USERNAME: "<username>",
        NEO4J_PASSWORD: "<password>",
        NEO4J_DATABASE: "neo4j",
        REDIS_URL: "redis://<reachable-redis-host>:6379"
      }
    }' >"$PREREQ_JSON"
}

write_minimal_prerequisites

cleanup() {
  if [[ -n "$SERVER_PID" ]]; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
    wait "$SERVER_PID" >/dev/null 2>&1 || true
  fi

  if [[ "$STARTED_DOCKER_SERVICES" = "true" ]]; then
    if [[ -n "$COMPOSE_BIN" ]]; then
      compose -f "$REPO_ROOT/docker-compose.dev.yml" logs --no-color >"$OUTPUT_DIR/docker/compose.log" 2>&1 || true
      compose -f "$REPO_ROOT/docker-compose.dev.yml" logs --no-color neo4j >"$OUTPUT_DIR/docker/neo4j.log" 2>&1 || true
      compose -f "$REPO_ROOT/docker-compose.dev.yml" logs --no-color redis >"$OUTPUT_DIR/docker/redis.log" 2>&1 || true
      compose -f "$REPO_ROOT/docker-compose.dev.yml" ps >"$OUTPUT_DIR/docker/docker-compose-ps.txt" 2>&1 || true
      if [[ "$KEEP_SERVICES" != "true" ]]; then
        compose -f "$REPO_ROOT/docker-compose.dev.yml" down >/dev/null 2>&1 || true
      fi
    fi
  fi
}

trap cleanup EXIT

log_cmd() {
  printf '[%s] %s\n' "$(timestamp)" "$*" >>"$COMMANDS_LOG"
}

write_failure_result() {
  local stage="$1"
  local code="$2"
  local message="$3"
  local detail="$4"

  jq -n \
    --arg stage "$stage" \
    --arg code "$code" \
    --arg message "$message" \
    --arg detail "$detail" \
    --arg mode "$SELECTED_MODE" \
    --arg outputDir "$OUTPUT_DIR" \
    --slurpfile preflight "$PREFLIGHT_JSON" \
    --slurpfile selection "$MODE_JSON" \
    --slurpfile bringup "$BRINGUP_JSON" \
    --slurpfile prereq "$PREREQ_JSON" \
    '{
      schema: "wanman.live-acceptance-result",
      version: 1,
      passed: false,
      blocked: true,
      stage: $stage,
      mode: $mode,
      failure: {
        code: $code,
        message: $message,
        detail: $detail
      },
      outputDir: $outputDir,
      files: {
        preflight: "preflight.json",
        modeSelection: "mode-selection.json",
        bringup: "bringup.json",
        importSummary: "import-summary.json",
        importFailure: "import-failure.json",
        httpSmokeSummary: "http-smoke-summary.json",
        minimalExternalPrerequisites: "minimal-external-prerequisites.json"
      },
      preflight: ($preflight[0] // {}),
      modeSelection: ($selection[0] // {}),
      bringup: ($bringup[0] // {}),
      minimalExternalPrerequisites: ($prereq[0] // {})
    }' >"$RESULT_JSON"

  echo "失败阶段: $stage"
  echo "失败原因: $message"
  echo "结构化结果: $RESULT_JSON"
}

fail_stage() {
  write_failure_result "$1" "$2" "$3" "$4"
  exit 1
}

run_logged() {
  local stdout_path="$1"
  local stderr_path="$2"
  shift 2

  log_cmd "$*"
  "$@" >"$stdout_path" 2>"$stderr_path"
}

compose() {
  if [[ "$COMPOSE_BIN" = "docker compose" ]]; then
    docker compose "$@"
  else
    docker-compose "$@"
  fi
}

wait_for_http() {
  local url="$1"
  local attempts="${2:-45}"
  local sleep_seconds="${3:-2}"

  for _ in $(seq 1 "$attempts"); do
    if [[ -n "$SERVER_PID" ]] && ! kill -0 "$SERVER_PID" >/dev/null 2>&1; then
      return 2
    fi
    if curl -sS -o /dev/null "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep "$sleep_seconds"
  done

  return 1
}

capture_json() {
  local name="$1"
  local url="$2"
  local body_path="$OUTPUT_DIR/http/${name}.json"
  local headers_path="$OUTPUT_DIR/http/${name}.headers"
  local status_path="$OUTPUT_DIR/http/${name}.status"
  local status

  log_cmd "curl -sS -D $headers_path -o $body_path -w %{http_code} $url"
  status="$(curl -sS -D "$headers_path" -o "$body_path" -w '%{http_code}' "$url")" || return 1
  printf '%s' "$status" >"$status_path"

  grep -qi '^content-type: application/json' "$headers_path" || return 2
  jq . "$body_path" >/dev/null || return 3
  return 0
}

parse_url_host_port() {
  node -e '
    const [raw, defaultPort] = process.argv.slice(1);
    const url = new URL(raw);
    const host = url.hostname;
    const port = url.port || defaultPort;
    process.stdout.write(`${host} ${port}`);
  ' "$1" "$2"
}

probe_tcp() {
  local host="$1"
  local port="$2"

  if timeout 3 bash -lc "exec 3<>/dev/tcp/$host/$port" >/dev/null 2>&1; then
    echo "up"
  else
    echo "down"
  fi
}

detect_container_health() {
  local container_name="$1"
  docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_name" 2>/dev/null
}

wait_for_container_health() {
  local container_name="$1"
  local expected="${2:-healthy}"
  local attempts="${3:-40}"
  local sleep_seconds="${4:-3}"
  local state=""

  for _ in $(seq 1 "$attempts"); do
    state="$(detect_container_health "$container_name")"
    if [[ "$state" = "$expected" ]]; then
      echo "$state"
      return 0
    fi
    sleep "$sleep_seconds"
  done

  echo "${state:-unknown}"
  return 1
}

HTTP_CHECK_NAMES=()

register_http_check() {
  HTTP_CHECK_NAMES+=("$1")
}

write_http_summary() {
  local passed="$1"
  jq -n \
    --argjson passed "$passed" \
    --arg apiBase "$API_BASE" \
    --arg mode "$SELECTED_MODE" \
    --arg snapshot "$EXPECTED_PACKAGE_SNAPSHOT" \
    --argjson checks "$(printf '%s\n' "${HTTP_CHECK_NAMES[@]}" | jq -R . | jq -s .)" \
    '{
      passed: $passed,
      mode: $mode,
      apiBase: $apiBase,
      packageSnapshotId: $snapshot,
      checks: $checks
    }' >"$HTTP_SUMMARY_JSON"
}

write_success_result() {
  jq -n \
    --arg mode "$SELECTED_MODE" \
    --arg outputDir "$OUTPUT_DIR" \
    --slurpfile preflight "$PREFLIGHT_JSON" \
    --slurpfile selection "$MODE_JSON" \
    --slurpfile bringup "$BRINGUP_JSON" \
    --slurpfile imported "$IMPORT_JSON" \
    --slurpfile httpSummary "$HTTP_SUMMARY_JSON" \
    --slurpfile prereq "$PREREQ_JSON" \
    '{
      schema: "wanman.live-acceptance-result",
      version: 1,
      passed: true,
      blocked: false,
      stage: "complete",
      mode: $mode,
      outputDir: $outputDir,
      preflight: $preflight[0],
      modeSelection: $selection[0],
      bringup: $bringup[0],
      import: $imported[0],
      httpSmoke: $httpSummary[0],
      minimalExternalPrerequisites: $prereq[0]
    }' >"$RESULT_JSON"
}

COMMAND_NODE="missing"
COMMAND_NPM="missing"
COMMAND_CURL="missing"
COMMAND_JQ="missing"
DOCKER_AVAILABLE="false"
COMPOSE_AVAILABLE="false"
COMPOSE_COMMAND="unavailable"
EXTERNAL_ENV_DETECTED="false"
EXTERNAL_ENV_COMPLETE="false"

if command -v node >/dev/null 2>&1; then COMMAND_NODE="$(node -v)"; fi
if command -v npm >/dev/null 2>&1; then COMMAND_NPM="$(npm -v)"; fi
if command -v curl >/dev/null 2>&1; then COMMAND_CURL="$(curl --version | head -n 1)"; fi
if command -v jq >/dev/null 2>&1; then COMMAND_JQ="$(jq --version)"; fi

if command -v docker >/dev/null 2>&1; then
  DOCKER_AVAILABLE="true"
  if docker compose version >/dev/null 2>&1; then
    COMPOSE_AVAILABLE="true"
    COMPOSE_COMMAND="docker compose"
    COMPOSE_BIN="docker compose"
  elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_AVAILABLE="true"
    COMPOSE_COMMAND="docker-compose"
    COMPOSE_BIN="docker-compose"
  fi
fi

if [[ -n "$NEO4J_URI" || -n "$REDIS_URL" ]]; then
  EXTERNAL_ENV_DETECTED="true"
fi

if [[ -n "$NEO4J_URI" && -n "$NEO4J_USERNAME" && -n "$NEO4J_PASSWORD" && -n "$NEO4J_DATABASE" && -n "$REDIS_URL" ]]; then
  EXTERNAL_ENV_COMPLETE="true"
fi

if ! command -v jq >/dev/null 2>&1; then
  printf '{"passed":false,"stage":"preflight","failure":{"code":"jq_missing","message":"缺少 jq，无法生成结构化结果"}}\n' >"$RESULT_JSON"
  echo "缺少 jq，无法继续。结果文件: $RESULT_JSON" >&2
  exit 1
fi

PACKAGE_SNAPSHOT_ID=""
PACKAGE_VERSION="unknown"
RELATION_COUNT=0
EVIDENCE_COUNT=0

if [[ -f "$PACKAGE_MANIFEST" ]]; then
  PACKAGE_SNAPSHOT_ID="$(jq -r '.package_snapshot_id // ""' "$PACKAGE_MANIFEST")"
  PACKAGE_VERSION="$(jq -r '.package_version // "unknown"' "$PACKAGE_MANIFEST")"
fi

if [[ -f "$PACKAGE_DIR/relations.jsonl" ]]; then
  RELATION_COUNT="$(wc -l <"$PACKAGE_DIR/relations.jsonl" | tr -d ' ')"
fi

if [[ -f "$PACKAGE_DIR/evidence.jsonl" ]]; then
  EVIDENCE_COUNT="$(wc -l <"$PACKAGE_DIR/evidence.jsonl" | tr -d ' ')"
fi

jq -n \
  --arg mode "$MODE" \
  --arg repoRoot "$REPO_ROOT" \
  --arg backendDir "$BACKEND_DIR" \
  --arg packageDir "$PACKAGE_DIR" \
  --arg packageManifest "$PACKAGE_MANIFEST" \
  --arg expectedSnapshot "$EXPECTED_PACKAGE_SNAPSHOT" \
  --arg expectedRelationCount "$EXPECTED_RELATION_COUNT" \
  --arg expectedEvidenceCount "$EXPECTED_EVIDENCE_COUNT" \
  --arg packageSnapshot "$PACKAGE_SNAPSHOT_ID" \
  --arg packageVersion "$PACKAGE_VERSION" \
  --arg relationCount "$RELATION_COUNT" \
  --arg evidenceCount "$EVIDENCE_COUNT" \
  --arg graphRuntimeMode "$GRAPH_RUNTIME_MODE" \
  --arg nodeVersion "$COMMAND_NODE" \
  --arg npmVersion "$COMMAND_NPM" \
  --arg curlVersion "$COMMAND_CURL" \
  --arg jqVersion "$COMMAND_JQ" \
  --argjson dockerAvailable "$DOCKER_AVAILABLE" \
  --argjson composeAvailable "$COMPOSE_AVAILABLE" \
  --arg composeCommand "$COMPOSE_COMMAND" \
  --argjson externalEnvDetected "$EXTERNAL_ENV_DETECTED" \
  --argjson externalEnvComplete "$EXTERNAL_ENV_COMPLETE" \
  '{
    modeRequested: $mode,
    repoRoot: $repoRoot,
    backendDir: $backendDir,
    packageDir: $packageDir,
    packageManifest: $packageManifest,
    expectedPackageSnapshot: $expectedSnapshot,
    expectedCounts: {
      relations: ($expectedRelationCount | tonumber),
      evidence: ($expectedEvidenceCount | tonumber)
    },
    packageSnapshotId: $packageSnapshot,
    packageVersion: $packageVersion,
    packageCounts: {
      relations: ($relationCount | tonumber),
      evidence: ($evidenceCount | tonumber)
    },
    graphRuntimeMode: $graphRuntimeMode,
    commands: {
      node: $nodeVersion,
      npm: $npmVersion,
      curl: $curlVersion,
      jq: $jqVersion
    },
    runtimeCandidates: {
      dockerAvailable: $dockerAvailable,
      composeAvailable: $composeAvailable,
      composeCommand: $composeCommand,
      externalEnvDetected: $externalEnvDetected,
      externalEnvComplete: $externalEnvComplete
    }
  }' >"$PREFLIGHT_JSON"

[[ "$GRAPH_RUNTIME_MODE" = "live" ]] || fail_stage "preflight" "runtime_mode_invalid" "GRAPH_RUNTIME_MODE 必须保持 live" "当前值不是 live。"
command -v node >/dev/null 2>&1 || fail_stage "preflight" "node_missing" "缺少 Node.js" "当前运行器未安装 node。"
command -v npm >/dev/null 2>&1 || fail_stage "preflight" "npm_missing" "缺少 npm" "当前运行器未安装 npm。"
command -v curl >/dev/null 2>&1 || fail_stage "preflight" "curl_missing" "缺少 curl" "当前运行器未安装 curl。"
test -f "$PACKAGE_MANIFEST" || fail_stage "preflight" "package_manifest_missing" "找不到 full.18 数据包 manifest" "$PACKAGE_MANIFEST 不存在。"
test -f "$PACKAGE_DIR/relations.jsonl" || fail_stage "preflight" "relations_missing" "找不到 relations.jsonl" "$PACKAGE_DIR/relations.jsonl 不存在。"
test -f "$PACKAGE_DIR/evidence.jsonl" || fail_stage "preflight" "evidence_missing" "找不到 evidence.jsonl" "$PACKAGE_DIR/evidence.jsonl 不存在。"
[[ "$PACKAGE_SNAPSHOT_ID" = "$EXPECTED_PACKAGE_SNAPSHOT" ]] || fail_stage "preflight" "snapshot_mismatch" "数据包 snapshot 与 full.18 不一致" "检测到 $PACKAGE_SNAPSHOT_ID，预期 $EXPECTED_PACKAGE_SNAPSHOT。"
[[ "$RELATION_COUNT" = "$EXPECTED_RELATION_COUNT" ]] || fail_stage "preflight" "relation_count_mismatch" "published relations 行数与 full.18 不一致" "检测到 $RELATION_COUNT，预期 $EXPECTED_RELATION_COUNT。"
[[ "$EVIDENCE_COUNT" = "$EXPECTED_EVIDENCE_COUNT" ]] || fail_stage "preflight" "evidence_count_mismatch" "published evidence 行数与 full.18 不一致" "检测到 $EVIDENCE_COUNT，预期 $EXPECTED_EVIDENCE_COUNT。"

case "$MODE" in
  auto)
    if [[ "$EXTERNAL_ENV_COMPLETE" = "true" ]]; then
      SELECTED_MODE="external"
    elif [[ "$COMPOSE_AVAILABLE" = "true" ]]; then
      SELECTED_MODE="docker"
      [[ -n "$NEO4J_URI" ]] || export NEO4J_URI="bolt://127.0.0.1:7687"
      [[ -n "$NEO4J_USERNAME" ]] || export NEO4J_USERNAME="neo4j"
      [[ -n "$NEO4J_PASSWORD" ]] || export NEO4J_PASSWORD="mag7-dev-password"
      [[ -n "$NEO4J_DATABASE" ]] || export NEO4J_DATABASE="neo4j"
      [[ -n "$REDIS_URL" ]] || export REDIS_URL="redis://127.0.0.1:6379"
    else
      SELECTED_MODE="unavailable"
      jq -n \
        --arg modeRequested "$MODE" \
        --arg selectedMode "$SELECTED_MODE" \
        --arg reason "既没有完整 external NEO4J_URI/REDIS_URL，也没有可用 Docker/Compose。" \
        '{
          modeRequested: $modeRequested,
          selectedMode: $selectedMode,
          detectionReason: $reason
        }' >"$MODE_JSON"
      fail_stage "preflight" "runtime_unavailable" "未检测到可用的 live 运行时" "请提供完整 external Neo4j/Redis 环境变量，或在当前机器安装 Docker/Compose。"
    fi
    ;;
  docker)
    [[ "$COMPOSE_AVAILABLE" = "true" ]] || fail_stage "preflight" "docker_compose_unavailable" "请求 docker 模式，但 Docker/Compose 不可用" "请安装 docker compose 或改用 external。"
    SELECTED_MODE="docker"
    [[ -n "$NEO4J_URI" ]] || export NEO4J_URI="bolt://127.0.0.1:7687"
    [[ -n "$NEO4J_USERNAME" ]] || export NEO4J_USERNAME="neo4j"
    [[ -n "$NEO4J_PASSWORD" ]] || export NEO4J_PASSWORD="mag7-dev-password"
    [[ -n "$NEO4J_DATABASE" ]] || export NEO4J_DATABASE="neo4j"
    [[ -n "$REDIS_URL" ]] || export REDIS_URL="redis://127.0.0.1:6379"
    ;;
  external)
    [[ "$EXTERNAL_ENV_COMPLETE" = "true" ]] || fail_stage "preflight" "external_env_incomplete" "请求 external 模式，但 live 依赖环境变量不完整" "至少需要 NEO4J_URI、NEO4J_USERNAME、NEO4J_PASSWORD、NEO4J_DATABASE、REDIS_URL。"
    SELECTED_MODE="external"
    ;;
esac

jq -n \
  --arg modeRequested "$MODE" \
  --arg selectedMode "$SELECTED_MODE" \
  --arg neo4jUri "${NEO4J_URI:-}" \
  --arg redisUrl "${REDIS_URL:-}" \
  '{
    modeRequested: $modeRequested,
    selectedMode: $selectedMode,
    usesExternalUris: {
      neo4j: ($neo4jUri != ""),
      redis: ($redisUrl != "")
    }
  }' >"$MODE_JSON"

if [[ ! -d "$REPO_ROOT/node_modules" ]]; then
  if ! run_logged "$INSTALL_ROOT_OUT" "$INSTALL_ROOT_ERR" npm --prefix "$REPO_ROOT" install; then
    fail_stage "build" "root_install_failed" "前端依赖安装失败" "请查看 logs/install-root.stderr.log。"
  fi
fi

if [[ ! -d "$BACKEND_DIR/node_modules" ]]; then
  if ! run_logged "$INSTALL_BACKEND_OUT" "$INSTALL_BACKEND_ERR" npm --prefix "$BACKEND_DIR" install; then
    fail_stage "build" "backend_install_failed" "后端依赖安装失败" "请查看 logs/install-backend.stderr.log。"
  fi
fi

if ! run_logged "$BUILD_FRONTEND_OUT" "$BUILD_FRONTEND_ERR" npm --prefix "$REPO_ROOT" run build; then
  fail_stage "build" "frontend_build_failed" "前端构建失败" "请查看 logs/build-frontend.stderr.log。"
fi

if ! run_logged "$BUILD_BACKEND_OUT" "$BUILD_BACKEND_ERR" npm --prefix "$BACKEND_DIR" run build; then
  fail_stage "build" "backend_build_failed" "后端构建失败" "请查看 logs/build-backend.stderr.log。"
fi

if [[ "$SELECTED_MODE" = "docker" ]]; then
  log_cmd "$COMPOSE_COMMAND -f $REPO_ROOT/docker-compose.dev.yml up -d neo4j redis neo4j-init"
  if ! compose -f "$REPO_ROOT/docker-compose.dev.yml" up -d neo4j redis neo4j-init >"$OUTPUT_DIR/docker/up.stdout.log" 2>"$OUTPUT_DIR/docker/up.stderr.log"; then
    fail_stage "bringup" "docker_compose_up_failed" "Docker 依赖拉起失败" "请查看 docker/up.stderr.log。"
  fi

  STARTED_DOCKER_SERVICES="true"

  NEO4J_STATE="$(wait_for_container_health mag7-neo4j healthy 40 3)" || fail_stage "bringup" "neo4j_not_healthy" "Neo4j 容器未进入 healthy" "当前状态：$NEO4J_STATE"
  REDIS_STATE="$(wait_for_container_health mag7-redis healthy 40 2)" || fail_stage "bringup" "redis_not_healthy" "Redis 容器未进入 healthy" "当前状态：$REDIS_STATE"
  NEO4J_INIT_STATE="$(wait_for_container_health mag7-neo4j-init exited 30 2)" || true

  jq -n \
    --arg mode "$SELECTED_MODE" \
    --arg neo4jState "$NEO4J_STATE" \
    --arg redisState "$REDIS_STATE" \
    --arg neo4jInitState "${NEO4J_INIT_STATE:-unknown}" \
    '{
      mode: $mode,
      ready: true,
      docker: {
        neo4j: { container: "mag7-neo4j", state: $neo4jState },
        redis: { container: "mag7-redis", state: $redisState },
        neo4jInit: { container: "mag7-neo4j-init", state: $neo4jInitState }
      }
    }' >"$BRINGUP_JSON"
else
  read -r NEO4J_HOST NEO4J_PORT <<<"$(parse_url_host_port "$NEO4J_URI" 7687)"
  read -r REDIS_HOST REDIS_PORT <<<"$(parse_url_host_port "$REDIS_URL" 6379)"

  NEO4J_PROBE="$(probe_tcp "$NEO4J_HOST" "$NEO4J_PORT")"
  REDIS_PROBE="$(probe_tcp "$REDIS_HOST" "$REDIS_PORT")"

  jq -n \
    --arg mode "$SELECTED_MODE" \
    --arg neo4jUri "$NEO4J_URI" \
    --arg redisUrl "$REDIS_URL" \
    --arg neo4jHost "$NEO4J_HOST" \
    --arg neo4jPort "$NEO4J_PORT" \
    --arg redisHost "$REDIS_HOST" \
    --arg redisPort "$REDIS_PORT" \
    --arg neo4jProbe "$NEO4J_PROBE" \
    --arg redisProbe "$REDIS_PROBE" \
    '{
      mode: $mode,
      ready: ($neo4jProbe == "up" and $redisProbe == "up"),
      external: {
        neo4j: { uri: $neo4jUri, host: $neo4jHost, port: $neo4jPort, tcpProbe: $neo4jProbe },
        redis: { uri: $redisUrl, host: $redisHost, port: $redisPort, tcpProbe: $redisProbe }
      }
    }' >"$BRINGUP_JSON"

  [[ "$NEO4J_PROBE" = "up" ]] || fail_stage "bringup" "neo4j_unreachable" "external Neo4j 不可达" "TCP probe 到 ${NEO4J_HOST}:${NEO4J_PORT} 失败。"
  [[ "$REDIS_PROBE" = "up" ]] || fail_stage "bringup" "redis_unreachable" "external Redis 不可达" "TCP probe 到 ${REDIS_HOST}:${REDIS_PORT} 失败。"
fi

log_cmd "npm --prefix $BACKEND_DIR run import:normalized -- --relations $PACKAGE_DIR/relations.jsonl --evidence $PACKAGE_DIR/evidence.jsonl"
if ! npm --prefix "$BACKEND_DIR" run import:normalized -- --relations "$PACKAGE_DIR/relations.jsonl" --evidence "$PACKAGE_DIR/evidence.jsonl" >"$IMPORT_STDOUT" 2>"$IMPORT_STDERR"; then
  jq -n \
    --arg mode "$SELECTED_MODE" \
    --arg stderrFile "logs/import.stderr.log" \
    --arg stdoutFile "logs/import.stdout.log" \
    --arg detail "$(tail -n 40 "$IMPORT_STDERR" 2>/dev/null || true)" \
    '{
      mode: $mode,
      success: false,
      stdoutFile: $stdoutFile,
      stderrFile: $stderrFile,
      detail: $detail
    }' >"$IMPORT_FAILURE_JSON"
  fail_stage "import" "import_command_failed" "live 导入失败" "请查看 import-failure.json 与 logs/import.stderr.log。"
fi

if ! jq . "$IMPORT_STDOUT" >"$IMPORT_JSON"; then
  jq -n \
    --arg mode "$SELECTED_MODE" \
    --arg stdoutFile "logs/import.stdout.log" \
    --arg detail "导入命令成功退出，但 stdout 不是合法 JSON。" \
    '{
      mode: $mode,
      success: false,
      stdoutFile: $stdoutFile,
      detail: $detail
    }' >"$IMPORT_FAILURE_JSON"
  fail_stage "import" "import_stdout_invalid" "导入结果不是合法 JSON" "请查看 logs/import.stdout.log。"
fi

jq -e '
  .source == "neo4j" and
  (.relationCount > 0) and
  (.evidenceCount > 0) and
  (.snapshotCount > 0)
' "$IMPORT_JSON" >/dev/null || fail_stage "import" "import_not_live_neo4j" "导入未形成真实 Neo4j 写库结果" "需要 source=neo4j 且 relationCount/evidenceCount/snapshotCount 全部大于 0。"

log_cmd "npm --prefix $BACKEND_DIR start"
npm --prefix "$BACKEND_DIR" start >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!

wait_for_http "$API_BASE/api/v1/health" 45 2
case "$?" in
  0) ;;
  1) fail_stage "http_start" "backend_health_timeout" "后端未在预期时间内暴露 health 接口" "请查看 logs/backend-live.log。"
    ;;
  2) fail_stage "http_start" "backend_process_exited" "后端进程在 health 就绪前退出" "请查看 logs/backend-live.log。"
    ;;
esac

capture_json "health" "$API_BASE/api/v1/health" || fail_stage "http_smoke" "health_request_failed" "health 接口返回异常" "请检查 http/health.*。"
jq -e '
  .status == "ok" and
  .runtimeMode == "live" and
  .repositoryMode == "neo4j" and
  .contracts.mockGraphBoundary == false and
  .dependencies.neo4j.status == "up" and
  .dependencies.redis.status == "up"
' "$OUTPUT_DIR/http/health.json" >/dev/null || fail_stage "http_smoke" "health_not_ok" "health 未进入 live 可上线状态" "需要 status=ok、repositoryMode=neo4j、dependencies.neo4j/up、dependencies.redis/up。"
register_http_check "health"

capture_json "detail" "$API_BASE/api/v1/companies/company:AAPL" || fail_stage "http_smoke" "detail_request_failed" "detail 接口返回异常" "请检查 http/detail.*。"
jq -e '.source == "neo4j" and .item.id == "company:AAPL"' "$OUTPUT_DIR/http/detail.json" >/dev/null || fail_stage "http_smoke" "detail_validation_failed" "detail 返回不符合 live 验收要求" "需要 source=neo4j 且 item.id=company:AAPL。"
register_http_check "detail"

capture_json "overview" "$API_BASE/api/v1/companies/company:AAPL/overview" || fail_stage "http_smoke" "overview_request_failed" "overview 接口返回异常" "请检查 http/overview.*。"
jq -e '.source == "neo4j" and .companyId == "company:AAPL" and (.totalRelations > 0)' "$OUTPUT_DIR/http/overview.json" >/dev/null || fail_stage "http_smoke" "overview_validation_failed" "overview 返回不符合 live 验收要求" "需要 source=neo4j 且 totalRelations > 0。"
register_http_check "overview"

capture_json "search" "$API_BASE/api/v1/companies/search?q=amazon&limit=5" || fail_stage "http_smoke" "search_request_failed" "search 接口返回异常" "请检查 http/search.*。"
jq -e '.source == "neo4j" and any(.items[]; .id == "company:AMZN")' "$OUTPUT_DIR/http/search.json" >/dev/null || fail_stage "http_smoke" "search_validation_failed" "search 返回未命中 Amazon" "需要返回 company:AMZN。"
register_http_check "search"

capture_json "suggest" "$API_BASE/api/v1/companies/suggest?q=tes&limit=5" || fail_stage "http_smoke" "suggest_request_failed" "suggest 接口返回异常" "请检查 http/suggest.*。"
jq -e '.source == "neo4j" and any(.items[]; .id == "company:TSLA")' "$OUTPUT_DIR/http/suggest.json" >/dev/null || fail_stage "http_smoke" "suggest_validation_failed" "suggest 返回未命中 Tesla" "需要返回 company:TSLA。"
register_http_check "suggest"

capture_json "subgraph" "$API_BASE/api/v1/graph/subgraph?companyId=company:AAPL&depth=2&snapshot=published&includeEvidence=true" || fail_stage "http_smoke" "subgraph_request_failed" "subgraph 接口返回异常" "请检查 http/subgraph.*。"
jq -e '(.snapshot.id | type == "string") and (.relations | length > 0)' "$OUTPUT_DIR/http/subgraph.json" >/dev/null || fail_stage "http_smoke" "subgraph_validation_failed" "subgraph 返回为空或缺少 snapshot" "需要 snapshot.id 且 relations 非空。"
register_http_check "subgraph"

capture_json "path" "$API_BASE/api/v1/graph/path?sourceCompanyId=company:TSMC&targetCompanyId=company:AAPL&maxDepth=2&snapshot=published&includeEvidence=true" || fail_stage "http_smoke" "path_request_failed" "path 接口返回异常" "请检查 http/path.*。"
jq -e '(.relations | length > 0) and .relations[0].id == "rel:apple:tsmc:manufacturing:apple-silicon"' "$OUTPUT_DIR/http/path.json" >/dev/null || fail_stage "http_smoke" "path_validation_failed" "path 返回不符合验收锚点" "首条 relation 应为 rel:apple:tsmc:manufacturing:apple-silicon。"
register_http_check "path"

capture_json "stats" "$API_BASE/api/v1/graph/stats?snapshot=published&companyId=company:AMZN" || fail_stage "http_smoke" "stats_request_failed" "stats 接口返回异常" "请检查 http/stats.*。"
jq -e '.source == "neo4j" and (.relationCount > 0)' "$OUTPUT_DIR/http/stats.json" >/dev/null || fail_stage "http_smoke" "stats_validation_failed" "stats 返回不符合 live 验收要求" "需要 source=neo4j 且 relationCount > 0。"
register_http_check "stats"

capture_json "evidence" "$API_BASE/api/v1/relations/rel:apple:tsmc:manufacturing:apple-silicon/evidence" || fail_stage "http_smoke" "evidence_request_failed" "evidence 接口返回异常" "请检查 http/evidence.*。"
jq -e '.source == "neo4j" and .relationId == "rel:apple:tsmc:manufacturing:apple-silicon" and (.total > 0)' "$OUTPUT_DIR/http/evidence.json" >/dev/null || fail_stage "http_smoke" "evidence_validation_failed" "evidence 返回不符合 live 验收要求" "需要 source=neo4j、relationId 正确且 total > 0。"
register_http_check "evidence"

write_http_summary true
write_success_result

echo "real_data_launch 验收通过。结果目录: $OUTPUT_DIR"

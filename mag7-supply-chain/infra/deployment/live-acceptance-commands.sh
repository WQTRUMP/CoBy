#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
用法：
  bash infra/deployment/live-acceptance-commands.sh [--services-mode docker|external] [--output-dir <dir>] [--keep-services] [--skip-preview-baseline]

说明：
  - docker 模式：用仓库自带 compose 拉起 Neo4j/Redis/MinIO，完成 full.16 authoritative 包导入与 HTTP 验收。
  - external 模式：复用外部已启动的 Neo4j/Redis，仅执行导入与 HTTP 验收。
  - 所有证据会写入 --output-dir；默认写到 mktemp 目录。

环境变量：
  REPO_ROOT           仓库根目录，默认 /workspace/project/mag7-supply-chain
  BACKEND_DIR         backend 目录，默认 $REPO_ROOT/backend
  PACKAGE_DIR         full.16 数据包目录，默认 /workspace/agents/evidence-collector/output/mag7-full-package
  EXPECTED_PACKAGE_SNAPSHOT authoritative snapshot，默认 snapshot:2026-06-15.full.16
  API_BASE            API 基址，默认 http://127.0.0.1:4000
  PORT                后端端口，默认 4000
  HOST                后端监听地址，默认 127.0.0.1
  GRAPH_RUNTIME_MODE  必须为 live
  NEO4J_URI           默认 bolt://127.0.0.1:7687
  NEO4J_USERNAME      默认 neo4j
  NEO4J_PASSWORD      默认 mag7-dev-password
  NEO4J_DATABASE      默认 neo4j
  REDIS_URL           默认 redis://127.0.0.1:6379
  CORS_ORIGIN         默认 http://127.0.0.1:5174
EOF
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "缺少依赖命令: $1" >&2
    return 1
  }
}

wait_for_http() {
  local url="$1"
  local attempts="${2:-30}"
  local sleep_seconds="${3:-2}"

  for _ in $(seq 1 "$attempts"); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep "$sleep_seconds"
  done

  echo "等待 HTTP 就绪超时: $url" >&2
  return 1
}

capture_json() {
  local url="$1"
  local body_path="$2"
  local headers_path="$3"

  curl -sS -D "$headers_path" "$url" -o "$body_path"
  grep -qi '^content-type: application/json' "$headers_path"
  jq . "$body_path" >/dev/null
}

assert_http_status() {
  local expected="$1"
  local url="$2"
  local body_path="$3"

  local actual
  actual="$(curl -sS -o "$body_path" -w '%{http_code}' "$url")"
  test "$actual" = "$expected"
}

SERVICES_MODE="docker"
OUTPUT_DIR=""
KEEP_SERVICES="false"
SKIP_PREVIEW_BASELINE="false"

while (($# > 0)); do
  case "$1" in
    --services-mode)
      SERVICES_MODE="${2:-}"
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
    --skip-preview-baseline)
      SKIP_PREVIEW_BASELINE="true"
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

if [[ "$SERVICES_MODE" != "docker" && "$SERVICES_MODE" != "external" ]]; then
  echo "--services-mode 只支持 docker 或 external" >&2
  exit 1
fi

REPO_ROOT="${REPO_ROOT:-/workspace/project/mag7-supply-chain}"
BACKEND_DIR="${BACKEND_DIR:-$REPO_ROOT/backend}"
PACKAGE_DIR="${PACKAGE_DIR:-/workspace/agents/evidence-collector/output/mag7-full-package}"
PACKAGE_MANIFEST="${PACKAGE_DIR}/mag7-full-package-manifest.json"
EXPECTED_PACKAGE_SNAPSHOT="${EXPECTED_PACKAGE_SNAPSHOT:-snapshot:2026-06-15.full.16}"
API_BASE="${API_BASE:-http://127.0.0.1:4000}"

export PORT="${PORT:-4000}"
export HOST="${HOST:-127.0.0.1}"
export GRAPH_RUNTIME_MODE="${GRAPH_RUNTIME_MODE:-live}"
export NEO4J_URI="${NEO4J_URI:-bolt://127.0.0.1:7687}"
export NEO4J_USERNAME="${NEO4J_USERNAME:-neo4j}"
export NEO4J_PASSWORD="${NEO4J_PASSWORD:-mag7-dev-password}"
export NEO4J_DATABASE="${NEO4J_DATABASE:-neo4j}"
export REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6379}"
export CORS_ORIGIN="${CORS_ORIGIN:-http://127.0.0.1:5174}"

COMPOSE_FILE="$REPO_ROOT/docker-compose.dev.yml"
OUTPUT_DIR="${OUTPUT_DIR:-$(mktemp -d /tmp/mag7-live-acceptance-XXXXXX)}"
mkdir -p "$OUTPUT_DIR"

PREREQ_REPORT="$OUTPUT_DIR/prerequisites.txt"
SUMMARY_JSON="$OUTPUT_DIR/acceptance-summary.json"
IMPORT_JSON="$OUTPUT_DIR/import-summary.json"
SERVER_LOG="$OUTPUT_DIR/backend-live.log"
PACKAGE_MANIFEST_COPY="$OUTPUT_DIR/package-manifest.json"
PREVIEW_LOG="$OUTPUT_DIR/frontend-preview.log"
PREVIEW_BACKEND_LOG="$OUTPUT_DIR/backend-preview.log"
DOCKER_PS="$OUTPUT_DIR/docker-compose-ps.txt"
DOCKER_LOGS_DIR="$OUTPUT_DIR/docker-logs"
mkdir -p "$DOCKER_LOGS_DIR"

PREVIEW_PID=""
PREVIEW_BACKEND_PID=""
SERVER_PID=""
STARTED_DOCKER_SERVICES="false"

cleanup() {
  if [[ -n "$PREVIEW_PID" ]]; then
    kill "$PREVIEW_PID" >/dev/null 2>&1 || true
    wait "$PREVIEW_PID" >/dev/null 2>&1 || true
  fi

  if [[ -n "$PREVIEW_BACKEND_PID" ]]; then
    kill "$PREVIEW_BACKEND_PID" >/dev/null 2>&1 || true
    wait "$PREVIEW_BACKEND_PID" >/dev/null 2>&1 || true
  fi

  if [[ -n "$SERVER_PID" ]]; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
    wait "$SERVER_PID" >/dev/null 2>&1 || true
  fi

  if [[ "$SERVICES_MODE" = "docker" && "$STARTED_DOCKER_SERVICES" = "true" ]]; then
    docker compose -f "$COMPOSE_FILE" logs --no-color >"$DOCKER_LOGS_DIR/compose.log" 2>&1 || true
    docker compose -f "$COMPOSE_FILE" logs --no-color neo4j >"$DOCKER_LOGS_DIR/neo4j.log" 2>&1 || true
    docker compose -f "$COMPOSE_FILE" logs --no-color redis >"$DOCKER_LOGS_DIR/redis.log" 2>&1 || true
    docker compose -f "$COMPOSE_FILE" logs --no-color minio >"$DOCKER_LOGS_DIR/minio.log" 2>&1 || true

    if [[ "$KEEP_SERVICES" != "true" ]]; then
      docker compose -f "$COMPOSE_FILE" down >/dev/null 2>&1 || true
    fi
  fi
}

trap cleanup EXIT

{
  echo "services_mode=$SERVICES_MODE"
  echo "repo_root=$REPO_ROOT"
  echo "backend_dir=$BACKEND_DIR"
  echo "package_dir=$PACKAGE_DIR"
  echo "package_manifest=$PACKAGE_MANIFEST"
  echo "expected_package_snapshot=$EXPECTED_PACKAGE_SNAPSHOT"
  echo "api_base=$API_BASE"
  echo "output_dir=$OUTPUT_DIR"
  echo "graph_runtime_mode=$GRAPH_RUNTIME_MODE"
} >"$PREREQ_REPORT"

require_command node
require_command npm
require_command curl
require_command jq
echo "node=$(node -v)" >>"$PREREQ_REPORT"
echo "npm=$(npm -v)" >>"$PREREQ_REPORT"
echo "jq=$(jq --version)" >>"$PREREQ_REPORT"
test "$GRAPH_RUNTIME_MODE" = "live"
test -f "$PACKAGE_MANIFEST"
test -f "$PACKAGE_DIR/relations.jsonl"
test -f "$PACKAGE_DIR/evidence.jsonl"
PACKAGE_SNAPSHOT_ID="$(jq -r '.package_snapshot_id' "$PACKAGE_MANIFEST")"
PACKAGE_VERSION="$(jq -r '.package_version' "$PACKAGE_MANIFEST")"
test "$PACKAGE_SNAPSHOT_ID" = "$EXPECTED_PACKAGE_SNAPSHOT"
cp "$PACKAGE_MANIFEST" "$PACKAGE_MANIFEST_COPY"
echo "package_version=$PACKAGE_VERSION" >>"$PREREQ_REPORT"
echo "package_snapshot_id=$PACKAGE_SNAPSHOT_ID" >>"$PREREQ_REPORT"
wc -l "$PACKAGE_DIR/relations.jsonl" "$PACKAGE_DIR/evidence.jsonl" >>"$PREREQ_REPORT"

if [[ "$SERVICES_MODE" = "docker" ]]; then
  require_command docker
  docker compose version >>"$PREREQ_REPORT"
else
  echo "external_mode=expecting pre-provisioned neo4j/redis endpoints" >>"$PREREQ_REPORT"
fi

echo "== 1. 安装依赖 =="
cd "$REPO_ROOT"
npm install
cd "$BACKEND_DIR"
npm install

echo "== 1.1 构建前后端产物 =="
cd "$REPO_ROOT"
npm run build
cd "$BACKEND_DIR"
npm run build

if [[ "$SKIP_PREVIEW_BASELINE" != "true" ]]; then
  echo "== 2. preview/default JSON 与 live 失败语义基线 =="
  cd "$BACKEND_DIR"
  env -u NEO4J_URI -u REDIS_URL GRAPH_RUNTIME_MODE=live npm start >"$PREVIEW_BACKEND_LOG" 2>&1 &
  PREVIEW_BACKEND_PID=$!
  cd "$REPO_ROOT"
  env -u VITE_GRAPH_API_BASE_URL npm run preview -- --host 127.0.0.1 --port 4173 >"$PREVIEW_LOG" 2>&1 &
  PREVIEW_PID=$!

  wait_for_http "http://127.0.0.1:4173/api/v1/health"
  capture_json \
    "http://127.0.0.1:4173/api/v1/health" \
    "$OUTPUT_DIR/preview-health.json" \
    "$OUTPUT_DIR/preview-health.headers"
  capture_json \
    "http://127.0.0.1:4173/api" \
    "$OUTPUT_DIR/preview-api.json" \
    "$OUTPUT_DIR/preview-api.headers"

  grep -q '404' "$OUTPUT_DIR/preview-api.headers"
  jq -e '
    .runtimeMode == "live" and
    .repositoryMode == "neo4j" and
    .contracts.mockGraphBoundary == false and
    .status == "degraded"
  ' "$OUTPUT_DIR/preview-health.json" >/dev/null

  assert_http_status \
    "503" \
    "http://127.0.0.1:4173/api/v1/companies?isMag7=true&page=1&pageSize=2" \
    "$OUTPUT_DIR/preview-companies.json"
  jq -e '
    .error == "dependency_unavailable" and
    .dependency == "neo4j" and
    (.detail | contains("GRAPH_RUNTIME_MODE=live"))
  ' "$OUTPUT_DIR/preview-companies.json" >/dev/null

  kill "$PREVIEW_PID" >/dev/null 2>&1 || true
  wait "$PREVIEW_PID" >/dev/null 2>&1 || true
  PREVIEW_PID=""
  kill "$PREVIEW_BACKEND_PID" >/dev/null 2>&1 || true
  wait "$PREVIEW_BACKEND_PID" >/dev/null 2>&1 || true
  PREVIEW_BACKEND_PID=""
fi

if [[ "$SERVICES_MODE" = "docker" ]]; then
  echo "== 3. 拉起 Neo4j / Redis / MinIO =="
  cd "$REPO_ROOT"
  docker compose -f "$COMPOSE_FILE" up -d
  STARTED_DOCKER_SERVICES="true"
  docker compose -f "$COMPOSE_FILE" ps >"$DOCKER_PS"

  echo "== 4. 等待 Neo4j / Redis 健康 =="
  for _ in $(seq 1 40); do
    if docker compose -f "$COMPOSE_FILE" ps --format json | jq -e '
      map(select(.Service == "neo4j" and .Health == "healthy")) | length == 1
    ' >/dev/null 2>&1; then
      break
    fi
    sleep 3
  done

  for _ in $(seq 1 40); do
    if docker compose -f "$COMPOSE_FILE" ps --format json | jq -e '
      map(select(.Service == "redis" and .Health == "healthy")) | length == 1
    ' >/dev/null 2>&1; then
      break
    fi
    sleep 2
  done

  docker exec mag7-neo4j cypher-shell -u "$NEO4J_USERNAME" -p "$NEO4J_PASSWORD" -d system 'RETURN 1;' \
    >"$OUTPUT_DIR/neo4j-system-check.txt"
  docker exec mag7-redis redis-cli ping >"$OUTPUT_DIR/redis-ping.txt"
fi

echo "== 5. 导入 ${PACKAGE_SNAPSHOT_ID}，必须返回 source=neo4j =="
npm run import:normalized -- \
  --relations "$PACKAGE_DIR/relations.jsonl" \
  --evidence "$PACKAGE_DIR/evidence.jsonl" | tee "$IMPORT_JSON"

jq -e '
  .source == "neo4j" and
  (.relationCount > 0) and
  (.evidenceCount > 0) and
  (.snapshotCount > 0)
' "$IMPORT_JSON" >/dev/null

echo "== 6. 启动 live backend =="
cd "$BACKEND_DIR"
npm start >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!
wait_for_http "$API_BASE/api/v1/health"

echo "== 7. health 验收 =="
capture_json \
  "$API_BASE/api/v1/health" \
  "$OUTPUT_DIR/health.json" \
  "$OUTPUT_DIR/health.headers"
jq -e '
  .status == "ok" and
  .runtimeMode == "live" and
  .repositoryMode == "neo4j" and
  .contracts.mockGraphBoundary == false and
  .dependencies.neo4j.status == "up" and
  .dependencies.redis.status == "up"
' "$OUTPUT_DIR/health.json" >/dev/null

echo "== 8. companies/detail/overview/search/suggest/list 验收 =="
capture_json \
  "$API_BASE/api/v1/companies?isMag7=true&page=1&pageSize=5" \
  "$OUTPUT_DIR/companies-list.json" \
  "$OUTPUT_DIR/companies-list.headers"
jq -e '
  .source == "neo4j" and
  any(.items[]; .id == "company:AMZN")
' "$OUTPUT_DIR/companies-list.json" >/dev/null

capture_json \
  "$API_BASE/api/v1/companies/company:AAPL" \
  "$OUTPUT_DIR/company-detail.json" \
  "$OUTPUT_DIR/company-detail.headers"
jq -e '
  .source == "neo4j" and
  .item.id == "company:AAPL" and
  (.item.activeSnapshotId | type == "string")
' "$OUTPUT_DIR/company-detail.json" >/dev/null

capture_json \
  "$API_BASE/api/v1/companies/company:AAPL/overview" \
  "$OUTPUT_DIR/company-overview.json" \
  "$OUTPUT_DIR/company-overview.headers"
jq -e '
  .source == "neo4j" and
  .companyId == "company:AAPL" and
  (.totalRelations > 0) and
  (.activeSnapshotId | type == "string")
' "$OUTPUT_DIR/company-overview.json" >/dev/null

capture_json \
  "$API_BASE/api/v1/companies/search?q=amazon&limit=5" \
  "$OUTPUT_DIR/company-search.json" \
  "$OUTPUT_DIR/company-search.headers"
jq -e '
  .source == "neo4j" and
  any(.items[]; .id == "company:AMZN")
' "$OUTPUT_DIR/company-search.json" >/dev/null

capture_json \
  "$API_BASE/api/v1/companies/suggest?q=tes&limit=5" \
  "$OUTPUT_DIR/company-suggest.json" \
  "$OUTPUT_DIR/company-suggest.headers"
jq -e '
  .source == "neo4j" and
  any(.items[]; .id == "company:TSLA")
' "$OUTPUT_DIR/company-suggest.json" >/dev/null

echo "== 9. subgraph/path/stats/evidence 验收 =="
capture_json \
  "$API_BASE/api/v1/graph/subgraph?companyId=company:AAPL&depth=2&snapshot=published&includeEvidence=true" \
  "$OUTPUT_DIR/subgraph.json" \
  "$OUTPUT_DIR/subgraph.headers"
jq -e '
  (.snapshot.id | type == "string") and
  (.relations | length > 0)
' "$OUTPUT_DIR/subgraph.json" >/dev/null

capture_json \
  "$API_BASE/api/v1/graph/path?sourceCompanyId=company:TSMC&targetCompanyId=company:AAPL&maxDepth=2&snapshot=published&includeEvidence=true" \
  "$OUTPUT_DIR/path.json" \
  "$OUTPUT_DIR/path.headers"
jq -e '
  (.snapshot.id | type == "string") and
  (.relations | length > 0) and
  .relations[0].id == "rel:apple:tsmc:manufacturing:apple-silicon"
' "$OUTPUT_DIR/path.json" >/dev/null

capture_json \
  "$API_BASE/api/v1/graph/stats?snapshot=published&companyId=company:AMZN" \
  "$OUTPUT_DIR/stats.json" \
  "$OUTPUT_DIR/stats.headers"
jq -e '
  .source == "neo4j" and
  (.relationCount > 0)
' "$OUTPUT_DIR/stats.json" >/dev/null

capture_json \
  "$API_BASE/api/v1/relations/rel:apple:tsmc:manufacturing:apple-silicon/evidence" \
  "$OUTPUT_DIR/evidence.json" \
  "$OUTPUT_DIR/evidence.headers"
jq -e '
  .source == "neo4j" and
  .relationId == "rel:apple:tsmc:manufacturing:apple-silicon" and
  (.total > 0)
' "$OUTPUT_DIR/evidence.json" >/dev/null

echo "== 10. 汇总 =="
jq -n \
  --arg servicesMode "$SERVICES_MODE" \
  --arg packageSnapshotId "$PACKAGE_SNAPSHOT_ID" \
  --arg packageVersion "$PACKAGE_VERSION" \
  --arg outputDir "$OUTPUT_DIR" \
  --slurpfile health "$OUTPUT_DIR/health.json" \
  --slurpfile imported "$IMPORT_JSON" \
  --slurpfile detail "$OUTPUT_DIR/company-detail.json" \
  --slurpfile overview "$OUTPUT_DIR/company-overview.json" \
  --slurpfile search "$OUTPUT_DIR/company-search.json" \
  --slurpfile suggest "$OUTPUT_DIR/company-suggest.json" \
  --slurpfile subgraph "$OUTPUT_DIR/subgraph.json" \
  --slurpfile path "$OUTPUT_DIR/path.json" \
  --slurpfile stats "$OUTPUT_DIR/stats.json" \
  --slurpfile evidence "$OUTPUT_DIR/evidence.json" \
  '{
    passed: true,
    servicesMode: $servicesMode,
    packageSnapshotId: $packageSnapshotId,
    packageVersion: $packageVersion,
    outputDir: $outputDir,
    import: $imported[0],
    health: $health[0],
    checks: {
      detail: { companyId: $detail[0].item.id, source: $detail[0].source },
      overview: { companyId: $overview[0].companyId, totalRelations: $overview[0].totalRelations, source: $overview[0].source },
      search: { count: ($search[0].items | length), source: $search[0].source },
      suggest: { count: ($suggest[0].items | length), source: $suggest[0].source },
      subgraph: { relationCount: ($subgraph[0].relations | length), snapshotId: $subgraph[0].snapshot.id },
      path: { relationCount: ($path[0].relations | length), firstRelationId: $path[0].relations[0].id },
      stats: { relationCount: $stats[0].relationCount, source: $stats[0].source },
      evidence: { relationId: $evidence[0].relationId, total: $evidence[0].total, source: $evidence[0].source }
    }
  }' >"$SUMMARY_JSON"

echo "real_data_launch 验收通过。证据目录: $OUTPUT_DIR"

#!/usr/bin/env bash
set -euo pipefail

# Mag7 live Neo4j/Redis 真实环境验收命令清单
# 用途：
# 1. 在具备 Docker + Node 22 的外部环境中执行真实依赖闭环；
# 2. 验证导入不是 mock；
# 3. 验证 health/detail/overview/search/suggest/subgraph/path/stats/evidence。

REPO_ROOT="${REPO_ROOT:-/workspace/project/mag7-supply-chain}"
BACKEND_DIR="${BACKEND_DIR:-$REPO_ROOT/backend}"
PACKAGE_DIR="${PACKAGE_DIR:-/workspace/agents/evidence-collector/output/mag7-full-package}"
API_BASE="${API_BASE:-http://127.0.0.1:4000}"

export PORT="${PORT:-4000}"
export HOST="${HOST:-127.0.0.1}"
export NEO4J_URI="${NEO4J_URI:-bolt://127.0.0.1:7687}"
export NEO4J_USERNAME="${NEO4J_USERNAME:-neo4j}"
export NEO4J_PASSWORD="${NEO4J_PASSWORD:-mag7-dev-password}"
export NEO4J_DATABASE="${NEO4J_DATABASE:-neo4j}"
export REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6379}"
export CORS_ORIGIN="${CORS_ORIGIN:-http://127.0.0.1:5174}"

echo "== 0. 前置检查 =="
node -v
docker --version
docker compose version
jq --version
test -f "$PACKAGE_DIR/relations.jsonl"
test -f "$PACKAGE_DIR/evidence.jsonl"
wc -l "$PACKAGE_DIR/relations.jsonl" "$PACKAGE_DIR/evidence.jsonl"

echo "== 1. 安装依赖 =="
cd "$REPO_ROOT"
npm install
cd "$BACKEND_DIR"
npm install

echo "== 2. preview/default JSON 基线检查 =="
PREVIEW_LOG="$(mktemp)"
BACKEND_LOG="$(mktemp)"

cd "$BACKEND_DIR"
npm start >"$BACKEND_LOG" 2>&1 &
DEFAULT_BACKEND_PID=$!
cd "$REPO_ROOT"
npm run preview -- --host 127.0.0.1 --port 4173 >"$PREVIEW_LOG" 2>&1 &
PREVIEW_PID=$!

cleanup_preview() {
  kill "$PREVIEW_PID" >/dev/null 2>&1 || true
  kill "$DEFAULT_BACKEND_PID" >/dev/null 2>&1 || true
}

trap 'cleanup_preview; kill "${SERVER_PID:-0}" >/dev/null 2>&1 || true' EXIT

for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:4173/api/v1/health" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

curl -sS -D /tmp/mag7-preview-health.headers "http://127.0.0.1:4173/api/v1/health" -o /tmp/mag7-preview-health.json
grep -qi '^content-type: application/json' /tmp/mag7-preview-health.headers
jq . /tmp/mag7-preview-health.json

curl -sS -D /tmp/mag7-preview-api.headers "http://127.0.0.1:4173/api" -o /tmp/mag7-preview-api.json
grep -q '404' /tmp/mag7-preview-api.headers
grep -qi '^content-type: application/json' /tmp/mag7-preview-api.headers
jq . /tmp/mag7-preview-api.json

echo "== 2.1 preview/default live 失败语义记录 =="
jq -e '
  .runtimeMode == "live" and
  .repositoryMode == "neo4j" and
  .contracts.mockGraphBoundary == false and
  (.dependencies.neo4j.status == "not_configured" or .dependencies.neo4j.status == "down") and
  (.dependencies.redis.status == "not_configured" or .dependencies.redis.status == "down")
' /tmp/mag7-preview-health.json >/dev/null

PREVIEW_STATUS="$(curl -sS -o /tmp/mag7-preview-companies.json -w '%{http_code}' "http://127.0.0.1:4173/api/v1/companies?isMag7=true&page=1&pageSize=2")"
test "$PREVIEW_STATUS" = "503"
cat /tmp/mag7-preview-companies.json | jq .
jq -e '
  .error == "dependency_unavailable" and
  .dependency == "neo4j" and
  (.detail | contains("GRAPH_RUNTIME_MODE=live"))
' /tmp/mag7-preview-companies.json >/dev/null

cleanup_preview
trap 'kill "${SERVER_PID:-0}" >/dev/null 2>&1 || true' EXIT

echo "== 3. 拉起 Neo4j / Redis / MinIO =="
cd "$REPO_ROOT"
docker compose -f infra/docker/docker-compose.dev.yml up -d
docker compose -f infra/docker/docker-compose.dev.yml ps

echo "== 4. 等待 Neo4j 与 Redis 健康 =="
for _ in $(seq 1 30); do
  if docker compose -f infra/docker/docker-compose.dev.yml ps --format json | jq -e '
    map(select(.Service == "neo4j" and .Health == "healthy")) | length == 1
  ' >/dev/null 2>&1; then
    break
  fi
  sleep 5
done

for _ in $(seq 1 30); do
  if docker compose -f infra/docker/docker-compose.dev.yml ps --format json | jq -e '
    map(select(.Service == "redis" and .Health == "healthy")) | length == 1
  ' >/dev/null 2>&1; then
    break
  fi
  sleep 3
done

docker exec mag7-neo4j cypher-shell -u "$NEO4J_USERNAME" -p "$NEO4J_PASSWORD" -d system 'RETURN 1;'
docker exec mag7-redis redis-cli ping

echo "== 5. 构建 backend =="
cd "$BACKEND_DIR"
npm run build

echo "== 6. 导入全量包，必须返回 source=neo4j =="
IMPORT_JSON="$(mktemp)"
npm run import:normalized -- \
  --relations "$PACKAGE_DIR/relations.jsonl" \
  --evidence "$PACKAGE_DIR/evidence.jsonl" | tee "$IMPORT_JSON"

jq -e '
  .source == "neo4j" and
  (.relationCount > 0) and
  (.evidenceCount > 0) and
  (.snapshotCount > 0)
' "$IMPORT_JSON" >/dev/null

echo "== 7. 启动 backend =="
SERVER_LOG="$(mktemp)"
cd "$BACKEND_DIR"
npm start >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" >/dev/null 2>&1 || true' EXIT

for _ in $(seq 1 30); do
  if curl -fsS "$API_BASE/api/v1/health" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo "== 8. 显式 live 模式失败语义探针 =="
curl -fsS "$API_BASE/api/v1/health" | tee /tmp/mag7-health-probe.json | jq .
jq -e '
  .repositoryMode == "neo4j" and
  .contracts.mockGraphBoundary == false
' /tmp/mag7-health-probe.json >/dev/null

echo "== 9. health 验收 =="
curl -fsS "$API_BASE/api/v1/health" | tee /tmp/mag7-health.json | jq .
jq -e '
  .status == "ok" and
  .repositoryMode == "neo4j" and
  .contracts.mockGraphBoundary == false and
  .dependencies.neo4j.status == "up" and
  .dependencies.redis.status == "up"
' /tmp/mag7-health.json >/dev/null

echo "== 10. companies/detail/overview/search/suggest 验收 =="
curl -fsS "$API_BASE/api/v1/companies/company:AAPL" | tee /tmp/mag7-detail.json | jq .
jq -e '
  .source == "neo4j" and
  .item.id == "company:AAPL" and
  (.item.activeSnapshotId | type == "string")
' /tmp/mag7-detail.json >/dev/null

curl -fsS "$API_BASE/api/v1/companies/company:AAPL/overview" | tee /tmp/mag7-overview.json | jq .
jq -e '
  .source == "neo4j" and
  .companyId == "company:AAPL" and
  (.totalRelations > 0) and
  (.activeSnapshotId | type == "string")
' /tmp/mag7-overview.json >/dev/null

curl -fsS "$API_BASE/api/v1/companies/search?q=amazon&limit=5" | tee /tmp/mag7-search.json | jq .
jq -e '
  .source == "neo4j" and
  any(.items[]; .id == "company:AMZN")
' /tmp/mag7-search.json >/dev/null

curl -fsS "$API_BASE/api/v1/companies/suggest?q=tes&limit=5" | tee /tmp/mag7-suggest.json | jq .
jq -e '
  .source == "neo4j" and
  any(.items[]; .id == "company:TSLA")
' /tmp/mag7-suggest.json >/dev/null

echo "== 11. subgraph/path/stats/evidence 验收 =="
curl -fsS "$API_BASE/api/v1/graph/subgraph?companyId=company:AAPL&depth=2&snapshot=published&includeEvidence=true" | tee /tmp/mag7-subgraph.json | jq .
jq -e '
  (.snapshot.id | type == "string") and
  (.relations | length > 0)
' /tmp/mag7-subgraph.json >/dev/null

curl -fsS "$API_BASE/api/v1/graph/path?sourceCompanyId=company:TSMC&targetCompanyId=company:AAPL&maxDepth=2&snapshot=published&includeEvidence=true" | tee /tmp/mag7-path.json | jq .
jq -e '
  (.snapshot.id | type == "string") and
  (.relations | length > 0) and
  .relations[0].id == "rel:apple:tsmc:manufacturing:apple-silicon"
' /tmp/mag7-path.json >/dev/null

curl -fsS "$API_BASE/api/v1/graph/stats?snapshot=published&companyId=company:AMZN" | tee /tmp/mag7-stats.json | jq .
jq -e '
  .source == "neo4j" and
  (.relationCount > 0)
' /tmp/mag7-stats.json >/dev/null

curl -fsS "$API_BASE/api/v1/relations/rel:apple:tsmc:manufacturing:apple-silicon/evidence" | tee /tmp/mag7-evidence.json | jq .
jq -e '
  .source == "neo4j" and
  .relationId == "rel:apple:tsmc:manufacturing:apple-silicon" and
  (.total > 0)
' /tmp/mag7-evidence.json >/dev/null

echo "== 12. 通过判定 =="
echo "real_data_launch 验收通过：导入为 live neo4j，health/status=ok，全部核心接口返回真实数据。"

echo "== 13. 收尾 =="
kill "$SERVER_PID"
wait "$SERVER_PID" || true
docker compose -f "$REPO_ROOT/infra/docker/docker-compose.dev.yml" down

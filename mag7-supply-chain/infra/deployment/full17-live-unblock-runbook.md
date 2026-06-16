# Mag7 full.17 real_data_launch 外部解阻塞运行手册

## 1. 目的

本手册用于把 `real_data_launch` 从当前 `blocked` 推进到可判定状态，供人类在外部可达的 Neo4j/Redis 环境中直接执行。权威输入固定如下：

- 正式链：`ac99e36b + ec276475 -> 1b401c37`
- authoritative snapshot：`snapshot:2026-06-15.full.17`
- 默认运行态：`GRAPH_RUNTIME_MODE=live`
- 禁止事项：任何一步都不得把 `prototype`、`mock`、in-memory real-shape、或 degraded 失败语义表述成 live 通过

本手册不触发任何 Cloudflare、域名或付费资源自动变更；它只定义如何在已有外部依赖上完成一次真实验收。

## 2. 最小外部前置

执行者只需要补齐以下最小集合，不需要先改代码：

1. 一套可达的 Neo4j 5.26 兼容实例。
2. 一套可达的 Redis 7.4 兼容实例。
3. `Node.js v22.22.3`、`npm`、`curl`、`jq`。
4. 工作区内存在完整数据包目录 `/workspace/agents/evidence-collector/output/mag7-full-package`。
5. 允许在验收期间本地启动 backend 进程并访问其监听端口。

如果 Neo4j 或 Redis 需要人工开通、白名单、TLS 或付费计划，先由人类完成；代理不得直接使用提供商凭据做任何托管侧操作。

## 3. Provider-Neutral 接入原则

本项目只依赖标准连接信息，不绑定某个云厂商：

- Neo4j：接受 `bolt://host:7687`、`neo4j://host:7687`、`neo4j+s://host:7687` 等 URI，只要当前运行器可达。
- Redis：接受 `redis://host:6379/0` 或 `rediss://host:6380/0` 等标准 URL，只要当前运行器可达。
- `NEO4J_DATABASE` 可以是 `neo4j`，也可以是专门的验收数据库名。
- `REDIS_URL` 建议指向独立实例，或至少使用独立 DB index，避免和现有环境共享脏数据。

推荐隔离策略：

1. 首选独立的 Neo4j 验收数据库和独立 Redis 实例或独立 DB index。
2. 如果提供商不支持多数据库，则至少使用独立实例。
3. 不得直接在共享生产图数据库上跑首次验收导入。

## 4. 必填环境变量

从 [`full17-live-unblock.env.template`](/workspace/project/mag7-supply-chain/infra/deployment/full17-live-unblock.env.template) 复制一份本地 env 文件后，至少填完下面 6 项：

```dotenv
GRAPH_RUNTIME_MODE=live
NEO4J_URI=<provider-neutral-neo4j-uri>
NEO4J_USERNAME=<neo4j-user>
NEO4J_PASSWORD=<neo4j-password>
NEO4J_DATABASE=<validation-database>
REDIS_URL=<provider-neutral-redis-url>
```

可选但建议明确：

```dotenv
PORT=4000
HOST=127.0.0.1
API_BASE=http://127.0.0.1:4000
EXPECTED_PACKAGE_SNAPSHOT=snapshot:2026-06-15.full.17
VALIDATION_OUTPUT_DIR=/tmp/mag7-live-acceptance-full17
```

## 5. 逐步执行命令

### 第 1 步：确认工具链和数据包

```bash
node -v
npm -v
jq --version
curl --version | head -n 1
jq -r '.package_snapshot_id' /workspace/agents/evidence-collector/output/mag7-full-package/mag7-full-package-manifest.json
wc -l /workspace/agents/evidence-collector/output/mag7-full-package/relations.jsonl
wc -l /workspace/agents/evidence-collector/output/mag7-full-package/evidence.jsonl
```

成功判据：

- `node -v` 必须是 `v22.22.3`
- snapshot 必须是 `snapshot:2026-06-15.full.17`
- `relations.jsonl`、`evidence.jsonl` 都存在且行数大于 0

### 第 2 步：写入 provider-neutral 配置

```bash
cp /workspace/project/mag7-supply-chain/infra/deployment/full17-live-unblock.env.template /tmp/mag7-full17-live.env
$EDITOR /tmp/mag7-full17-live.env
set -a
source /tmp/mag7-full17-live.env
set +a
```

成功判据：

- `GRAPH_RUNTIME_MODE=live`
- `NEO4J_URI`、`NEO4J_USERNAME`、`NEO4J_PASSWORD`、`NEO4J_DATABASE`、`REDIS_URL` 都非空

### 第 3 步：执行连通性预检

```bash
python_host_port() {
  node -e 'const u=new URL(process.argv[1]); process.stdout.write(`${u.hostname} ${u.port || process.argv[2]}`)' "$1" "$2"
}

read -r NEO4J_HOST NEO4J_PORT <<<"$(python_host_port "$NEO4J_URI" 7687)"
read -r REDIS_HOST REDIS_PORT <<<"$(python_host_port "$REDIS_URL" 6379)"

timeout 3 bash -lc "exec 3<>/dev/tcp/${NEO4J_HOST}/${NEO4J_PORT}"
timeout 3 bash -lc "exec 3<>/dev/tcp/${REDIS_HOST}/${REDIS_PORT}"
```

成功判据：

- 两条 TCP probe 都返回退出码 `0`

### 第 4 步：构建前后端

```bash
cd /workspace/project/mag7-supply-chain
npm run build

cd /workspace/project/mag7-supply-chain/backend
npm run build
```

成功判据：

- 前端 `vite build` 成功
- 后端 `tsc -p tsconfig.json` 成功

### 第 5 步：运行正式 live 验收脚本

```bash
cd /workspace/project/mag7-supply-chain
set -a
source /tmp/mag7-full17-live.env
set +a
bash infra/deployment/live-acceptance-commands.sh \
  --mode external \
  --output-dir "${VALIDATION_OUTPUT_DIR:-/tmp/mag7-live-acceptance-full17}"
```

成功判据：

- 命令退出码为 `0`
- 输出目录存在 `result.json`
- `result.json` 中 `passed = true`

### 第 6 步：逐项复核生成证据

```bash
jq . "${VALIDATION_OUTPUT_DIR:-/tmp/mag7-live-acceptance-full17}/result.json"
jq . "${VALIDATION_OUTPUT_DIR:-/tmp/mag7-live-acceptance-full17}/import-summary.json"
jq . "${VALIDATION_OUTPUT_DIR:-/tmp/mag7-live-acceptance-full17}/http/health.json"
jq . "${VALIDATION_OUTPUT_DIR:-/tmp/mag7-live-acceptance-full17}/http/detail.json"
jq . "${VALIDATION_OUTPUT_DIR:-/tmp/mag7-live-acceptance-full17}/http/overview.json"
jq . "${VALIDATION_OUTPUT_DIR:-/tmp/mag7-live-acceptance-full17}/http/search.json"
jq . "${VALIDATION_OUTPUT_DIR:-/tmp/mag7-live-acceptance-full17}/http/suggest.json"
jq . "${VALIDATION_OUTPUT_DIR:-/tmp/mag7-live-acceptance-full17}/http/subgraph.json"
jq . "${VALIDATION_OUTPUT_DIR:-/tmp/mag7-live-acceptance-full17}/http/path.json"
jq . "${VALIDATION_OUTPUT_DIR:-/tmp/mag7-live-acceptance-full17}/http/stats.json"
jq . "${VALIDATION_OUTPUT_DIR:-/tmp/mag7-live-acceptance-full17}/http/evidence.json"
```

成功判据见第 6 节。

## 6. 唯一通过门槛

只有同时满足以下条件，才允许把结论从 `real_data_launch blocked` 改成 `real_data_launch 通过`：

1. `import-summary.json`
   - `source = "neo4j"`
   - `relationCount > 0`
   - `evidenceCount > 0`
   - `snapshotCount > 0`
2. `http/health.json`
   - `status = "ok"`
   - `runtimeMode = "live"`
   - `repositoryMode = "neo4j"`
   - `contracts.mockGraphBoundary = false`
   - `dependencies.neo4j.status = "up"`
   - `dependencies.redis.status = "up"`
3. 以下接口全部成功返回 live 数据：
   - `GET /api/v1/companies/company:AAPL`
   - `GET /api/v1/companies/company:AAPL/overview`
   - `GET /api/v1/companies/search?q=amazon&limit=5`
   - `GET /api/v1/companies/suggest?q=tes&limit=5`
   - `GET /api/v1/graph/subgraph?...`
   - `GET /api/v1/graph/path?...`
   - `GET /api/v1/graph/stats?...`
   - `GET /api/v1/relations/rel:apple:tsmc:manufacturing:apple-silicon/evidence`
4. 所有带 `source` 的响应都必须是 `neo4j`，不得出现 `mock`
5. `result.json.passed = true`

## 7. 失败分流

常见失败码与动作：

- `external_env_incomplete`
  - 原因：必填 env 未填完
  - 动作：补齐 6 个 live 变量后重跑
- `neo4j_unreachable`
  - 原因：Neo4j URI 可解析，但 TCP 不可达
  - 动作：先修白名单、TLS、地址或实例状态
- `redis_unreachable`
  - 原因：Redis URL 可解析，但 TCP 不可达
  - 动作：先修网络、密码或实例状态
- `import_command_failed`
  - 原因：进入 live 导入后真实写库失败
  - 动作：查看 `import-failure.json` 与 `logs/import.stderr.log`
- `health_not_ok`
  - 原因：backend 已启动，但依赖仍非 `up`
  - 动作：检查 `http/health.json`，不能把 `degraded` 当通过
- `*_validation_failed`
  - 原因：接口返回 JSON，但不满足权威锚点
  - 动作：逐项检查对应 `http/*.json`

## 8. 回滚与清理

如果任一步失败，按下面顺序处理：

1. 停止本地 backend 进程，不切流量，不改域名，不更新 Cloudflare。
2. 保留本次 `${VALIDATION_OUTPUT_DIR}` 整个目录，作为失败证据。
3. 如果这次导入使用了独立 Neo4j 验收数据库：
   - 删除该验收数据库内本次导入的数据，或直接销毁整个验收数据库/实例。
4. 如果这次导入使用了独立 Redis 实例或独立 DB index：
   - 清空该实例或该 DB index 的键。
5. 如果环境不是隔离的共享生产依赖：
   - 立刻停止继续执行；本手册不允许在共享生产库上做首次验收，也不接受“先导入再手工挑数据删除”的回滚方式。

唯一允许的安全回滚路径，是在隔离的验收数据库/缓存上验证并清理；不是切回 mock。

## 9. 明确禁止

以下行为一律不允许：

1. 把 `GRAPH_RUNTIME_MODE=prototype` 当成 live 通过。
2. 看到 `health.status = "degraded"` 仍宣称验收完成。
3. 接口返回 `503 dependency_unavailable` 时改判为“服务可上线”。
4. 用 mock、prototype、或内存仓储结果替代 `source=neo4j` 的导入与回读证据。
5. 在没有人类审批的情况下触发 Cloudflare、正式域名、或付费资源变更。

## 10. 对外交付物

外部执行完成后，至少应回传以下文件：

1. `result.json`
2. `import-summary.json` 或 `import-failure.json`
3. `http/health.json`
4. `http/detail.json`
5. `http/overview.json`
6. `http/search.json`
7. `http/suggest.json`
8. `http/subgraph.json`
9. `http/path.json`
10. `http/stats.json`
11. `http/evidence.json`
12. `logs/backend-live.log`

只有这套成对证据回传后，DevOps 才能把 `real_data_launch` 从 `blocked` 改判。

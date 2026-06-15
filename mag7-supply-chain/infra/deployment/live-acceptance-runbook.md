# Mag7 full.17 live 真实验收自助运行包

## 1. 目标

本运行包用于把 `real_data_launch` 从当前 `blocked` 推进到可判定状态。权威输入固定为 `snapshot:2026-06-15.full.17`，脚本必须完成：

1. preflight：校验 full.17 数据包、Node/npm/curl/jq、运行时选择条件。
2. bring-up：自动选择 external Neo4j/Redis 或 Docker/Compose。
3. import：执行 `npm run import:normalized`，并要求 `source=neo4j`。
4. HTTP smoke：验证 `health`、`detail`、`overview`、`search`、`suggest`、`subgraph`、`path`、`stats`、`relations/:id/evidence`。
5. 结果沉淀：无论成功或失败，都输出结构化结果目录；严禁回退 mock。

## 2. 当前 authoritative 结论

- 唯一正式链固定为 `ac99e36b + ec276475 -> 1b401c37`，不得再引用任何 superseded 链作为正式依据。
- `authoritative snapshot` 固定为 `snapshot:2026-06-15.full.17`。
- `round17` 的正式定性是 `no-op merge`，不是 `full.18` 新正式轮次。
- `formal net new` 固定为 `Apple 0 / Alphabet 0 / Meta 0 / Tesla 0`。
- `prototype`：可单独部署，但仅限显式 `GRAPH_RUNTIME_MODE=prototype`。
- `real_data_launch`：截至 `2026-06-15` 仍 `blocked`。
- 唯一 authoritative 阻塞不是“本机缺 Docker”本身，而是仍缺一套基于 `snapshot:2026-06-15.full.17` 的真实 Neo4j/Redis 写库成功证据，以及 `health/detail/overview/search/suggest/subgraph/path/stats/relations/:id/evidence` 全链路 live 成功返回证据。
- `/opt/wanman/products.json` 若仍为空数组，系统状态只能维持 `unknown:no_product_inventory`。

## 3. 自助运行入口

- 主脚本：`infra/deployment/live-acceptance-commands.sh`
- 环境样例：`infra/deployment/live-acceptance.env.example`
- 验收模板：`infra/deployment/live-acceptance-evidence-template.md`

## 4. 自动模式选择

脚本默认 `--mode auto`，选择逻辑固定如下：

1. 如果 `NEO4J_URI`、`NEO4J_USERNAME`、`NEO4J_PASSWORD`、`NEO4J_DATABASE`、`REDIS_URL` 五项都已提供，则优先走 `external`。
2. 否则，如果当前机器可用 `docker compose`，则退回 `docker`。
3. 两者都不可用时，不做任何 mock 降级，而是输出 `result.json` 失败结论，并指向最小外部前置。

可选显式参数：

```bash
--mode auto|docker|external
--output-dir <dir>
--keep-services
```

## 5. 最小外部前置

只需要补齐以下最小集合，不要求额外改代码：

```dotenv
GRAPH_RUNTIME_MODE=live
NEO4J_URI=bolt://<reachable-neo4j-host>:7687
NEO4J_USERNAME=<username>
NEO4J_PASSWORD=<password>
NEO4J_DATABASE=neo4j
REDIS_URL=redis://<reachable-redis-host>:6379
```

同时需要：

- Node.js `v22.22.3`
- npm
- curl
- jq
- 若不用 external，则需要 Docker Engine + Docker Compose

## 6. 推荐执行方式

### 6.1 自动模式

```bash
cd /workspace/project/mag7-supply-chain
set -a
source infra/deployment/live-acceptance.env.example
set +a
bash infra/deployment/live-acceptance-commands.sh \
  --mode auto \
  --output-dir /tmp/mag7-live-acceptance-full17
```

### 6.2 显式 external

```bash
cd /workspace/project/mag7-supply-chain
set -a
source infra/deployment/live-acceptance.env.example
export NEO4J_URI='bolt://<reachable-neo4j-host>:7687'
export NEO4J_USERNAME='<username>'
export NEO4J_PASSWORD='<password>'
export NEO4J_DATABASE='neo4j'
export REDIS_URL='redis://<reachable-redis-host>:6379'
set +a
bash infra/deployment/live-acceptance-commands.sh \
  --mode external \
  --output-dir /tmp/mag7-live-acceptance-full17
```

### 6.3 显式 docker

```bash
cd /workspace/project/mag7-supply-chain
set -a
source infra/deployment/live-acceptance.env.example
set +a
bash infra/deployment/live-acceptance-commands.sh \
  --mode docker \
  --output-dir /tmp/mag7-live-acceptance-full17
```

## 7. 通过门槛

只有同时满足以下条件，才能把结论改成 `real_data_launch 通过`：

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
3. 以下 8 个接口全部成功：
   - `companies/company:AAPL`
   - `companies/company:AAPL/overview`
   - `companies/search?q=amazon&limit=5`
   - `companies/suggest?q=tes&limit=5`
   - `graph/subgraph?...`
   - `graph/path?...`
   - `graph/stats?...`
   - `relations/rel:apple:tsmc:manufacturing:apple-silicon/evidence`
4. 所有带 `source` 的响应必须为 `neo4j`，不得出现 `mock`。

## 8. 输出目录结构

脚本会至少产出：

- `preflight.json`
- `mode-selection.json`
- `bringup.json`
- `import-summary.json` 或 `import-failure.json`
- `http/health.json`
- `http/detail.json`
- `http/overview.json`
- `http/search.json`
- `http/suggest.json`
- `http/subgraph.json`
- `http/path.json`
- `http/stats.json`
- `http/evidence.json`
- `http-smoke-summary.json`
- `minimal-external-prerequisites.json`
- `result.json`
- `logs/backend-live.log`

若走 docker，还会额外包含：

- `docker/docker-compose-ps.txt`
- `docker/compose.log`
- `docker/neo4j.log`
- `docker/redis.log`

## 9. 失败分流

### 9.1 `runtime_unavailable`

含义：既没有完整 external 环境变量，也没有 Docker/Compose。

动作：补齐最小 external 输入，或换到带 Docker 的运行器。

### 9.2 `neo4j_unreachable` / `redis_unreachable`

含义：脚本已识别到 external 模式，但 TCP probe 无法连通依赖。

动作：先修复网络或实例状态，再重跑脚本。

### 9.3 `import_command_failed`

含义：脚本进入 live 导入，但真实写库失败。

动作：查看 `import-failure.json` 和 `logs/import.stderr.log`，确认是否是依赖拒绝连接、认证错误或图数据库约束问题。

### 9.4 `health_not_ok`

含义：backend 虽已启动，但 live 依赖仍未全部 ready。

动作：检查 `http/health.json` 的 `dependencies` 字段；不要把 `degraded` 写成通过。

### 9.5 `*_validation_failed`

含义：接口返回了 JSON，但不满足 authoritative full.17 验收锚点。

动作：检查对应 `http/*.json`，逐项比对 runbook 第 7 节。

## 10. 从 blocked 到通过的最小闭环

当前阻塞要解除，只差这一条闭环：

1. 提供一套可达 Neo4j/Redis。
2. 用本脚本重跑 full.17。
3. 拿到 `result.json.passed = true`，以及 `import-summary.json + http/*.json` 成套证据。

除此之外，不再要求额外 backlog、mock 演示或新的文档补丁。

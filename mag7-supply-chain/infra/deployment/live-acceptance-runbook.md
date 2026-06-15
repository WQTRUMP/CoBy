# Mag7 live Neo4j/Redis 真实环境验收 Runbook

## 1. 目的

本文件定义 `real_data_launch` 的正式闭环验收方式。目标是基于 `snapshot:2026-06-15.full.16` authoritative 正式包，在真实 `Neo4j + Redis` 依赖上完成：

1. 启动依赖或连接外部已就绪依赖。
2. 执行 `npm run import:normalized`，并确认写入源为 `neo4j`。
3. 验证 `health`、`companies`、`detail`、`overview`、`search`、`suggest`、`subgraph`、`path`、`stats`、`evidence` 全链路接口。
4. 产出可回传、可审计的证据目录，而不是只口头报告“跑过了”。

## 2. 当前结论

- `prototype`：可发布，但仅限显式 `GRAPH_RUNTIME_MODE=prototype` 的原型链路。
- `real_data_launch`：截至 `2026-06-15` 仍未在当前工作机直接跑通，唯一阻塞是当前机器缺少 Docker 或等效 Neo4j/Redis 运行时。
- 默认运行态：`GRAPH_RUNTIME_MODE=live`。如果 live 依赖缺失，允许的失败语义只有：
  - `GET /api/v1/health` 返回 `200` 且 `status=degraded`
  - 业务接口返回 `503 dependency_unavailable`
  - 不允许静默回退 `mock`

## 3. 本轮正式输入

### 3.1 正式包

- 路径：`/workspace/agents/evidence-collector/output/mag7-full-package`
- manifest：`mag7-full-package-manifest.json`
- package version：`1.15.0`
- package snapshot：`snapshot:2026-06-15.full.16`
- `relations.jsonl`：`273` 行
- `evidence.jsonl`：`361` 行

### 3.2 验收脚本与模板

- 一键执行器：`infra/deployment/live-acceptance-commands.sh`
- 环境变量样例：`infra/deployment/live-acceptance.env.example`
- 证据模板：`infra/deployment/live-acceptance-evidence-template.md`

## 4. 最小外部前置条件

满足以下两种模式之一即可：

### 4.1 Docker 模式

- 已验证 Node.js：`v22.22.3`
- npm
- `curl`
- `jq`
- Docker Engine
- Docker Compose

脚本会自动：

1. 启动 `docker-compose.dev.yml` 中的 `neo4j`、`neo4j-init`、`redis`、`minio`
2. 等待 Neo4j / Redis 健康
3. 执行导入与 HTTP 验收
4. 收集日志与返回体

### 4.2 External 模式

- 已验证 Node.js：`v22.22.3`
- npm
- `curl`
- `jq`
- 一套外部已就绪的 Neo4j 5.26 兼容实例
- 一套外部已就绪的 Redis 7.4 兼容实例
- 可用的 `NEO4J_URI` / `NEO4J_USERNAME` / `NEO4J_PASSWORD` / `NEO4J_DATABASE` / `REDIS_URL`

External 模式最小必填输入只有以下 6 项；其余变量不填则使用脚本默认值：

```dotenv
GRAPH_RUNTIME_MODE=live
NEO4J_URI=bolt://<external-host>:7687
NEO4J_USERNAME=<username>
NEO4J_PASSWORD=<password>
NEO4J_DATABASE=neo4j
REDIS_URL=redis://<external-host>:6379
```

可选项：

- `API_BASE`：若 backend 不监听 `http://127.0.0.1:4000`
- `HOST` / `PORT`：若需改本地 backend 监听地址
- `CORS_ORIGIN`：仅当前端 preview 基线需跨源时才需要
- `EXPECTED_PACKAGE_SNAPSHOT`：默认会校验 `snapshot:2026-06-15.full.16`

脚本不会拉本地容器，而是直接：

1. 用提供的环境变量启动 backend
2. 导入 full.16
3. 跑 HTTP 验收
4. 把证据落到输出目录

## 5. 环境变量

推荐先加载：

```bash
set -a
source infra/deployment/live-acceptance.env.example
set +a
```

最小必要变量如下：

```dotenv
GRAPH_RUNTIME_MODE=live
NEO4J_URI=bolt://127.0.0.1:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=mag7-dev-password
NEO4J_DATABASE=neo4j
REDIS_URL=redis://127.0.0.1:6379
EXPECTED_PACKAGE_SNAPSHOT=snapshot:2026-06-15.full.16
```

如需改变本地监听或 HTTP 验收地址，再额外覆盖：

```dotenv
API_BASE=http://127.0.0.1:4000
PORT=4000
HOST=127.0.0.1
CORS_ORIGIN=http://127.0.0.1:5174
```

## 6. 一键执行

### 6.1 Docker 模式

```bash
cd /workspace/project/mag7-supply-chain
set -a
source infra/deployment/live-acceptance.env.example
set +a
bash infra/deployment/live-acceptance-commands.sh \
  --services-mode docker \
  --output-dir /tmp/mag7-live-acceptance-full16
```

### 6.2 External 模式

```bash
cd /workspace/project/mag7-supply-chain
set -a
source infra/deployment/live-acceptance.env.example
export NEO4J_URI='bolt://<external-host>:7687'
export REDIS_URL='redis://<external-host>:6379'
set +a
bash infra/deployment/live-acceptance-commands.sh \
  --services-mode external \
  --output-dir /tmp/mag7-live-acceptance-full16
```

### 6.3 可选参数

- `--keep-services`
  - Docker 模式下保留容器，不在退出时 `down`
- `--skip-preview-baseline`
  - 跳过 preview/default 的 JSON 与 live 失败语义基线检查；适用于只做 external backend live 写库闭环、且不需要本机前端 preview 代理证据的最小验收

## 7. 脚本实际覆盖内容

`live-acceptance-commands.sh` 默认会顺序执行：

1. 前置依赖检查
2. `npm install`（根目录与 backend）
3. preview/default JSON + live 失败语义基线
4. `docker compose up -d` 或复用 external 依赖
5. `npm run build`
6. `npm run import:normalized -- --relations ... --evidence ...`
7. `npm start`
8. 逐接口断言并把结果写到 `--output-dir`
9. 生成 `acceptance-summary.json`

## 8. 通过门槛

只有同时满足以下条件，才能把结论改为 `real_data_launch 通过`：

1. `import-summary.json`
   - `source = "neo4j"`
   - `relationCount > 0`
   - `evidenceCount > 0`
   - `snapshotCount > 0`
2. `health.json`
   - `status = "ok"`
   - `runtimeMode = "live"`
   - `repositoryMode = "neo4j"`
   - `contracts.mockGraphBoundary = false`
   - `dependencies.neo4j.status = "up"`
   - `dependencies.redis.status = "up"`
3. 业务接口全部返回成功
   - `companies?isMag7=true&page=1&pageSize=5`
   - `companies/company:AAPL`
   - `companies/company:AAPL/overview`
   - `companies/search?q=amazon&limit=5`
   - `companies/suggest?q=tes&limit=5`
   - `graph/subgraph?...`
   - `graph/path?...`
   - `graph/stats?...`
   - `relations/rel:apple:tsmc:manufacturing:apple-silicon/evidence`
4. 需要带 `source` 的业务响应必须为 `neo4j`

## 9. 输出物与回传要求

`--output-dir` 至少会包含：

- `prerequisites.txt`
- `import-summary.json`
- `health.json`
- `companies-list.json`
- `company-detail.json`
- `company-overview.json`
- `company-search.json`
- `company-suggest.json`
- `subgraph.json`
- `path.json`
- `stats.json`
- `evidence.json`
- `acceptance-summary.json`
- `backend-live.log`
- `package-manifest.json`

Docker 模式额外包含：

- `docker-compose-ps.txt`
- `docker-logs/compose.log`
- `docker-logs/neo4j.log`
- `docker-logs/redis.log`
- `docker-logs/minio.log`

回传给审核方时，必须同时提交：

1. 证据目录压缩包
2. 按 `infra/deployment/live-acceptance-evidence-template.md` 填写的验收说明
3. 如失败，附唯一阻塞项与失败命令

## 10. 常见失败分流

### 10.1 `docker: command not found`

含义：

- 当前机器没有容器运行能力。

处理：

- 切换到具备 Docker 的运行器重新执行；
- 或改用 external 模式，并提供外部 Neo4j/Redis。

### 10.2 导入输出 `source != "neo4j"`

含义：

- 没有连上真实图数据库，或误进了 `prototype/mock`。

结论：

- 不能判定 `real_data_launch` 通过。

### 10.3 `health.status = degraded`

含义：

- live 依赖至少有一个未就绪。

结论：

- 这证明系统没有静默回退 mock；
- 但 `real_data_launch` 仍不通过。

### 10.4 业务接口返回 `503 dependency_unavailable`

含义：

- backend 已处于 live 路径，但 Neo4j 或 Redis 仍不可用。

结论：

- 继续排查依赖，不要把该结果写成“原型可用即上线可用”。

## 11. 当前工作机的唯一阻塞

本机已确认：

- Node.js 可用
- 代码与 full.16 数据包可读

本机仍缺：

- `docker`
- `docker compose`

因此当前工作机不能直接产出真实 Neo4j/Redis 写库闭环证据。最小外部前置清单已经收敛为：

1. 一台具备 Docker 的机器，或
2. 一套可访问的外部 Neo4j/Redis 端点

除此之外不再要求额外隐藏步骤。

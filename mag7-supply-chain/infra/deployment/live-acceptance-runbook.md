# Mag7 live Neo4j/Redis 真实环境验收 Runbook

## 1. 目的

本文件用于把 `/workspace/project/mag7-supply-chain` 的真实环境验收交接给外部运行器或人工执行者。目标不是验证 `prototype` 演示链路，而是验证：

1. 真实 `Neo4j + Redis` 已启动并可连通。
2. 全量包已通过 `npm run import:normalized` 写入真实图库，而不是回退到 `mock`。
3. 后端 `GET /api/v1/health`、`companies/detail/overview/search/suggest/subgraph/path/stats/evidence` 在真实依赖上返回成功结果。

## 2. 当前结论

- `prototype`：已具备发布条件，但允许 `mock / degraded`。
- `real_data_launch`：截至 `2026-06-14` 仍未通过，唯一保留阻塞是缺少一次可复验的 live `Neo4j/Redis` 导入与 HTTP 闭环。
- 当前工作机不能执行这套 live 闭环，原因见第 10 节。

## 3. 版本与运行时要求

### 基础运行时

- Node.js：`v22.22.3`
- npm：随 Node 22 安装
- Docker Engine + Docker Compose：必需
- `curl`：必需
- `jq`：强烈建议，用于断言返回字段

### 状态依赖版本

- Neo4j：`5.26`
- Redis：`7.4`

仓库内本地基础设施定义以 `infra/docker/docker-compose.dev.yml` 为准：

- Neo4j 镜像：`neo4j:5.26`
- Redis 镜像：`redis:7.4-alpine`

## 4. 最小环境变量

### 4.1 后端最小 live 环境变量

只有以下变量是 `real_data_launch` 验收所必需的：

```dotenv
PORT=4000
HOST=127.0.0.1
NEO4J_URI=bolt://127.0.0.1:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=<your-password>
NEO4J_DATABASE=neo4j
REDIS_URL=redis://127.0.0.1:6379
```

说明：

- `NEO4J_URI` 缺失时，后端会进入 `mock` 仓储边界。
- `REDIS_URL` 缺失或 Redis 不可达时，后端可降级启动，但这只能算 `prototype`，不能算 `real_data_launch` 通过。

### 4.2 本地 compose 推荐变量

如果使用仓库自带 compose，建议补齐：

```dotenv
COMPOSE_PROJECT_NAME=mag7-supply-chain-dev
NEO4J_HTTP_PORT=7474
NEO4J_BOLT_PORT=7687
REDIS_PORT=6379
CORS_ORIGIN=http://127.0.0.1:5174
```

## 5. 验收输入

### 5.1 仓库根目录

```text
/workspace/project/mag7-supply-chain
```

### 5.2 后端目录

```text
/workspace/project/mag7-supply-chain/backend
```

### 5.3 全量包

本轮推荐输入路径：

```text
/workspace/agents/evidence-collector/output/mag7-full-package/relations.jsonl
/workspace/agents/evidence-collector/output/mag7-full-package/evidence.jsonl
```

当前本机可见文件行数：

- `relations.jsonl`：`176`
- `evidence.jsonl`：`207`

如果外部运行器使用其它落盘路径，只需替换命令里的 `PACKAGE_DIR` 即可。

## 6. 通过门槛

### 6.1 `prototype` 通过门槛

满足以下任一组合即可：

1. 前端和后端可构建，后端 `GET /api/v1/health` 返回 `200`，即使 `status=degraded` 也允许。
2. 后端在 `mock` 或依赖降级模式下能返回结构化接口数据。

以下情况仍然只算 `prototype`，不能升级为 `real_data_launch`：

- `repositoryMode=mock`
- 导入命令输出 `source: "mock"`
- `health.status=degraded`
- `dependencies.neo4j.status != "up"`
- `dependencies.redis.status != "up"`
- 业务接口返回 `503 dependency_unavailable`

### 6.2 `real_data_launch` 通过门槛

以下条件必须全部同时满足：

1. `npm run import:normalized` 输出 `source: "neo4j"`。
2. 导入返回 `relationCount > 0`、`evidenceCount > 0`、`snapshotCount > 0`。
3. `GET /api/v1/health` 返回：
   - HTTP `200`
   - `status = "ok"`
   - `repositoryMode = "neo4j"`
   - `contracts.mockGraphBoundary = false`
   - `dependencies.neo4j.status = "up"`
   - `dependencies.redis.status = "up"`
4. 下列接口全部返回 HTTP `200`：
   - `/api/v1/companies/company:AAPL`
   - `/api/v1/companies/company:AAPL/overview`
   - `/api/v1/companies/search?q=amazon&limit=5`
   - `/api/v1/companies/suggest?q=tes&limit=5`
   - `/api/v1/graph/subgraph?...`
   - `/api/v1/graph/path?...`
   - `/api/v1/graph/stats?...`
   - `/api/v1/relations/<relationId>/evidence`
5. 需要带 `source` 的业务响应必须是 `source = "neo4j"`。
6. 不能把 in-memory `real-shape` 测试、mock 返回、degraded 健康状态表述成 live Neo4j/Redis 验收通过。

## 7. 推荐执行顺序

1. 安装依赖并构建 contracts / backend。
2. 拉起 `Neo4j 5.26` 与 `Redis 7.4`。
3. 运行全量包导入。
4. 启动后端。
5. 逐条执行 HTTP 验收命令。
6. 若所有命令满足第 6.2 节，才可把结论改成 `real_data_launch 通过`。

完整命令见同目录：

```text
infra/deployment/live-acceptance-commands.sh
```

## 8. 预期成功返回

以下字段是关键成功信号：

### 导入命令

必须出现：

```json
{
  "source": "neo4j"
}
```

并且：

- `relationCount > 0`
- `evidenceCount > 0`
- `snapshotCount > 0`

### `/api/v1/health`

必须同时满足：

```json
{
  "status": "ok",
  "repositoryMode": "neo4j",
  "contracts": {
    "mockGraphBoundary": false
  },
  "dependencies": {
    "neo4j": { "status": "up" },
    "redis": { "status": "up" }
  }
}
```

### `/api/v1/companies/company:AAPL`

必须至少包含：

- `item.id = "company:AAPL"`
- `source = "neo4j"`
- `item.activeSnapshotId` 非空

### `/api/v1/companies/company:AAPL/overview`

必须至少包含：

- `companyId = "company:AAPL"`
- `activeSnapshotId` 非空
- `totalRelations > 0`
- `source = "neo4j"`

### `/api/v1/companies/search?q=amazon&limit=5`

必须至少包含：

- `items` 中存在 `id = "company:AMZN"`
- `source = "neo4j"`

### `/api/v1/companies/suggest?q=tes&limit=5`

必须至少包含：

- `items` 中存在 `id = "company:TSLA"`
- `source = "neo4j"`

### `/api/v1/graph/subgraph?companyId=company:AAPL&depth=2&snapshot=published&includeEvidence=true`

必须至少包含：

- `snapshot.id` 非空
- `relations` 非空
- `relations[0].id` 非空

### `/api/v1/graph/path?sourceCompanyId=company:TSMC&targetCompanyId=company:AAPL&maxDepth=2&snapshot=published&includeEvidence=true`

必须至少包含：

- `relations[0].id = "rel:apple:tsmc:manufacturing:apple-silicon"`
- `snapshot.id` 非空

### `/api/v1/graph/stats?snapshot=published&companyId=company:AMZN`

必须至少包含：

- `source = "neo4j"`
- `relationCount > 0`

### `/api/v1/relations/rel:apple:tsmc:manufacturing:apple-silicon/evidence`

必须至少包含：

- `relationId = "rel:apple:tsmc:manufacturing:apple-silicon"`
- `total >= 1`
- `source = "neo4j"`

## 9. 常见失败分流

### 9.1 导入输出 `source: "mock"`

含义：

- 后端导入脚本没有连到真实 Neo4j。

优先排查：

1. `NEO4J_URI` 是否缺失。
2. `NEO4J_URI` 是否指向错误端口。
3. Neo4j 是否尚未 ready。

该情况结论：

- 只能算 `prototype`。
- `real_data_launch` 不通过。

### 9.2 导入或启动时报 `ECONNREFUSED 127.0.0.1:7687`

含义：

- Neo4j Bolt 未监听，或宿主机到容器端口未打通。

优先排查：

1. `docker compose ps`
2. `docker logs mag7-neo4j`
3. `docker exec -it mag7-neo4j cypher-shell -u <user> -p <password> -d system 'RETURN 1;'`

### 9.3 `/api/v1/health` 返回 `status=degraded`

分两种：

1. `dependencies.neo4j.status != "up"`
   - 图查询不是 live 可用状态，直接不通过。
2. `dependencies.redis.status != "up"`
   - 服务可能仍可监听并提供业务返回，但只算降级；`real_data_launch` 仍不通过。

### 9.4 业务接口返回 `503 dependency_unavailable`

含义：

- 服务已进入显式 Neo4j 模式，但真实图库依赖不可达。

优先排查：

1. Neo4j 健康状态
2. 导入是否真正完成
3. `NEO4J_DATABASE` 是否与导入写入库一致

### 9.5 业务接口返回 `404 company_not_found` 或 `relation_evidence_not_found`

含义：

- 导入成功但查询 ID 与当前包不一致，或导入并未完成。

优先排查：

1. 是否使用了本 runbook 指定的 `company:AAPL`、`company:AMZN`、`company:TSLA`、`company:TSMC`
2. 是否使用了 `rel:apple:tsmc:manufacturing:apple-silicon`
3. 是否意外导入了其它 snapshot 或空库

### 9.6 HTTP `200` 但 `source != "neo4j"`

含义：

- 返回来自 mock/in-memory，而不是真实图库。

该情况结论：

- 不算 live 验收通过。

## 10. 为什么当前本机无法执行 live 闭环

截至 `2026-06-14`，本机只验证到：

- Node.js 存在，版本为 `v22.22.3`

但以下能力均不存在：

- `docker`
- `docker-compose`
- `podman`
- `neo4j`
- `cypher-shell`
- `redis-server`
- `redis-cli`

这意味着：

1. 无法用 `infra/docker/docker-compose.dev.yml` 拉起 `Neo4j 5.26` 与 `Redis 7.4`。
2. 也没有本机等价数据库二进制可替代执行。
3. 因此无法在当前工作机上形成“真实导入写库 + 真实 HTTP 查询返回”的 live 闭环证据。

结论必须保持为：

- `prototype` 可发布
- `real_data_launch` blocked，直到外部运行器在具备容器/数据库运行能力的环境中按本 runbook 完成闭环

## 11. 建议交接物

向外部运行器或人工执行方交付以下文件即可：

1. `infra/deployment/live-acceptance-runbook.md`
2. `infra/deployment/live-acceptance-commands.sh`
3. 全量包目录：
   - `relations.jsonl`
   - `evidence.jsonl`

## 12. 执行后必须回传的结果

外部执行完成后，至少回传：

1. 导入命令完整输出
2. `/api/v1/health` 完整 JSON
3. 各业务接口关键响应片段
4. 若失败，提供失败命令、HTTP 状态码、错误正文、容器日志摘要

没有这些证据，不应把 `real_data_launch` 状态改成通过。

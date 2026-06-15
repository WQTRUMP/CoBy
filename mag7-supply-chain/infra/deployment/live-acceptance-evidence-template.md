# Mag7 live Neo4j/Redis 验收证据模板

## 1. 执行摘要

- 执行日期：
- 执行人：
- 执行环境：
- 服务模式：`docker` / `external`
- 结果结论：`通过` / `失败`
- 使用数据包：`snapshot:2026-06-15.full.13`
- 证据目录：

## 2. 前置条件

- Node 版本：
- npm 版本：
- jq 版本：
- Docker/Compose 版本：
- `relations.jsonl` 行数：
- `evidence.jsonl` 行数：

## 3. 执行命令

```bash
source infra/deployment/live-acceptance.env.example
bash infra/deployment/live-acceptance-commands.sh --services-mode <docker|external> --output-dir <your-output-dir>
```

如使用 external 模式，请补充实际 `NEO4J_URI` / `REDIS_URL`（可脱敏主机名或口令）：

```dotenv
NEO4J_URI=
REDIS_URL=
```

## 4. 导入结果

粘贴 `import-summary.json`：

```json
{}
```

需要至少满足：

- `source = "neo4j"`
- `relationCount > 0`
- `evidenceCount > 0`
- `snapshotCount > 0`

## 5. Health 结果

粘贴 `health.json`：

```json
{}
```

需要至少满足：

- `status = "ok"`
- `runtimeMode = "live"`
- `repositoryMode = "neo4j"`
- `dependencies.neo4j.status = "up"`
- `dependencies.redis.status = "up"`

## 6. 业务接口结果

逐项附关键 JSON 片段：

### `companies?isMag7=true&page=1&pageSize=5`

```json
{}
```

### `companies/company:AAPL`

```json
{}
```

### `companies/company:AAPL/overview`

```json
{}
```

### `companies/search?q=amazon&limit=5`

```json
{}
```

### `companies/suggest?q=tes&limit=5`

```json
{}
```

### `graph/subgraph`

```json
{}
```

### `graph/path`

```json
{}
```

### `graph/stats`

```json
{}
```

### `relations/.../evidence`

```json
{}
```

## 7. 失败时必交证据

- `backend-live.log`
- `frontend-preview.log` / `backend-preview.log`（若执行 preview 基线）
- `docker-compose-ps.txt`（docker 模式）
- `docker-logs/neo4j.log`（docker 模式）
- `docker-logs/redis.log`（docker 模式）
- 失败命令、HTTP 状态码、错误正文

## 8. 最终判定

- 是否满足 `real_data_launch` 通过门槛：
- 若未通过，唯一阻塞项：
- 下一步动作：

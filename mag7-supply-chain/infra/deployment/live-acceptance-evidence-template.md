# Mag7 full.17 live 验收证据模板

## 1. 执行摘要

- 执行日期：
- 执行人：
- 执行环境：
- 请求模式：`auto` / `docker` / `external`
- 实际模式：`docker` / `external` / `unavailable`
- 结果结论：`通过` / `失败`
- 使用数据包：`snapshot:2026-06-15.full.17`
- 证据目录：

## 2. 前置条件

- Node 版本：
- npm 版本：
- curl 版本：
- jq 版本：
- Docker/Compose 版本：
- package version：
- `relations.jsonl` 行数：
- `evidence.jsonl` 行数：

## 3. 执行命令

```bash
source infra/deployment/live-acceptance.env.example
bash infra/deployment/live-acceptance-commands.sh --mode auto --output-dir <your-output-dir>
```

如使用 external，请补充最小输入（可脱敏主机名和口令）：

```dotenv
GRAPH_RUNTIME_MODE=live
NEO4J_URI=
NEO4J_USERNAME=
NEO4J_PASSWORD=
NEO4J_DATABASE=
REDIS_URL=
```

## 4. preflight / mode-selection

粘贴 `preflight.json` 与 `mode-selection.json` 的关键字段：

```json
{}
```

需要说明：

- 是否命中 `snapshot:2026-06-15.full.17`
- 自动选择结果是 `docker` 还是 `external`
- 若失败，失败码是什么

## 5. 导入结果

粘贴 `import-summary.json` 或 `import-failure.json`：

```json
{}
```

通过门槛：

- `source = "neo4j"`
- `relationCount > 0`
- `evidenceCount > 0`
- `snapshotCount > 0`

## 6. Health 结果

粘贴 `http/health.json`：

```json
{}
```

通过门槛：

- `status = "ok"`
- `runtimeMode = "live"`
- `repositoryMode = "neo4j"`
- `dependencies.neo4j.status = "up"`
- `dependencies.redis.status = "up"`

## 7. HTTP smoke 结果

按顺序粘贴关键片段：

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

## 8. 失败时必交文件

- `result.json`
- `minimal-external-prerequisites.json`
- `preflight.json`
- `mode-selection.json`
- `bringup.json`
- `import-failure.json` 或 `logs/import.stderr.log`
- `logs/backend-live.log`
- `http/*.json` 中已产出的部分文件
- `docker/docker-compose-ps.txt`、`docker/neo4j.log`、`docker/redis.log`（若走 docker）

## 9. 最终判定

- `result.json.passed`：
- 是否满足 `real_data_launch` 通过门槛：
- 若未通过，唯一阻塞原因：
- `/opt/wanman/products.json` 状态（为空数组时只能写 `unknown:no_product_inventory`）：
- 下一步动作：

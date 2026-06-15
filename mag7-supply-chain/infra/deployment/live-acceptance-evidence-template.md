# Mag7 full.21 source=neo4j live 验收证据模板

## 1. 执行摘要

- 执行日期：
- 执行人：
- 执行环境：
- 请求模式：`auto` / `docker` / `external`
- 实际模式：`docker` / `external` / `unavailable`
- 导入模式：`published` / `all-candidates`
- 结果结论：`通过` / `失败`
- 唯一正式链：
  - `/workspace/agents/code-reviewer-6/output/full21-live-closure-formal-review-v2/full21-live-closure-formal-review-v2-report.md`
  - `/workspace/agents/api-tester-2/output/full21-live-closure-refresh/full21-live-closure-refresh-report.md`
- `authoritative snapshot`：`snapshot:2026-06-15.full.18`
- published：`332 relations / 444 evidence`
- all-candidates：`335 relations / 448 evidence`
- candidate-only：`3 relations / 4 evidence`
- 证据目录：

## 2. 前置条件

- Node 版本：
- npm 版本：
- curl 版本：
- jq 版本：
- Docker/Compose 版本：
- package shell snapshot：
- Cloudflare/域名阶段：
  - `未接入`
  - `仅预备记录`
  - `已接入最终路由`

## 3. 执行命令

```bash
source infra/deployment/live-acceptance.env.example
bash infra/deployment/live-acceptance-commands.sh --mode external --output-dir <your-output-dir>
```

如使用 external，请补充最小输入：

```dotenv
GRAPH_RUNTIME_MODE=live
NEO4J_URI=
NEO4J_USERNAME=
NEO4J_PASSWORD=
NEO4J_DATABASE=
REDIS_URL=
LIVE_IMPORT_MODE=all-candidates
EXPECTED_PACKAGE_SNAPSHOT=snapshot:2026-06-15.full.18
EXPECTED_RELATION_COUNT=332
EXPECTED_EVIDENCE_COUNT=444
EXPECTED_ALL_CANDIDATE_RELATION_COUNT=335
EXPECTED_ALL_CANDIDATE_EVIDENCE_COUNT=448
EXPECTED_CANDIDATE_ONLY_RELATION_COUNT=3
EXPECTED_CANDIDATE_ONLY_EVIDENCE_COUNT=4
PACKAGE_SHELL_SNAPSHOT=snapshot:2026-06-15.full.21-tail-closure-candidate
```

## 4. preflight / mode-selection

粘贴 `preflight.json` 与 `mode-selection.json` 的关键字段：

```json
{}
```

必须说明：

- 是否命中 `snapshot:2026-06-15.full.18`
- `published=332/444`
- `all-candidates=335/448`
- `candidate-only=3/4`
- 自动选择结果是 `docker` 还是 `external`
- 若失败，失败码是什么

## 5. 导入结果

粘贴 `import-summary.json` 或 `import-failure.json`：

```json
{}
```

通过门槛：

- `source = "neo4j"`
- `liveImport.mode = "all-candidates"`（若特意只跑 published，必须显式解释）
- `liveImport.authoritativeSnapshotId = "snapshot:2026-06-15.full.18"`
- `liveImport.expectedRelationCount = 335`
- `liveImport.expectedEvidenceCount = 448`
- `liveImport.candidateOnlyRelationCount = 3`
- `liveImport.candidateOnlyEvidenceCount = 4`

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

## 7. published HTTP smoke 结果

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

### `graph/subgraph?snapshot=published`

```json
{}
```

### `graph/path?snapshot=published`

```json
{}
```

### `graph/stats?snapshot=published`

```json
{}
```

### `relations/rel:apple:tsmc:manufacturing:apple-silicon/evidence`

```json
{}
```

## 8. candidate shell 隔离校验

### `graph/subgraph?snapshot=snapshot:2026-06-15.full.21-tail-closure-candidate`

```json
{}
```

### `relations/rel:amazon:astera-labs:component_supply:amzn-r18-12-procurement_candidate-smart_fabric_switch/evidence`

```json
{}
```

必须说明：

- published `subgraph/path` 中未混入 candidate shell relation
- candidate shell relation 只在显式 candidate snapshot 或 direct relation evidence 校验中出现
- 未把 `335/448` 或 `3/4` 写成 published

## 9. Cloudflare / 域名状态

- 使用同源 `/api` 代理，还是 `api.<domain>` 分域：
- 若已切 Cloudflare 路由，切换时间：
- 最终域名 smoke 是否复跑：
- 若未复跑，原因：

## 10. 失败时必交文件

- `result.json`
- `minimal-external-prerequisites.json`
- `preflight.json`
- `mode-selection.json`
- `bringup.json`
- `import-failure.json` 或 `logs/import.stderr.log`
- `logs/backend-live.log`
- `http/*.json` 中已产出的部分文件
- `docker/docker-compose-ps.txt`、`docker/neo4j.log`、`docker/redis.log`（若走 docker）

## 11. 最终判定

- `result.json.passed`：
- 是否满足 `source=neo4j` 正向闭环门槛：
- 若未通过，唯一阻塞原因：
- 是否已接入 Cloudflare 最终路由：
- `/opt/wanman/products.json` 状态（为空数组时只能写 `unknown:no_product_inventory`）：
- 下一步动作：

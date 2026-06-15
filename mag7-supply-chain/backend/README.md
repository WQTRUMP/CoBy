# Mag7 Backend Skeleton

后端骨架提供以下能力：

- `Fastify + TypeScript` REST API 基础服务
- Neo4j / Redis 连接抽象与健康检查
- `SupplyRelation + Evidence` 合同 schema
- 标准化入库 schema 边界（为统一数据包任务预留）
- `GET /api/v1/health` 健康检查
- `GET /api/v1/companies` 公司列表
- `GET /api/v1/companies/search` 公司搜索
- `GET /api/v1/companies/suggest` 公司建议
- `GET /api/v1/companies/:companyId` 公司详情
- `GET /api/v1/companies/:companyId/overview` 公司聚合概览
- `GET /api/v1/graph/subgraph` 子图查询
- `GET /api/v1/graph/path` 公司路径查询
- `GET /api/v1/graph/stats` 图谱统计
- `GET /api/v1/relations/:relationId/evidence` 关系证据列表
- `POST /api/v1/imports/relations` 数据导入占位接口
- `POST /api/v1/imports/normalized-package` 标准化 JSONL 导入入口
- `GET /api/v1/schema/import-relations` 标准化入库字段说明

当前已验证运行时口径：

- Node：`v22.22.3`
- 源码入口：`backend/src/server.ts`
- 构建产物入口：`backend/dist/backend/src/server.js`
- 构建命令：`npm run build`
- 启动命令：`npm start`
- 健康检查：`GET /api/v1/health`

## 快速启动

```bash
cd /workspace/project/mag7-supply-chain/backend
npm install
cp .env.example .env
npm run dev
```

默认地址：

```text
http://127.0.0.1:4000
```

所需环境变量：

```dotenv
PORT=4000
HOST=127.0.0.1
CORS_ORIGIN=http://127.0.0.1:5174
GRAPH_RUNTIME_MODE=live
NEO4J_URI=bolt://127.0.0.1:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=mag7-dev-password
NEO4J_DATABASE=neo4j
REDIS_URL=redis://127.0.0.1:6379
```

## 运行模式边界

后端现在通过显式 `GRAPH_RUNTIME_MODE` 区分两类运行语义：

- `GRAPH_RUNTIME_MODE=live`（默认，验收/集成模式）
  - 不再允许静默回退 `MockGraphRepository`
  - 若 `NEO4J_URI` 缺失或 Neo4j 不可达，`/api/v1/health` 会返回 `runtimeMode=live`、`repositoryMode=neo4j`、依赖状态 `not_configured/down`
  - 若 live 模式下访问业务接口且 Neo4j 不可用，接口返回结构化 `503 dependency_unavailable`
  - 若 `REDIS_URL` 缺失或 Redis 不可达，服务仍可启动且 health 会明确 `required: true`；但业务接口与 `POST /api/v1/imports/normalized-package` 同样返回结构化 `503 dependency_unavailable`，不能再伪装成 `source=mock` 成功
- `GRAPH_RUNTIME_MODE=prototype`
  - 仅用于本地演示/原型，允许未配置 Neo4j 时回退内置 mock 图谱
  - health 会返回 `repositoryMode=mock`、`contracts.mockGraphBoundary=true`
  - Redis 默认为可选，未配置时仅禁用缓存

这只意味着 `prototype` 可用于演示，不意味着 `real_data_launch` 已通过。正式验收、preview/default 联调和上线前 smoke test 都应使用默认 `live` 模式。

## 本地 Prototype 启动

如果只是演示前端交互、暂时不接真实数据源，可显式启用原型模式：

```bash
GRAPH_RUNTIME_MODE=prototype npm run dev
```

此时如果未配置 `NEO4J_URI` / `REDIS_URL`：

- 图查询会回退到内置 mock 数据
- 健康检查会返回 `degraded`
- 导入接口会完成文件与 schema 校验，但不会写入真实 Neo4j

## 本地 Live/验收启动

默认就是 live 模式，也可以显式指定：

```bash
GRAPH_RUNTIME_MODE=live npm run dev
```

建议在启动前确认：

```bash
export GRAPH_RUNTIME_MODE=live
export NEO4J_URI=bolt://127.0.0.1:7687
export REDIS_URL=redis://127.0.0.1:6379
npm run dev
```

如果此模式下缺失 `NEO4J_URI`、Neo4j 不可达、或 Redis 缺失/不可达：

- `/api/v1/health` 仍返回 JSON，但会明确暴露依赖缺口，不再伪装为 mock 可用态
- `companies/detail/overview/search/suggest/subgraph/path/stats/evidence` 与 `POST /api/v1/imports/normalized-package` 都会返回 `503 dependency_unavailable`
- `graph/stats` 等缓存键会按 repository source 隔离，避免 prototype/mock 缓存串入 live

## 关键接口

```bash
curl http://127.0.0.1:4000/api/v1/health
curl "http://127.0.0.1:4000/api/v1/companies?q=app"
curl "http://127.0.0.1:4000/api/v1/companies/search?q=amazon&limit=5"
curl "http://127.0.0.1:4000/api/v1/companies/suggest?q=tes&limit=5"
curl "http://127.0.0.1:4000/api/v1/companies/company:AAPL"
curl "http://127.0.0.1:4000/api/v1/companies/company:AAPL/overview"
curl "http://127.0.0.1:4000/api/v1/graph/subgraph?companyId=company:AAPL&depth=2&includeEvidence=true"
curl "http://127.0.0.1:4000/api/v1/graph/path?sourceCompanyId=company:TSMC&targetCompanyId=company:AAPL&maxDepth=2&includeEvidence=true"
curl "http://127.0.0.1:4000/api/v1/graph/stats?snapshot=published&companyId=company:AMZN"
curl "http://127.0.0.1:4000/api/v1/relations/rel:apple:tsmc:manufacturing:apple-silicon/evidence"
curl http://127.0.0.1:4000/api/v1/schema/import-relations
```

导入占位：

```bash
curl -X POST http://127.0.0.1:4000/api/v1/imports/relations \
  -H "content-type: application/json" \
  -d @examples/import-relations.json
```

标准化 JSONL 导入：

```bash
npm run import:normalized -- \
  --relations /workspace/agents/evidence-collector/output/mag7-normalized-relations-sample.jsonl \
  --evidence /workspace/agents/evidence-collector/output/mag7-normalized-evidence-sample.jsonl
```

全量 Mag7 发布包导入：

```bash
npm run import:full-package:live -- \
  --manifest /workspace/agents/evidence-collector/output/mag7-full-package/mag7-full-package-manifest.json \
  --mode published
```

当前顶层正式包已经重建到 `full20-wave5` candidate shell，live 导入必须按 manifest 口径执行，而不是手写旧 JSONL 路径或沿用旧计数：

- `package snapshot shell`：`snapshot:2026-06-15.full.20-wave5-candidate`
- `authoritative snapshot`：`snapshot:2026-06-15.full.18`
- `published view`：`332 relations / 444 evidence`
- `all-candidates view`：`341 relations / 459 evidence`
- `candidate-only delta`：`9 relations / 15 evidence`

如果需要导入候选全集用于审计或离线对比，可显式切换：

```bash
npm run import:full-package:live -- \
  --manifest /workspace/agents/evidence-collector/output/mag7-full-package/mag7-full-package-manifest.json \
  --mode all-candidates
```

或通过 HTTP 触发：

```bash
curl -X POST http://127.0.0.1:4000/api/v1/imports/normalized-package \
  -H "content-type: application/json" \
  -d '{
    "requestId": "mag7-sample-import",
    "relationFile": "/workspace/agents/evidence-collector/output/mag7-normalized-relations-sample.jsonl",
    "evidenceFile": "/workspace/agents/evidence-collector/output/mag7-normalized-evidence-sample.jsonl"
  }'
```

CLI 在 `--manifest` 模式下会先校验 JSONL 实际行数是否与 manifest 一致；如果不是 `332/444`、`341/459`、`9/15` 这组正式口径，导入会直接失败，避免误把旧 `327/435` 或 `350/476` 数据当成当前 live 基线。

## 数据库初始化

Neo4j 约束与索引位于：

- `../infra/neo4j/constraints.cypher`
- `../infra/neo4j/indexes.cypher`

导入前建议先执行这些脚本，然后再运行标准化 JSONL 导入。

## 标准化入库字段

`POST /api/v1/imports/relations` 当前对后续统一数据包保留以下字段：

- `company`
- `supplier`
- `tier`
- `relationship_type`
- `product_scope`
- `evidence_date`
- `evidence_excerpt`
- `source_url`
- `confidence_label`
- `confidence_score`
- `notes`

可选补充字段包括 `source_type`、`source_title`、`source_publisher`、`evidence_page_ref`、`source_domain`、`parser_version`、`reliability_tier`、`depth_from_mag7`、`snapshot_id`。

这一层是 ingestion contract，不复用前端原型字段，也不要求调用方提供 Neo4j 内部节点 ID。

当前真实样例已经对齐：

- Apple
- Microsoft
- Alphabet
- Meta
- Amazon
- NVIDIA
- Tesla

## 真实模式说明

- Neo4j 真实模式的 `subgraph`/`path` 查询现在按 `snapshot` 参数过滤；`snapshot=published` 只返回 `Snapshot.status = published` 的关系。
- 真实模式下，`getSubgraph()` 在查询无结果时不再回退到 Tesla mock 图；会返回空图或仅包含根公司节点的空结果，避免多版本或 mock 污染。
- `search` / `suggest` / `subgraph` / `path` / `stats` 均带 Redis 缓存键，便于热查询复用。

## 测试

```bash
npm test
```

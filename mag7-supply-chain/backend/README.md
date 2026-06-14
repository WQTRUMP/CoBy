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

## 本地无数据库模式

如果未配置 `NEO4J_URI` 或 Neo4j / Redis 未启动，服务仍可运行：

- 图查询自动回退到内置 mock 数据
- 健康检查会返回 `degraded`，并明确指出哪个依赖未配置或不可达
- 健康检查同时返回当前 import contract 版本与 mock 边界状态
- 导入接口会完成文件与 schema 校验，但不会写入真实 Neo4j

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
npm run import:normalized -- \
  --relations /workspace/agents/evidence-collector/output/mag7-full-package/relations.jsonl \
  --evidence /workspace/agents/evidence-collector/output/mag7-full-package/evidence.jsonl
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

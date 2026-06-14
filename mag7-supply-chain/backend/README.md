# Mag7 Backend Skeleton

后端骨架提供以下能力：

- `Fastify + TypeScript` REST API 基础服务
- Neo4j / Redis 连接抽象与健康检查
- `SupplyRelation + Evidence` 合同 schema
- `GET /api/v1/health` 健康检查
- `GET /api/v1/companies` 公司列表
- `GET /api/v1/graph/subgraph` 子图查询
- `POST /api/v1/imports/relations` 数据导入占位接口

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
- 导入接口只做 schema 校验和回执，不写入数据库

## 关键接口

```bash
curl http://127.0.0.1:4000/api/v1/health
curl "http://127.0.0.1:4000/api/v1/companies?q=app"
curl "http://127.0.0.1:4000/api/v1/graph/subgraph?companyId=company:AAPL&depth=2&includeEvidence=true"
```

导入占位：

```bash
curl -X POST http://127.0.0.1:4000/api/v1/imports/relations \
  -H "content-type: application/json" \
  -d @examples/import-relations.json
```

## 数据库初始化

Neo4j 约束与索引位于：

- `../infra/neo4j/constraints.cypher`
- `../infra/neo4j/indexes.cypher`

导入前建议先执行这些脚本。

## 测试

```bash
npm test
```

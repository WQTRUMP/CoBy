> `superseded`：本手册仅保留 full.18 live 外部验收审计用途，不再代表当前最终发布入口或 human 决策口径。
> 当前正式入口请改用：
> 1. `/workspace/project/mag7-supply-chain/infra/deployment/deployment-manifest.json`
> 2. `/workspace/project/mag7-supply-chain/infra/deployment/products-candidate.json`
> 3. `/workspace/agents/code-reviewer-6/output/full19-live-e2e-formal-review-v3/full19-live-e2e-formal-review-v3-report.md`
> 4. `/workspace/agents/devops/output/final-release-index-post-audit-v2/final-release-index-post-audit-v2-report.md`
> 本文件中的 full.18 历史过程只保留审计用途；当前正式入口已切换为 full20-wave5 收口链与 full19 live 终审链。
> 当前正式边界是 `authoritative snapshot=snapshot:2026-06-15.full.18`、`published=332/444`、`all-candidates=341/459`、`candidate-only=9/15`。
> `real_data_launch` 技术阻塞已解除，当前状态是 `ready_for_human_decision`；任何 human/Cloudflare 审批都只能覆盖 published `332/444`。

# Mag7 full.18 live 外部验收最终执行手册

## 1. 结论边界

- 唯一正式链：`full20-wave5 formal review v2 + full20-wave5 formal refresh + full19 live e2e formal review v3`
- authoritative snapshot：`snapshot:2026-06-15.full.18`
- published：`332 relations / 444 evidence`
- all-candidates：`341 relations / 459 evidence`
- candidate-only：`9 relations / 15 evidence`
- 当前 readiness：`prototype=conditional_go`，`real_data_launch=ready_for_human_decision`

本手册的目标不是宣称已上线，而是提供一套可直接交给 human 或外部运行器执行的 provider-neutral live acceptance 包。当前正式复审已确认 `source=neo4j` 的真实导入与 HTTP 回读闭环成立；此后任何重新验收都必须维持 `332/444` published 边界，且只能作为 human 部署决策与最终环境复核证据，不能再把阻塞状态写回 `blocked`。

## 2. 权威输入与排除项

最终执行包只允许以下 authoritative inputs：

1. `/workspace/agents/code-reviewer/output/full20-wave5-formal-review-v2/`
2. `/workspace/agents/api-tester-2/output/full20-wave5-formal-refresh/`
3. `/workspace/agents/dev/output/full20-wave5-live-import-closure-report.md`
4. `/workspace/agents/code-reviewer-6/output/full19-live-e2e-formal-review-v3/`

以下任务或草稿不得再作为本手册的正式输入：

1. `770fdf5c-ede6-40bb-a6f8-17bc28d90448`
2. `1fcbf8ac-8a1e-434b-9ac5-60f86374f83c`
3. `c1be4b86-a800-4d45-977e-86ddca5fc378`
4. `69ab6247-3cc2-4c8a-b2b7-45294225be1b`
5. `e14b3746-88f1-4c2c-921c-0e88e63db23c`

`full17-live-unblock-*` 文件只保留审计用途，已被本手册与 `full18-live-acceptance-final-checklist.json` supersede。

## 3. 最小外部前置

执行 live acceptance 前，最少需要：

1. `Node.js v22.22.3`、`npm`、`curl`、`jq`
2. 可达的 Neo4j `5.26` 兼容实例
3. 可达的 Redis `7.4` 兼容实例
4. 一个可临时托管 backend 的 Node 运行器
5. `/workspace/agents/evidence-collector/output/mag7-full-package` 顶层正式包
6. 待接入的 Cloudflare zone 与域名决策，但在验收通过前不得切正式流量

如果实例、白名单、TLS、账单或域名由 human/控制面掌管，先由 human 完成。代理不得直接使用 Cloudflare 或提供商凭据。

## 4. Provider-Neutral 绑定规则

- Neo4j 可使用 `bolt://`、`neo4j://`、`neo4j+s://`
- Redis 可使用 `redis://`、`rediss://`
- `NEO4J_DATABASE` 建议使用独立验收库
- `REDIS_URL` 建议使用独立实例或独立 DB index

隔离原则：

1. 首次验收优先使用隔离的 Neo4j 数据库和隔离的 Redis
2. 不得在共享生产图数据库上进行首次导入验收
3. 不得以 prototype、mock、in-memory 结果替代 live 回读证据

## 5. Cloudflare / 域名接入顺序

顺序不能颠倒，必须按下面执行：

1. human 先批准 Cloudflare 连接、zone、域名方案和 provider-neutral 依赖准备，但此时不切正式流量
2. 先完成托管 Neo4j、Redis、backend 运行器准备，并在临时地址或本地端口上跑 live acceptance
3. 只有当 `result.json.passed=true` 后，才允许接入 Cloudflare DNS、证书、同源 `/api` 代理或 `api.<domain>`
4. 若采用分域，前端补 `VITE_GRAPH_API_BASE_URL`，后端补 `CORS_ORIGIN`
5. 在最终域名或最终 `/api` 路由上至少重跑一次 `health + detail + search + path + evidence` smoke

禁止先接正式域名、再补做写库验收。

## 6. 必填环境变量

直接使用 [`live-acceptance.env.example`](/workspace/project/mag7-supply-chain/infra/deployment/live-acceptance.env.example) 作为模板，至少填完：

```dotenv
GRAPH_RUNTIME_MODE=live
NEO4J_URI=<provider-neutral-neo4j-uri>
NEO4J_USERNAME=<neo4j-user>
NEO4J_PASSWORD=<neo4j-password>
NEO4J_DATABASE=<validation-database>
REDIS_URL=<provider-neutral-redis-url>
```

建议同时确认：

```dotenv
EXPECTED_PACKAGE_SNAPSHOT=snapshot:2026-06-15.full.18
EXPECTED_RELATION_COUNT=332
EXPECTED_EVIDENCE_COUNT=444
PORT=4000
HOST=127.0.0.1
API_BASE=http://127.0.0.1:4000
VITE_GRAPH_API_BASE_URL=
CORS_ORIGIN=
```

## 7. 执行命令

### 7.1 preflight + import + HTTP smoke

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
  --output-dir "${VALIDATION_OUTPUT_DIR:-/tmp/mag7-live-acceptance-full18}"
```

脚本会自动完成：

1. `snapshot/full.18 published=332/444` preflight
2. external 或 docker 运行时选择
3. `npm run build` 与 `npm run import:normalized`
4. `GET /api/v1/health`
5. `detail / overview / search / suggest / subgraph / path / stats / evidence` smoke
6. 输出 `result.json`、`import-summary.json`、`http/*.json`、`logs/*`

### 7.2 最终域名或 Cloudflare 路由复跑

若 `API_BASE` 或最终域名已经改成 Cloudflare 路由后的地址，至少再执行：

```bash
curl -sS "$API_BASE/api/v1/health" | jq .
curl -sS "$API_BASE/api/v1/companies/company:AAPL" | jq '.source, .item.id'
curl -sS "$API_BASE/api/v1/companies/search?q=amazon&limit=5" | jq '.source, .items[0].id'
curl -sS "$API_BASE/api/v1/graph/path?sourceCompanyId=company:TSMC&targetCompanyId=company:AAPL&maxDepth=2&snapshot=published&includeEvidence=true" | jq '.relations[0].id'
curl -sS "$API_BASE/api/v1/relations/rel:apple:tsmc:manufacturing:apple-silicon/evidence" | jq '.source, .relationId, .total'
```

## 8. 唯一成功判据

只有同时满足以下条件，才允许把结论写成“可提交或维持 `ready_for_human_decision` 的正式部署证据”：

1. `result.json.passed = true`
2. `import-summary.json`
   - `source = "neo4j"`
   - `relationCount > 0`
   - `evidenceCount > 0`
   - `snapshotCount > 0`
3. `http/health.json`
   - `status = "ok"`
   - `runtimeMode = "live"`
   - `repositoryMode = "neo4j"`
   - `contracts.mockGraphBoundary = false`
   - `dependencies.neo4j.status = "up"`
   - `dependencies.redis.status = "up"`
4. `http/detail.json`、`overview.json`、`search.json`、`suggest.json`、`subgraph.json`、`path.json`、`stats.json`、`evidence.json` 全部通过
5. 所有带 `source` 的业务响应都必须是 `neo4j`，不得出现 `mock`

`degraded`、`503 dependency_unavailable`、prototype 模式、或全量包内存测试都不能当成通过；`all-candidates 341/459` 也不能当成已批准发布范围。

## 9. 失败分流

- `external_env_incomplete`
  - 必填 env 未填完
- `neo4j_unreachable`
  - Neo4j 主机或端口不可达，先修网络、白名单、TLS 或实例状态
- `redis_unreachable`
  - Redis 主机或端口不可达，先修网络或实例状态
- `snapshot_mismatch` / `relation_count_mismatch` / `evidence_count_mismatch`
  - 运行器拿错包或不是 final full.18 published 数据
- `import_command_failed`
  - live 写库失败，查看 `import-failure.json` 和 `logs/import.stderr.log`
- `health_not_ok`
  - 依赖仍未全部 ready，不能继续 Cloudflare 路由切换
- `*_validation_failed`
  - 某个业务接口返回不满足最终锚点

## 10. 回滚与清理

如果任一步失败，严格按下列顺序处理：

1. 停止临时 backend 进程
2. 保留整个输出目录作为失败证据
3. 清理或销毁隔离的 Neo4j 验收库
4. 清理隔离的 Redis 实例或独立 DB index
5. 如果只创建了 Cloudflare 预备记录但尚未切正式流量，可撤销这些预备记录
6. 不得把失败回滚写成“切回 prototype/mock 即完成”

## 11. 24 小时内执行清单

批准后 24 小时内建议按下面窗口推进：

1. `0-2h`
   - 确认 Cloudflare zone、域名策略、托管 Neo4j/Redis、backend 运行器已就绪
   - 明确是同源 `/api` 代理还是分域 `api.<domain>`
2. `2-6h`
   - 填写 env
   - 执行 `live-acceptance-commands.sh`
   - 汇总 `result.json`、`import-summary.json`、`http/*.json`
3. `6-12h`
   - 仅在 `result.json.passed=true` 后接入 Cloudflare DNS、证书、代理路由
   - 在最终路由重跑最小 smoke
4. `12-24h`
   - 复查 `health/detail/search/path/evidence`
   - 若 `/opt/wanman/products.json` 仍未正式接入，则继续维持 `unknown:no_product_inventory`

## 12. 对外交付物

本执行包最终至少回传：

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
13. `infra/deployment/full18-live-acceptance-final-checklist.json`
14. `infra/deployment/full18-live-acceptance-superseded-map.json`

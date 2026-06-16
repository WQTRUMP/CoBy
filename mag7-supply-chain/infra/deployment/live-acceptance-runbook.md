# Mag7 full.21 live 验收执行手册

> 推荐先走 [`live-positive-capture.sh`](/workspace/project/mag7-supply-chain/infra/deployment/live-positive-capture.sh) 与 [`live-positive-capture-runbook.md`](/workspace/project/mag7-supply-chain/infra/deployment/live-positive-capture-runbook.md)。
> 本文档保留为底层执行器 [`live-acceptance-commands.sh`](/workspace/project/mag7-supply-chain/infra/deployment/live-acceptance-commands.sh) 的详细说明。

> 当前 live 验收唯一机器输入是 [`live-acceptance-manifest.json`](/workspace/project/mag7-supply-chain/infra/deployment/live-acceptance-manifest.json)。
> 正式边界固定为 `authoritative snapshot=snapshot:2026-06-15.full.18`、`published=332/444`、`all-candidates=334/447`、`candidate-only=2/3`。
> `all-candidates` 与 `candidate-only` 只代表 candidate shell 审计边界，**不得写成 published**。
> 旧 `312/410`、`327/435`、`341/459`、`350/476`、`9/15`、`23/41` 只保留历史审计语义，不能再作为默认值或执行口径。

## 1. 目标

本手册只解决一件事：在可达 Neo4j/Redis 的前提下，复用仓库现有脚本拿到 **`source=neo4j` 的正向闭环证据**，并同时证明：

1. published 查询面仍然固定在 `332/444`
2. candidate shell 只保留在 `334/447` / `2/3` 审计边界
3. candidate shell 不会被误写成 published

## 2. 唯一正式输入

执行 live 验收时，只允许使用以下正式输入：

1. [`live-acceptance-manifest.json`](/workspace/project/mag7-supply-chain/infra/deployment/live-acceptance-manifest.json)
2. `/workspace/agents/code-reviewer-6/output/full21-live-closure-formal-review-v2/full21-live-closure-formal-review-v2-report.md`
3. `/workspace/agents/api-tester-2/output/full21-live-closure-refresh/full21-live-closure-refresh-report.md`
4. `/workspace/agents/evidence-collector/output/mag7-full-package/mag7-full-package-manifest.json`

禁止再手写旧 JSONL 路径、旧计数或旧 candidate shell 默认值。

## 3. 最小外部前置

最少需要：

1. `Node.js v22.22.3`、`npm`、`curl`、`jq`
2. 可达的 Neo4j `5.26` 兼容实例
3. 可达的 Redis `7.4` 兼容实例
4. `GRAPH_RUNTIME_MODE=live`、`NEO4J_*`、`REDIS_URL` 这组 live 环境变量
5. `/workspace/agents/evidence-collector/output/mag7-full-package/mag7-full-package-manifest.json`

Cloudflare、域名、同源 `/api` 代理或对外临时托管 Node API 运行器都不是本次 `source=neo4j` 正向闭环的必需前置；它们只能作为闭环通过后的部署或同源联调可选后续步骤。
如果凭据、白名单或 TLS 参数由 human/控制面掌管，先由 human 完成准备。代理不得直接保存或传播这些明文凭据。

## 4. 外部凭据注入规则

必须通过以下方式之一注入外部 Neo4j/Redis 凭据：

1. CI/CD Secret
2. shell 环境变量
3. 受控密钥管理器导出的临时环境

禁止事项：

1. 把 `NEO4J_PASSWORD`、`REDIS_URL` 等明文写入仓库文件
2. 把凭据写进 artifact、Wanman 消息或中文报告正文
3. 用 prototype/mock 替代 live 依赖缺口

## 5. 推荐命令模板

推荐先加载样例环境，再走中文预检/取证入口；若需要底层调试，再直接调用 `live-acceptance-commands.sh`。

推荐入口：

```bash
cd /workspace/project/mag7-supply-chain
set -a
source infra/deployment/live-acceptance.env.example
export NEO4J_URI='bolt://<reachable-neo4j-host>:7687'
export NEO4J_USERNAME='<neo4j-user>'
export NEO4J_PASSWORD='<neo4j-password>'
export NEO4J_DATABASE='neo4j'
export REDIS_URL='redis://<reachable-redis-host>:6379'
set +a

bash infra/deployment/live-positive-capture.sh \
  --mode external \
  --output-dir "${VALIDATION_OUTPUT_DIR:-/tmp/mag7-live-positive-capture-full21}"
```

底层调试入口：

```bash
cd /workspace/project/mag7-supply-chain
set -a
source infra/deployment/live-acceptance.env.example
export NEO4J_URI='bolt://<reachable-neo4j-host>:7687'
export NEO4J_USERNAME='<neo4j-user>'
export NEO4J_PASSWORD='<neo4j-password>'
export NEO4J_DATABASE='neo4j'
export REDIS_URL='redis://<reachable-redis-host>:6379'
set +a

bash infra/deployment/live-acceptance-commands.sh \
  --mode external \
  --output-dir "${VALIDATION_OUTPUT_DIR:-/tmp/mag7-live-acceptance-full21}"
```

默认导入模式已经固定为：

```bash
npm --prefix backend run import:full-package:live -- \
  --manifest /workspace/agents/evidence-collector/output/mag7-full-package/mag7-full-package-manifest.json \
  --mode all-candidates
```

理由：

1. `all-candidates` 导入可以同时验证 published `332/444` 与 candidate shell `2/3`
2. published 端点仍必须只暴露 `332/444`
3. candidate shell relation 只能在显式 candidate snapshot 或 direct relation evidence 校验中出现

## 6. 验收步骤

脚本会自动完成以下流程：

1. 读取 `live-acceptance-manifest.json`
2. 校验 `authoritative snapshot=full.18`
3. 校验 package manifest 计数：
   - published `332/444`
   - all-candidates `334/447`
   - candidate-only `2/3`
4. 根据 `--mode` 选择 external 或 docker
5. 执行 `npm run build`
6. 执行 manifest 驱动导入
7. 校验 `import-summary.json` 为 `source=neo4j`
8. 校验 `GET /api/v1/health`
9. 校验 published `detail / overview / search / suggest / subgraph / path / stats / evidence`
10. 校验 candidate shell 隔离：
    - published 查询面不混入 candidate-only relation
    - candidate relation 只在显式 candidate snapshot 或 direct relation evidence 中命中

## 7. 唯一成功判据

只有同时满足以下条件，才算通过：

1. `result.json.passed = true`
2. `import-summary.json`
   - `source = "neo4j"`
   - `liveImport.authoritativeSnapshotId = "snapshot:2026-06-15.full.18"`
   - `liveImport.expectedRelationCount = 335`
   - `liveImport.expectedEvidenceCount = 448`
   - `liveImport.candidateOnlyRelationCount = 3`
   - `liveImport.candidateOnlyEvidenceCount = 4`
3. `http/health.json`
   - `status = "ok"`
   - `runtimeMode = "live"`
   - `repositoryMode = "neo4j"`
   - `dependencies.neo4j.status = "up"`
   - `dependencies.redis.status = "up"`
4. published `detail / overview / search / suggest / subgraph / path / stats / evidence` 全部 `source=neo4j`
5. published `subgraph/path` 不包含 candidate-only relation
6. candidate shell relation 只在显式 candidate snapshot 或 direct relation evidence 校验中出现

以下情况都算失败：

1. `source=mock`
2. `status=degraded`
3. `503 dependency_unavailable`
4. 把 `334/447` 或 `2/3` 写成 published
5. 把 candidate shell relation 混进 published 查询面

## 8. 失败分流

- `external_env_incomplete`
  - 外部环境变量未完整注入
- `package_counts_mismatch`
  - package manifest 计数不是 `332/444`、`334/447`、`2/3`
- `snapshot_mismatch`
  - authoritative snapshot 不是 `snapshot:2026-06-15.full.18`
- `import_not_live_neo4j`
  - 导入成功退出但不是 `source=neo4j`
- `published_candidate_leak_detected`
  - published 查询面出现 candidate-only relation
- `candidate_shell_validation_failed`
  - candidate relation 在显式 snapshot / evidence 校验中未命中

## 9. 失败回滚

任一步失败时，严格按以下顺序回滚：

1. 停止 backend 进程
2. 保留整个 `output-dir`
3. 清理隔离的 Neo4j database
4. 清理隔离的 Redis keyspace
5. 如果你在闭环通过后额外做过可选的同源代理、临时域名或 Cloudflare 预备记录，撤回这些可选预备记录
6. 不得把失败结论写成“切回 prototype/mock 即恢复”

## 10. 交付物

一次可签字的复验至少应回传：

1. `result.json`
2. `import-summary.json`
3. `preflight.json`
4. `mode-selection.json`
5. `bringup.json`
6. `http/health.json`
7. `http/detail.json`
8. `http/overview.json`
9. `http/search.json`
10. `http/suggest.json`
11. `http/subgraph.json`
12. `http/path.json`
13. `http/stats.json`
14. `http/evidence.json`
15. `http/candidate-subgraph.json`
16. `http/candidate-evidence.json`
17. `logs/backend-live.log`

推荐同时附上 [`live-acceptance-evidence-template.md`](/workspace/project/mag7-supply-chain/infra/deployment/live-acceptance-evidence-template.md) 的完整填写版。

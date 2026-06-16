# Mag7 full.21 正向闭环中文预检/取证入口

> 推荐入口：[`live-positive-capture.sh`](/workspace/project/mag7-supply-chain/infra/deployment/live-positive-capture.sh)
>
> 底层执行器仍是 [`live-acceptance-commands.sh`](/workspace/project/mag7-supply-chain/infra/deployment/live-acceptance-commands.sh)，但人类或外部运行器应优先走本手册对应的中文入口。
>
> 当前唯一正式口径固定为：
> - `authoritative snapshot=snapshot:2026-06-15.full.18`
> - `published=332/444`
> - `all-candidates=334/447`
> - `candidate-only=2/3`

## 1. 入口职责

`live-positive-capture.sh` 只做四件事：

1. 先落盘不含密钥明文的环境变量预检摘要
2. 调用现有 full.21 live 执行包完成真实导入与 HTTP 样本采集
3. 无论成功失败，都输出中文摘要、结构化索引与日志文件
4. 保证 candidate shell 仍只写 `334/447`、`2/3`，绝不误写成 published

## 2. 典型用法

### external 模式

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
  --output-dir /tmp/mag7-live-positive-capture
```

### docker 模式

```bash
cd /workspace/project/mag7-supply-chain
bash infra/deployment/live-positive-capture.sh \
  --mode docker \
  --output-dir /tmp/mag7-live-positive-capture-docker
```

### auto 模式

```bash
cd /workspace/project/mag7-supply-chain
bash infra/deployment/live-positive-capture.sh \
  --mode auto \
  --output-dir /tmp/mag7-live-positive-capture-auto
```

`auto` 先尝试完整 external 环境；若未提供完整外部依赖，再回退到本机 Docker/Compose。

## 3. 预检输出

入口脚本会先写：

1. `capture-entry-preflight.json`
2. `logs/capture-entry.log`

预检只记录以下信息：

1. 当前请求模式
2. authoritative snapshot 与计数边界
3. `GRAPH_RUNTIME_MODE`、`NEO4J_URI`、`NEO4J_USERNAME`、`NEO4J_PASSWORD`、`NEO4J_DATABASE`、`REDIS_URL` 是否已注入
4. 可选变量 `VITE_GRAPH_API_BASE_URL`、`CORS_ORIGIN`、`API_BASE`、`HOST`、`PORT` 是否已注入

这里的最小外部前置只包括 `Node.js v22.22.3 + npm + curl + jq`、可达的 Neo4j `5.26`、可达的 Redis `7.4`，以及 `GRAPH_RUNTIME_MODE=live / NEO4J_* / REDIS_URL`。Cloudflare、域名、同源 `/api` 代理或对外临时托管 Node API 运行器都不是本次闭环必需项。

预检明确禁止：

1. 把 provider secret 明文写入 JSON、日志、报告
2. 把旧计数 `312/410`、`327/435`、`341/459`、`350/476`、`9/15`、`23/41` 当当前口径
3. 把 candidate shell 叙述成 published

## 4. 取证清单

底层执行器成功时必须至少产出：

1. `import-summary.json`
2. `result.json`
3. `http/health.json`
4. `http/detail.json`
5. `http/overview.json`
6. `http/search.json`
7. `http/suggest.json`
8. `http/subgraph.json`
9. `http/path.json`
10. `http/stats.json`
11. `http/evidence.json`
12. `http/candidate-subgraph.json`
13. `http/candidate-evidence.json`
14. `logs/backend-live.log`
15. `capture-entry-summary.json`
16. `capture-entry-report.md`

失败时至少要保留：

1. `result.json`
2. `capture-entry-preflight.json`
3. `capture-entry-summary.json`
4. `minimal-external-prerequisites.json`
5. `logs/capture-entry.log`
6. `logs/import.stderr.log` 或 `import-failure.json`
7. 已经成功写出的 `http/*.json`

## 5. 成功判据

只有同时满足以下条件才算通过：

1. `result.json.passed = true`
2. `import-summary.json.source = "neo4j"`
3. `import-summary.json.liveImport.authoritativeSnapshotId = "snapshot:2026-06-15.full.18"`
4. `import-summary.json.liveImport.expectedRelationCount = 335`
5. `import-summary.json.liveImport.expectedEvidenceCount = 448`
6. `import-summary.json.liveImport.candidateOnlyRelationCount = 3`
7. `import-summary.json.liveImport.candidateOnlyEvidenceCount = 4`
8. `health/detail/overview/search/suggest/subgraph/path/stats/evidence` 全部采集成功，且业务样本都来自 `source=neo4j`
9. published `subgraph/path` 不得混入 candidate-only relation
10. candidate shell relation 只能在显式 candidate snapshot 或 direct relation evidence 中出现

## 6. 失败回退

任何失败都必须按以下原则处理：

1. 保留整个输出目录
2. 停止 backend 进程
3. 清理隔离的 Neo4j database 与 Redis keyspace
4. 若 docker 模式拉起了容器，除非显式 `--keep-services`，否则让底层执行器自动回收
5. 不得把失败解释为“切回 prototype/mock 即完成”

## 7. 推荐阅读顺序

人工复核或外部运行器排障时，建议按以下顺序看文件：

1. `capture-entry-report.md`
2. `capture-entry-summary.json`
3. `result.json`
4. `capture-entry-preflight.json`
5. `minimal-external-prerequisites.json`
6. `logs/capture-entry.log`
7. `logs/backend-live.log`
8. `logs/import.stderr.log`
9. `http/*.json`

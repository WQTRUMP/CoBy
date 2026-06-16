# Mag7 数据版本 Promotion Gate 清单

> 当前唯一正式基线：`authoritative snapshot=snapshot:2026-06-15.full.18`
> 当前 active candidate shell：`snapshot:2026-06-16.full.22-amazon-tail-candidate`
> 当前计数：`published=332/444`、`all-candidates=334/447`、`candidate-only=2/3`

## 1. 适用范围

本清单用于约束 Mag7 数据版本从 candidate shell 到正式发布、再到部署审批的顺序。它只处理数据口径与运行门槛，不替代 `infra/deployment` 下的部署交接文件。

## 2. 当前结论

1. `full.18` 仍是唯一 authoritative snapshot。
2. `full.22` 只收敛 candidate shell，未形成新的 authoritative promotion。
3. `real_data_launch` 当前仍是 `awaiting_source_neo4j_positive_closure`。
4. 在 `source=neo4j` 正向闭环完成前，不得前移 `real_data_launch`，也不得进入 Cloudflare 正式部署审批。

## 3. Promotion Gate

### Gate A: 正式基线锁定

- 必须确认 `authoritative snapshot=snapshot:2026-06-15.full.18`
- 必须确认 `published=332 relations / 444 evidence`
- 若看到 `full.21`、`335/448`、`3/4`、`341/459`、`350/476`、`9/15`、`23/41` 被当作当前正式口径，直接判定失败

### Gate B: Candidate Shell 隔离

- 必须确认 `active candidate shell=snapshot:2026-06-16.full.22-amazon-tail-candidate`
- 必须确认 `all-candidates=334 / 447`
- 必须确认 `candidate-only=2 / 3`
- 必须确认 candidate shell 只作为审计边界存在，不能被描述成 published

### Gate C: Live 运行时正向闭环

以下全部满足前，`real_data_launch` 一律不得前移：

1. 可达 Neo4j/Redis 已准备完成
2. `import-summary.json` 明确为 `source=neo4j`
3. `GET /api/v1/health` 为 `status=ok`
4. `detail / overview / search / suggest / subgraph / path / stats / evidence` 全部拿到 `source=neo4j` 正向样本
5. published 查询面不混入 candidate-only relation
6. candidate-only relation 只在显式 candidate snapshot 或 direct relation evidence 校验中出现

### Gate D: 部署审批

- Gate C 未通过时：不得发起 Cloudflare 正式部署审批
- Gate C 通过后：审批范围也只能覆盖 `published=332/444`
- 不得把 `334/447` 或 `2/3` 放大成审批范围

## 4. 禁止事项

1. 把 `full.22` 写成新的 authoritative snapshot
2. 把 `active candidate shell` 写成 published
3. 把 historical full19/full20-wave5 live 证据写成 2026-06-16 当前环境已复放通过
4. 在 `source=neo4j` 正向闭环缺失时把 `real_data_launch` 上调为 `ready_for_human_decision`
5. 用 prototype/mock 或 degraded 结果替代 live 通过证据

## 5. 通过后的允许动作

只有 Gate A-D 全部通过后，才允许：

1. 更新部署交接入口中的 `real_data_launch` 阶段
2. 向 human 发送 Cloudflare 部署决策请求
3. 将审批范围限定为 published `332/444`

## 6. 当前唯一门槛结论

当前缺口不是 candidate shell 计数，也不是 published 基线，而是：

`source=neo4j` 正向闭环仍未完成，因此 `real_data_launch` 不得前移。

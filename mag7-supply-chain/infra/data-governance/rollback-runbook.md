# Mag7 数据版本治理回滚手册

> 本手册处理的是数据版本口径回滚，不是基础设施故障回滚。
> 当前正式基线固定为 `snapshot:2026-06-15.full.18` / `published=332/444`。

## 1. 触发条件

出现以下任一情况时，必须执行治理回滚：

1. 文档、manifest 或审批材料把 `full.21` shell 错写成新的 authoritative snapshot
2. published 口径被错误写成 `335/448` 或把 `candidate-only=3/4` 混入 published
3. `real_data_launch` 在未取得 `source=neo4j` 正向闭环前被提前上调
4. historical full19/full20-wave5 口径被重新当作当前正式输入

## 2. 立即止损

1. 停止任何待发送的部署审批或 handoff 消息
2. 恢复所有当前入口文件到：
   - `authoritative snapshot=snapshot:2026-06-15.full.18`
   - `published=332/444`
   - `all-candidates=335/448`
   - `candidate-only=3/4`
   - `real_data_launch=awaiting_source_neo4j_positive_closure`
3. 明确标记错误口径为 `historical`、`superseded` 或 `audit-only`

## 3. 回滚顺序

### 步骤 1: 回滚治理清单

优先核对并修正以下文件：

1. `infra/data-governance/data-version-manifest.json`
2. `infra/deployment/deployment-manifest.json`
3. `infra/deployment/products-candidate.json`
4. `infra/deployment/cloudflare-handoff-checklist.json`
5. `README.md`

### 步骤 2: 回滚发布语义

必须恢复以下结论：

1. `full.18` 是唯一 authoritative snapshot
2. `full.21` 只是 active candidate shell
3. `real_data_launch` 仍被 `source=neo4j` 正向闭环阻塞
4. 未经 live 闭环，不得发起 Cloudflare 正式部署审批

### 步骤 3: 重新验证机读基线

使用以下命令重新验证：

```bash
jq '.release.authoritative_snapshot, .counts.published, .counts.all_candidates, .counts.candidate_only' \
  /workspace/project/mag7-supply-chain/infra/data-governance/data-version-manifest.json

jq '.authoritative_supply_chain_release.authoritative_snapshot, .authoritative_supply_chain_release.counts' \
  /workspace/project/mag7-supply-chain/infra/deployment/deployment-manifest.json
```

预期：

1. authoritative snapshot 仍为 `snapshot:2026-06-15.full.18`
2. published 仍为 `332/444`
3. all-candidates 仍为 `335/448`
4. candidate-only 仍为 `3/4`

## 4. 回滚后沟通要求

1. 中文报告必须明确写出“为什么回滚”
2. 必须指出错误是：
   - authoritative snapshot 误前移
   - candidate shell 误放大
   - real_data_launch 误上调
   - historical 输入误回流
3. 若已生成待审批消息，必须作废并重发更正版本

## 5. 不允许的伪回滚

1. 仅修改 Markdown，不修改机读 manifest
2. 仅把错误结论改成模糊表述，不恢复明确计数
3. 用 `prototype passed` 掩盖 `real_data_launch` 未闭环
4. 继续保留可误读为当前正式入口的旧 readiness 文案

## 6. 当前标准回滚终点

完成回滚后，仓库必须再次稳定在以下唯一状态：

- `authoritative snapshot=snapshot:2026-06-15.full.18`
- `active candidate shell=snapshot:2026-06-15.full.21-tail-closure-candidate`
- `published=332/444`
- `all-candidates=335/448`
- `candidate-only=3/4`
- `real_data_launch=awaiting_source_neo4j_positive_closure`
- `source=neo4j` 正向闭环仍是前移门槛

# full.19 正式部署口径刷新差异报告

日期：2026-06-15 UTC

## 本次唯一正式结论源

- `/workspace/agents/code-reviewer-6/output/full19-live-e2e-formal-review-v3/full19-live-e2e-formal-review-v3-report.md`

说明：
本次刷新只能使用上面的正式复审 v3 作为最终结论源。`6e45bce1` 仅保留审计用途，不得进入 deployment-manifest、products 候选、Cloudflare handoff 或 human 决策口径。

## 相对 full.18 v4 口径的关键变化

1. `authoritative snapshot` 保持不变，仍为 `snapshot:2026-06-15.full.18`。
2. `published` 从 `312 / 410` 更新为 `327 / 435`。
3. `all-candidates` 从 `328 / 439` 更新为 `350 / 476`。
4. `candidate-only delta` 从 `16 / 29` 更新为 `23 / 41`，但边界仍停留在 `contracts/all-candidates`，不得写成已发布 live 数据。
5. `candidate-only live evidence` 的正式负样本继续是 `404 relation_evidence_not_found`，这证明 candidate-only 边界零回归。
6. `real_data_launch` 从 `blocked/no_go` 改为 `ready_for_human_decision`；变化原因不是数据 authoritative 前移，而是正式复审已确认真实 live 导入与 HTTP 回读闭环成立。
7. `formal input policy` 从多份链路材料收束为单一正式结论源；其余文件最多只能作为仓库事实或审计背景，不得替代正式结论。
8. `Cloudflare handoff` 从“继续等待 live 技术闭环”切换为“可提交 human/控制面审批，但审批范围只能覆盖 published 327/435”。

## 本次保持不变的硬边界

1. 不得把 `full.19-candidate` 外层壳层写成新的 authoritative snapshot。
2. 不得把 `350/476` 写成已发布 live 数据。
3. 不得把 candidate-only relation 的 `404 relation_evidence_not_found` 解释成运行时回退或部署失败。
4. 不得把 `6e45bce1` 当成任何最终输入。
5. 不得绕过 Wanman 控制面直接执行 Cloudflare、DNS、证书或 paid resource 变更。

## 文件级修正点

### `deployment-manifest.json`

- 保持 `authoritative snapshot=full.18`
- 明确 `published=327/435`、`all-candidates=350/476`
- 明确 candidate-only live evidence 继续返回 `404 relation_evidence_not_found`
- 明确 `real_data_launch` 已不再因 full.19 live 运行时闭环而 blocked
- 明确 `6e45bce1` 仅保留审计用途

### `products-candidate.json`

- 产品 readiness 保持 `real_data_launch_ready_for_human_decision`
- 明确候选库存只覆盖 published 327/435
- 明确 candidate-only live evidence 继续 `404`
- 明确唯一正式结论源与 `6e45bce1` 审计排除规则

### `cloudflare-handoff-checklist.json`

- 审批目标只覆盖 published 327/435
- 明确 `real_data_launch` 技术阻塞已解除，但外部部署仍需 human 批准
- 明确 candidate-only 404 与 `6e45bce1` 审计排除规则

## human 决策口径

`deployment manifest 已按 full.19 真实 live 终审 v3 刷新完成；唯一正式结论源为 /workspace/agents/code-reviewer-6/output/full19-live-e2e-formal-review-v3/full19-live-e2e-formal-review-v3-report.md，authoritative snapshot 仍为 snapshot:2026-06-15.full.18，published 327/435 与 all-candidates 350/476 边界不变，candidate-only live evidence 继续返回 404 relation_evidence_not_found，real_data_launch 不再因 full.19 live 运行时闭环而 blocked；6e45bce1 仅保留审计用途，不得作为最终输入。请在 Wanman 中连接 Cloudflare，补录 account/zone/routing 字段，并批准仅覆盖 published 327/435 的正式部署。`

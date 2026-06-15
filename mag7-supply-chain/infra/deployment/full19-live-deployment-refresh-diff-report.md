# full.19 正式部署口径刷新差异报告

日期：2026-06-15 UTC

## 本次唯一正式结论源

- `/workspace/agents/code-reviewer-6/output/full19-live-e2e-formal-review-v3/full19-live-e2e-formal-review-v3-report.md`

说明：本次刷新只接受上面的正式复审 v3 作为 deployment readiness 与数据边界的唯一结论源；仓库源码仅用于核对 runtime、entrypoint 与命令事实。

## 相对 full.18 v4 口径的关键变化

1. `authoritative snapshot`：保持不变，仍为 `snapshot:2026-06-15.full.18`。
2. `published`：从 `312 / 410` 更新为 `327 / 435`。
3. `all-candidates`：从 `328 / 439` 更新为 `350 / 476`。
4. `candidate-only delta`：从 `16 / 29` 扩大为 `23 / 41`，但边界仍保持在 contracts/all-candidates 层，不进入 published live 图。
5. `real_data_launch`：从 `blocked/no_go` 改为 `ready_for_human_decision`；变化原因不是数据 authoritative 前移，而是 `source=neo4j` 的真实导入与 HTTP 回读已经被正式补齐。
6. `formal input policy`：从 full.18 的双目录最终链，收束为本轮 code-reviewer-6 formal review v3 单一正式结论源。
7. `Cloudflare handoff`：从“仅可准备 prototype 候选部署”更新为“可准备真实 live 部署审批，但必须只覆盖 published 327/435，且仍需 human/控制面批准”。

## 本次保持不变的硬边界

1. 不得把 `full.19-candidate` 外层壳层写成新的 authoritative snapshot。
2. 不得把 `350/476` 写成已发布 live 数据。
3. 不得把 candidate-only relation 的 404 负样本解释成运行时回退或部署失败。
4. 不得绕过 Wanman 控制面直接执行 Cloudflare、DNS、证书或 paid resource 变更。

## 新文件语义

### `deployment-manifest.json`

- readiness 更新为 `prototype_passed_real_data_launch_ready_for_human_decision`
- paid resource policy 改写为“技术阻塞已解除，但仍需 human 批准”
- health/verification 改写为同一套 live 运行时下的正式证据

### `products-candidate.json`

- 候选库存状态改为 `pending_human_approval`
- 产品 readiness 改为 `real_data_launch_ready_for_human_decision`
- 保留 `/opt/wanman/products.json` 仍为空时不得宣称正式 uptime 覆盖

### `cloudflare-handoff-checklist.json`

- 从 full.18 的外部验收准备清单，切换为可实际提交 human 的 Cloudflare/部署审批清单
- 明确 approval 只能覆盖 published 327/435，不得放大到 350/476

## human 决策口径

可以对 human 这样表达：

`deployment manifest 已按 full.19 真实 live 终审 v3 刷新完成；authoritative snapshot 仍为 snapshot:2026-06-15.full.18，published 327/435 与 all-candidates 350/476 边界不变，source=neo4j 的真实 live 导入与 HTTP 回读已正式成立，real_data_launch 不再因 full.19 live 运行时闭环而 blocked。请在 Wanman 中连接 Cloudflare，补录 account/zone/routing 字段，并批准仅覆盖 published 327/435 的正式部署。`

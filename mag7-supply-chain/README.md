# Mag7 供应链情报图谱

一个面向美股研究的交互式供应链原型，用来探索 Mag7 公司与其产品、供应商、供应商的供应商之间的关系。当前版本聚焦“区域风险情报座舱”形态：左侧为供应链地图与三级关系线，右侧为产品 x 供应商风险矩阵，底部为来源证据抽屉。

> 说明：本项目是研究与产品原型，不构成投资建议。供应链关系会随公司披露、采购策略、产能规划和媒体报道变化而变化，正式研究使用前应复核最新公告和原始文件。

## 核心功能

- Mag7 入口切换：Apple、Microsoft、Amazon、Alphabet、Meta、NVIDIA、Tesla。
- 三级关系探索：公司 -> 产品/服务 -> 一级供应商 -> 二级供应商 -> 三级上游。
- 交互式地图：点击节点或连线后，右侧关系详情和底部证据会同步更新。
- 供应商互联：显式展示供应商之间的上下游、设备材料、竞合/替代关系。
- 关系质疑机制：每条供应商关系都有核验分、核验清单、主要疑点和状态按钮。
- 产品 x 供应商矩阵：用高/中/低热力格展示关键产品、材料、服务和供应商暴露。
- 搜索与筛选：支持按公司、产品、供应商、材料搜索，并按产品类别、区域、来源类型筛选。
- 风险叠加：突出高风险关系和高风险节点。
- 地图模式切换：路径映射、区域风险、供应商层级。
- 来源证据抽屉：展示财报、公司公告、供应商公告、媒体等来源链接。
- 当前图谱导出：将所选公司、深度、路径、关系和来源复制为 JSON。

## 技术栈

- React 19
- Vite 6
- Phosphor Icons
- 自定义 SVG 图层绘制关系线和节点
- 生成式 raster 地图资产：`public/assets/dark-world-map.png`

项目中已安装部分 D3 包，当前实现主要使用自定义坐标与 SVG 路径，后续可接入 D3 force / zoom 做更复杂的图布局。

## 当前实现与验证口径

- 已验证 Node 版本：`v22.22.3`
- 前端入口：`src/main.tsx`
- 后端源码入口：`backend/src/server.ts`
- 后端构建产物入口：`backend/dist/backend/src/server.js`
- 前端 API 基址变量：`VITE_GRAPH_API_BASE_URL`
- 后端默认运行态：`GRAPH_RUNTIME_MODE=live`
- 后端 live 依赖变量：`NEO4J_URI`、`NEO4J_USERNAME`、`NEO4J_PASSWORD`、`NEO4J_DATABASE`、`REDIS_URL`
- 发布约束：只有显式设置 `GRAPH_RUNTIME_MODE=prototype` 时才允许 `source=mock`；默认 live/验收模式缺依赖时业务接口必须返回 `503 dependency_unavailable`。当前唯一正式数据边界固定为 `authoritative snapshot=snapshot:2026-06-15.full.18`、`published=332/444`、`all-candidates=334/447`、`candidate-only=2/3`，active candidate shell 为 `snapshot:2026-06-16.full.22-amazon-tail-candidate`；旧 `335/448`、`3/4` 仅保留历史审计用途，不再代表当前正式候选壳口径。`real_data_launch` 继续锁定为 `awaiting_source_neo4j_positive_closure`，当前仍缺少基于外部 Neo4j/Redis 的 `source=neo4j` 正向闭环证据，因此这里不得表述成已 `ready_for_human_decision`，也不得表述成当前 sandbox 已在本机把 Neo4j/Redis 重放通过。

## 快速开始

```bash
cd /workspace/project/mag7-supply-chain
npm install
cp .env.example .env
cp backend/.env.example backend/.env
```

当前仓库拆分为前端、后端与本地依赖三部分，建议按顺序启动。

### 1. 启动本地依赖

```bash
docker compose -f docker-compose.dev.yml up -d
```

### 2. 启动后端 API

```bash
cd /workspace/project/mag7-supply-chain/backend
npm install
npm run dev
```

默认地址：

```text
http://127.0.0.1:4000
```

健康检查：

```bash
curl http://127.0.0.1:4000/api/v1/health
```

### 3. 启动前端

```bash
cd /workspace/project/mag7-supply-chain
npm run dev
```

默认地址：

```text
http://127.0.0.1:5174/
```

如果 5174 被占用，Vite 会自动换到其他端口，以终端输出为准。

本地 API 接线有两种可执行模式：

- 显式后端基址：保留 `.env` 中的 `VITE_GRAPH_API_BASE_URL=http://127.0.0.1:4000`，前端会直接请求真实后端。
- 同源 `/api` 代理：把 `VITE_GRAPH_API_BASE_URL` 留空，`vite dev` / `vite preview` 会自动把 `/api/*` 代理到 `HOST:PORT`（默认 `http://127.0.0.1:4000`）。

如果预览环境误把 `/api` 回退成前端 `index.html`，前端现在会抛出带诊断提示的错误，明确提示检查 `VITE_GRAPH_API_BASE_URL` 或 Vite `/api` 代理。

### 4. 构建生产版本

前端：

```bash
npm run build
```

后端：

```bash
cd /workspace/project/mag7-supply-chain/backend
npm run build
npm start
```

## 环境变量

### 根目录 `.env`

根目录 `.env.example` 统一了前端、本地 Compose 以及部署文档口径，不再使用 `API_BASE_URL`、`GRAPH_SNAPSHOT_VERSION`。

```dotenv
VITE_GRAPH_API_BASE_URL=http://127.0.0.1:4000
GRAPH_RUNTIME_MODE=live
NEO4J_URI=bolt://127.0.0.1:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=mag7-dev-password
NEO4J_DATABASE=neo4j
REDIS_URL=redis://127.0.0.1:6379
PORT=4000
HOST=127.0.0.1
CORS_ORIGIN=http://127.0.0.1:5174
```

说明：

- 前端代码只读取 `VITE_GRAPH_API_BASE_URL`；未设置时会回退到同源 `/api/v1/*`。
- Compose 与 Neo4j 初始化脚本已统一使用 `NEO4J_USERNAME` / `NEO4J_DATABASE` 命名。
- `backend/.env.example` 与根目录口径保持一致，便于后端单独运行。

### Backend `.env`

后端本地运行时至少需要以下绑定：

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

默认 `GRAPH_RUNTIME_MODE=live`。在这个模式下：

- `NEO4J_URI` 缺失或 Neo4j 不可达时，`/api/v1/health` 会保留 `runtimeMode=live`、`repositoryMode=neo4j` 并暴露依赖状态；业务接口返回结构化 `503 dependency_unavailable`
- `REDIS_URL` 缺失或 Redis 不可达时，服务仍可启动并暴露 health，但业务接口与 `POST /api/v1/imports/normalized-package` 同样返回结构化 `503 dependency_unavailable`
- 只有显式设置 `GRAPH_RUNTIME_MODE=prototype` 时，后端才允许进入 `mock` 仓储边界用于原型演示

### 前端部署变量

- 同源 `/api` 代理部署：`VITE_GRAPH_API_BASE_URL` 可留空
- 前后端跨域分离部署：必须显式提供 `VITE_GRAPH_API_BASE_URL=https://<api-domain>`

### 本地 preview smoke

构建产物本地预览时，建议至少验证一次 API 闭环：

```bash
cd /workspace/project/mag7-supply-chain
npm run build
VITE_GRAPH_API_BASE_URL= npm run preview -- --port 4173
curl http://127.0.0.1:4173/api/v1/health
```

预期返回 JSON 健康检查结果；如果后端未启动，预览代理会返回明确的代理失败，而不是静态 `index.html`。

无 `VITE_GRAPH_API_BASE_URL` 时的默认行为与失败模式：

- 默认接线：前端请求同源 `/api/v1/*`，`vite dev` / `vite preview` 自动把 `/api/*` 代理到 `http://127.0.0.1:4000`，除非你显式改了 `HOST` / `PORT` 或设置了 `VITE_GRAPH_API_BASE_URL`。
- 后端已启动：`curl http://127.0.0.1:4173/api/v1/health` 应返回 JSON；这表示 preview/default 下的真实 API 接线已闭环，不会回退 `index.html`。
- 后端未启动或代理目标不可达：浏览器会收到 `500` 级错误，前端 UI 会提示“local /api proxy”与 `VITE_GRAPH_API_BASE_URL` 诊断信息。先检查 `curl http://127.0.0.1:4173/api/v1/health`，再检查 `curl http://127.0.0.1:4000/api/v1/health`。
- 若仍收到 HTML：说明当前环境没有命中 Vite `/api` 代理，而是把 `/api` 回退成了静态站点。此时必须显式设置 `VITE_GRAPH_API_BASE_URL=http://127.0.0.1:4000`，或修复部署层的同源 `/api` 代理。

## 部署与上线约束

当前 README 的部署与上线表述采用 `full.22` 顶层候选壳与 live 正向闭环终审后的正式口径：

- 唯一 authoritative promotion 仍是 `snapshot:2026-06-15.full.18`；`full.22` 仅完成顶层 active candidate shell 从旧 `335/448`、`3/4` 收敛到 `334/447`、`2/3`，不构成新的 authoritative promotion
- `full.22`、`full.21`、`full.19-candidate` 与其他 candidate/审计壳层都不得表述成新的正式 promotion；若引用它们，必须明确是当前候选壳收敛、历史审计或交接模板用途，旧 `335/448`、`3/4` 仅可作为历史审计基线引用
- 正式增量口径：`formal net new=Apple 0 / Alphabet 0 / Meta 0 / Tesla 0`
- 正式发布边界：`published=332/444`、`all-candidates=334/447`、`candidate-only=2/3`
- 后端 `validate:normalized-package` 与 `import:full-package:live` 现在都强制显式比对 `/workspace/project/mag7-supply-chain/infra/data-governance/data-version-manifest.json`；顶层 candidate root 在补齐 `version-manifest.json` 后，`--manifest` 与 `--package-dir` 两种入口都必须经过同一硬门槛，不能再接受仅 package manifest 自洽但正式基线已漂移的候选包
- `prototype`：可发布。允许前端静态站点接独立 API；仅当后端显式设置 `GRAPH_RUNTIME_MODE=prototype` 时，才允许使用 `repositoryMode=mock` / `source=mock` 的原型演示链路。
- `real_data_launch`：当前唯一正式状态仍是 `awaiting_source_neo4j_positive_closure`，缺口仍是基于外部 Neo4j/Redis 的 `source=neo4j` 正向闭环；在该闭环补齐前，不得把本机状态写成已完成 live 复放，亦不得把 candidate shell 收敛表述成新的 `ready_for_human_decision` 或 authoritative promotion。
- 默认 `GRAPH_RUNTIME_MODE=live`；若 `NEO4J_URI` / `REDIS_URL` 缺失或依赖不可达，允许的失败语义只有 `health=degraded` 与业务接口 `503 dependency_unavailable`，不得静默回退 `mock`。
- 若 `/opt/wanman/products.json` 仍为空数组，则 `system_status=unknown:no_product_inventory`，不得宣称正式 uptime 覆盖。
- 不得把全量包 in-memory real-shape 测试、prototype/mock 返回或 degraded 运行结果表述成真实 Neo4j + Redis 验收。
- Cloudflare、正式域名、付费数据库 / 缓存资源的实际部署必须走 Wanman 审批流，不能直接使用提供商凭据。

### real_data_launch 一键验收

正式 live 验收统一走 `infra/deployment` 下的交接包：

```bash
cd /workspace/project/mag7-supply-chain
set -a
source infra/deployment/live-acceptance.env.example
set +a
bash infra/deployment/live-acceptance-commands.sh \
  --mode docker \
  --output-dir /tmp/mag7-live-acceptance-full18
```

如果当前环境没有 Docker，但已有外部 Neo4j / Redis，可改用：

```bash
bash infra/deployment/live-acceptance-commands.sh \
  --mode external \
  --output-dir /tmp/mag7-live-acceptance-full18
```

相关文件：

- `infra/deployment/live-acceptance-runbook.md`
- `infra/deployment/live-acceptance.env.example`
- `infra/deployment/live-acceptance-evidence-template.md`

推荐部署拆分：

- Web: GitHub Pages / Cloudflare Pages / Vercel
- API: Railway / Render / Fly.io
- Stateful: Neo4j 5.x + Redis 7.x

## 本地基础设施骨架

按照 CTO 技术蓝图，Phase 0 本地开发环境固定为：

- `Neo4j 5.26`：图数据库，开发时带 APOC
- `Redis 7.4`：查询缓存
- `MinIO`：S3 兼容对象存储，用于原始证据、整理后数据和导出文件

已补齐的基础设施文件：

```text
docker-compose.dev.yml
infra/
  docker/
    docker-compose.dev.yml
  neo4j/
    apply.sh
    constraints.cypher
    indexes.cypher
    seed.cypher
  redis/
    redis.conf
  minio/
    init.sh
  deployment/
    deployment-manifest.input.json
```

### 启动本地依赖

```bash
docker compose -f docker-compose.dev.yml up -d
```

Compose 会启动并初始化：

- `neo4j`：开放 `7474`（HTTP）和 `7687`（Bolt）
- `redis`：开放 `6379`
- `minio`：开放 `9000`（API）和 `9001`（Console）
- `neo4j-init`：自动执行约束、索引和种子数据
- `minio-init`：自动创建 `mag7-raw`、`mag7-curated`、`mag7-exports` bucket

### 常用访问地址

- Neo4j Browser: `http://127.0.0.1:7474`
- Neo4j Bolt: `bolt://127.0.0.1:7687`
- Redis: `redis://127.0.0.1:6379`
- MinIO API: `http://127.0.0.1:9000`
- MinIO Console: `http://127.0.0.1:9001`

### 关闭与清理

```bash
docker compose -f docker-compose.dev.yml down
docker compose -f docker-compose.dev.yml down -v
```

### 与后续 deployment manifest 的衔接

`infra/deployment/deployment-manifest.input.json` 不是正式部署清单，而是 DevOps 预留的服务清单输入，供后续在开发任务完成后生成 `wanman.deployment-manifest` 时复用。该输入文件现已与当前实现对齐：前端变量统一为 `VITE_GRAPH_API_BASE_URL`，后端图数据库变量统一为 `NEO4J_USERNAME` / `NEO4J_DATABASE`，并以 `Node v22.22.3` 作为已验证口径。当前阶段不会触发任何 Cloudflare 或付费资源部署动作。

## 目录结构

```text
mag7-supply-chain/
  src/
    App.tsx                  # 主应用、交互状态、地图、矩阵、证据抽屉
    main.tsx                 # React 入口
    styles.css               # 深色研究终端风格样式
    services/
      graphExplorerApi.ts    # 前端 API 客户端
  backend/
    src/
      server.ts              # Fastify 启动入口
      config/
        env.ts               # 后端环境变量定义
  public/
    assets/
      dark-world-map.png     # 深色世界地图底图
    reference/
      selected-direction-3.png # 选中的视觉方向参考图
  design-qa.md               # 设计 QA 报告
  design-comparison.png      # 参考图与实现截图对比
  prototype-final.png        # 最终实现截图
  package.json
  backend/package.json
  infra/
```

## 数据模型

核心数据集中在 `src/data/supplyChain.js`。

主要对象：

- `companies`：Mag7 公司入口，包括 ticker、展示名称、业务焦点、风险摘要和公司级来源。
- `nodes`：图谱节点，包括公司、产品、供应商、上游供应商和原材料节点。
- `relationships`：节点之间的关系，字段包括 `from`、`to`、`company`、`depth`、`relationScope`、`relationType`、`description`、`risk`、`confidence`、`sourceIds`、`verification`。
- `sources`：证据来源，包括标题、发布方、类型、日期和 URL。
- `matrixByCompany`：每家公司右侧矩阵数据。
- `positions`：地图中各节点的百分比坐标。

关系深度约定：

- `0`：公司到产品/服务入口。
- `1`：产品/服务到一级供应商。
- `2`：一级供应商到上游供应商。
- `3`：上游供应商到更上游材料、设备或资源节点。

风险和置信度使用 `high`、`medium`、`low`。界面展示为高、中、低。

关系范围约定：

- `companyProduct`：公司到产品/服务入口。
- `productSupplier`：产品/服务到供应商。
- `supplierSupplier`：供应商之间的上下游、设备、材料或原料关系。
- `supplierPeer`：供应商之间的竞合、替代、共同客户或共同上游暴露关系。

核验机制字段：

- `verification.status`：默认核验状态，取值为 `verified`、`review`、`challenged`。
- `verification.evidenceScore`：证据分，当前按置信度、来源类型和来源数量计算。
- `verification.checklist`：用于确认关系可靠性的核验清单。
- `verification.doubts`：需要研究员质疑或补证的疑点。
- `verification.nextAction`：下一步复核建议。

## 数据来源

当前原型优先使用以下来源类别：

- 公司年报 / 10-K
- 公司公告和技术文档
- 供应商公告、年报、ESG 或投资者关系材料
- 权威媒体报道

示例来源包括：

- Apple Supplier List
- Apple、Amazon、Alphabet、Meta、Microsoft、NVIDIA、Tesla 的年度报告或 10-K
- Microsoft Azure GPU VM 文档
- AWS Project Rainier / NVIDIA 合作公告
- Google TPU / NVIDIA Blackwell 相关公告
- Meta AI 基础设施和 RSC 公告
- TSMC、ASML、Panasonic Energy、CATL、LG Energy Solution 等供应商资料
- Reuters 等媒体报道

添加新来源时建议：

1. 先在 `sources` 中增加来源条目。
2. 在 `relationships` 的 `sourceIds` 中引用来源 ID。
3. 对媒体或推断性关系降低 `confidence`，避免把间接证据当作确定事实。
4. 如果是关键投资结论，优先用公司原始公告或 SEC 文件复核。

## 主要交互说明

- 点击顶部 ticker：切换 Mag7 公司入口。
- 点击 1级 / 2级 / 3级：限制地图显示深度。
- 输入搜索词：不匹配的节点和连线会被弱化。
- 点击地图节点：选中对应节点，并同步右侧关系详情。
- 点击地图连线：选中该供应链关系，展示关系描述、风险、置信度和来源。
- 点击右侧“供应商互联”：快速切到供应商之间的上下游或竞合关系。
- 在“质疑 / 核验机制”中点击“质疑 / 复核中 / 可靠”：为当前关系标记复核状态，右侧列表会同步更新。
- 点击来源筛选：底部证据卡只展示对应类型。
- 点击“查看全部证据”：恢复全部来源。
- 点击导出按钮：将当前图谱 JSON 复制到剪贴板。

## 视觉与设计说明

选用的方向是“区域风险情报座舱”：

- 深色 graphite / black 研究终端风格。
- 中心区域使用深色世界地图和供应链关系弧线。
- 颜色语义：
  - 青色：一级关系
  - 绿色：二级关系
  - 金色：三级关系
  - 红色：高风险
- 右侧矩阵强调暴露和风险等级。
- 底部证据区强调可追溯来源。

视觉目标参考图保存在：

```text
public/reference/selected-direction-3.png
```

## QA 状态

已完成以下验证：

- `npm run build` 构建通过。
- 浏览器控制台无错误或警告。
- 交互验证通过：公司切换、深度切换、搜索、来源筛选、地图模式、JSON 导出。
- 供应商互联与质疑机制验证通过：生产预览中 TSLA 默认视图渲染 27 条供应商互联关系，质疑按钮可将选中关系同步标记为“有疑点”。
- 设计 QA 通过。

QA 报告：

```text
design-qa.md
```

最终截图：

```text
prototype-final.png
```

参考图与实现对比：

```text
design-comparison.png
```

## 已知限制

- 当前供应链数据是精选研究样本，不是完整数据库。
- 节点坐标为人工设定，密集场景下仍可能需要更智能的标签避让。
- 部分关系基于公告、供应商披露或媒体报道的交叉验证，置信度不等同于合同金额或采购占比。
- `supplierPeer` 表示竞合/替代/共同暴露，不应自动解读为上下游采购合同。
- 供应链关系没有实时更新机制，需要后续接入数据抓取、审核和版本管理。
- 当前导出为复制 JSON 到剪贴板，未实现文件下载。

## 后续扩展方向

- 增加来源摘录、页码、原文片段和证据强弱评级。
- 增加质疑记录的持久化，例如本地存储、数据库或多人审核工作流。
- 引入时间轴，展示供应链关系何时新增、变化或失效。
- 增加公司间共同供应商暴露对比。
- 增加供应商财务指标、地区收入、产能、客户集中度和制裁/出口管制风险。
- 接入数据库或 JSON API，支持持续更新。
- 使用 D3 zoom / force layout 做可缩放、可拖拽和自动避让的图谱。
- 为重点链路建立独立研究页面，例如 NVIDIA HBM/CoWoS、Tesla 电池材料、Apple 先进制程和组装链。

## 维护建议

- 更新数据时优先修改 `src/data/supplyChain.js`，不要把数据硬编码进组件。
- 新增关系时必须补充 `sourceIds`。
- 新增供应商之间的竞合关系时优先使用 `relationScope: "supplierPeer"`，并在描述中明确它不是采购合同。
- 新增公司或节点时同步检查 `positions` 和 `matrixByCompany`。
- 修改视觉后重新运行 `npm run build`，并更新 `prototype-final.png` 和 `design-qa.md`。

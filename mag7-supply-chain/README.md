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

## 快速开始

```bash
cd /Users/xncool/Documents/RReaserch/mag7-supply-chain
npm install
npm run dev
```

如果要同时起本地图数据库、缓存和对象存储，先准备开发环境变量：

```bash
cp .env.example .env
```

当前本地开发服务使用 Vite：

```text
http://127.0.0.1:5174/
```

如果 5174 被占用，Vite 会自动换到其他端口，以终端输出为准。

构建生产版本：

```bash
npm run build
```

预览生产构建：

```bash
npm run preview
```

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

`infra/deployment/deployment-manifest.input.json` 不是正式部署清单，而是 DevOps 预留的服务清单输入，供后续在开发任务完成后生成 `wanman.deployment-manifest` 时复用。当前阶段不会触发任何 Cloudflare 或付费资源部署动作。

## 目录结构

```text
mag7-supply-chain/
  src/
    App.jsx                  # 主应用、交互状态、地图、矩阵、证据抽屉
    main.jsx                 # React 入口
    styles.css               # 深色研究终端风格样式
    data/
      supplyChain.js         # 公司、节点、关系、矩阵、来源数据
  public/
    assets/
      dark-world-map.png     # 深色世界地图底图
    reference/
      selected-direction-3.png # 选中的视觉方向参考图
  design-qa.md               # 设计 QA 报告
  design-comparison.png      # 参考图与实现截图对比
  prototype-final.png        # 最终实现截图
  package.json
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

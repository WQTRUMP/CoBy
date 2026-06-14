import { useEffect, useMemo, useState } from "react";
import {
  ArrowSquareOut,
  BatteryCharging,
  CaretDown,
  CheckCircle,
  Cloud,
  Cpu,
  Database,
  DownloadSimple,
  FileText,
  Funnel,
  Gauge,
  GlobeHemisphereEast,
  Info,
  LinkSimple,
  ListChecks,
  MagnifyingGlass,
  MapPin,
  Path,
  PlugsConnected,
  Question,
  ShareNetwork,
  ShieldCheck,
  SlidersHorizontal,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import {
  categoryOptions,
  companies,
  matrixByCompany,
  nodes,
  positions,
  relationScopeLabels,
  regions,
  relationships,
  riskColor,
  riskLabels,
  sourceTypes,
  sources,
  updatedAt,
  verificationStatusLabels,
} from "./data/supplyChain";

const companyCategories = {
  aapl: ["Consumer Devices"],
  msft: ["AI GPU / Datacenter", "Cloud / Custom Silicon"],
  nvda: ["AI GPU / Datacenter", "Cloud / Custom Silicon"],
  googl: ["AI GPU / Datacenter", "Cloud / Custom Silicon"],
  amzn: ["AI GPU / Datacenter", "Cloud / Custom Silicon"],
  meta: ["AI GPU / Datacenter", "Cloud / Custom Silicon"],
  tsla: ["EV / Battery / FSD"],
};

const companyById = Object.fromEntries(companies.map((company) => [company.id, company]));

export function App() {
  const [selectedCompanyId, setSelectedCompanyId] = useState("tsla");
  const [depth, setDepth] = useState(3);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("全部产品");
  const [region, setRegion] = useState("全部区域");
  const [sourceType, setSourceType] = useState("全部");
  const [riskOnly, setRiskOnly] = useState(false);
  const [viewMode, setViewMode] = useState("path");
  const [exportStatus, setExportStatus] = useState("");
  const [relationReviews, setRelationReviews] = useState({});
  const [selectedRelId, setSelectedRelId] = useState("tsla-panasonic");
  const [activeNodeId, setActiveNodeId] = useState("tsla");

  const selectedCompany = companyById[selectedCompanyId];
  const graph = useMemo(() => buildGraph(selectedCompanyId, depth), [selectedCompanyId, depth]);
  const selectedRel = graph.relations.find((relation) => relation.id === selectedRelId) ?? graph.relations.find((relation) => relation.depth > 0);
  const selectedPath = useMemo(() => buildPath(selectedRel, graph.relations, selectedCompanyId), [selectedRel, graph.relations, selectedCompanyId]);
  const selectedSourceIds = useMemo(() => {
    const ids = new Set(selectedCompany.sourceIds);
    selectedPath.relations.forEach((relation) => relation.sourceIds.forEach((sourceId) => ids.add(sourceId)));
    return [...ids];
  }, [selectedCompany, selectedPath]);
  const evidenceSources = selectedSourceIds.map((sourceId) => ({ id: sourceId, ...sources[sourceId] })).filter(Boolean);
  const filteredEvidence = evidenceSources.filter((source) => sourceType === "全部" || source.type === sourceType);
  const matrix = matrixByCompany[selectedCompanyId];
  const searchText = search.trim().toLowerCase();
  const categoryMatch = category === "全部产品" || companyCategories[selectedCompanyId]?.includes(category);
  const supplierRelations = useMemo(() => graph.relations.filter(isSupplierRelation), [graph.relations]);
  const selectedReviewStatus = selectedRel ? relationReviews[selectedRel.id] ?? selectedRel.verification?.status ?? "review" : "review";

  useEffect(() => {
    if (!selectedRel || !graph.relations.some((relation) => relation.id === selectedRelId)) {
      setSelectedRelId(graph.relations.find((relation) => relation.depth === 1)?.id ?? graph.relations[0]?.id);
    }
  }, [graph.relations, selectedRel, selectedRelId]);

  function selectCompany(companyId) {
    setSelectedCompanyId(companyId);
    setActiveNodeId(companyId);
    const nextRelation = relationships.find((relation) => relation.company === companyId && relation.depth === 1);
    setSelectedRelId(nextRelation?.id ?? null);
  }

  function selectNode(nodeId) {
    setActiveNodeId(nodeId);
    const incoming = [...graph.relations].reverse().find((relation) => relation.to === nodeId);
    const outgoing = graph.relations.find((relation) => relation.from === nodeId && relation.depth > 0);
    setSelectedRelId(incoming?.id ?? outgoing?.id ?? graph.relations[0]?.id);
  }

  function selectRelation(relationId) {
    const relation = graph.relations.find((item) => item.id === relationId);
    setSelectedRelId(relationId);
    setActiveNodeId(relation?.to ?? selectedCompanyId);
  }

  function resetFilters() {
    setSearch("");
    setCategory("全部产品");
    setRegion("全部区域");
    setSourceType("全部");
    setRiskOnly(false);
    setDepth(3);
  }

  async function exportGraph() {
    const payload = {
      updatedAt,
      company: selectedCompany,
      depth,
      selectedPath,
      relationships: graph.relations,
      nodes: graph.nodeIds.map((nodeId) => nodes[nodeId]),
      sources: evidenceSources,
      supplierRelations,
      relationReviews,
    };
    const text = JSON.stringify(payload, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setExportStatus("JSON 已复制");
    } catch {
      console.info(text);
      setExportStatus("已输出到控制台");
    }
    window.setTimeout(() => setExportStatus(""), 2200);
  }

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div className="brand-block">
          <ShareNetwork weight="duotone" />
          <div>
            <h1>Mag7 供应链情报</h1>
            <span>公告、财报、媒体证据驱动的三级关系图谱</span>
          </div>
        </div>

        <nav className="ticker-strip" aria-label="Mag7 companies">
          {companies.map((company) => {
            const matchesCategory = category === "全部产品" || companyCategories[company.id]?.includes(category);
            return (
              <button
                className={`ticker-button ${selectedCompanyId === company.id ? "active" : ""} ${matchesCategory ? "" : "muted"}`}
                key={company.id}
                onClick={() => selectCompany(company.id)}
              >
                <strong>{company.ticker}</strong>
                <span>{company.shortName}</span>
              </button>
            );
          })}
        </nav>

        <label className="search-box">
          <MagnifyingGlass size={18} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索公司、产品、供应商、材料..."
          />
          {search && (
            <button className="icon-button compact" onClick={() => setSearch("")} aria-label="清空搜索">
              <X size={14} />
            </button>
          )}
        </label>

        <div className="top-actions">
          <SegmentedDepth depth={depth} setDepth={setDepth} />
          <button className={`ghost-button ${riskOnly ? "active" : ""}`} onClick={() => setRiskOnly((value) => !value)}>
            <Gauge size={17} />
            风险叠加
          </button>
          <button className="icon-button" onClick={exportGraph} aria-label="导出当前图谱">
            <DownloadSimple size={20} />
          </button>
          {exportStatus && <span className="export-status">{exportStatus}</span>}
        </div>
      </header>

      <section className="filter-row">
        <SelectControl label="产品类别" icon={<Cpu size={16} />} value={category} onChange={setCategory} options={categoryOptions} />
        <SelectControl label="区域" icon={<GlobeHemisphereEast size={16} />} value={region} onChange={setRegion} options={regions} />
        <SelectControl label="来源类型" icon={<FileText size={16} />} value={sourceType} onChange={setSourceType} options={sourceTypes} />
        <button className="ghost-button slim" onClick={resetFilters}>
          <SlidersHorizontal size={16} />
          重置
        </button>
        <div className="data-note">
          <Database size={16} />
          数据更新：{updatedAt} · 关系 {graph.relations.filter((relation) => relation.depth > 0).length} 条 · 供应商互联 {supplierRelations.length} 条
        </div>
      </section>

      <section className="workspace">
        <aside className="left-panel">
          <CompanyBrief company={selectedCompany} categoryMatch={categoryMatch} />
          <PathLegend />
          <SourceFilter sourceType={sourceType} setSourceType={setSourceType} sources={evidenceSources} />
        </aside>

        <section className="map-section">
          <MapGraph
            activeNodeId={activeNodeId}
            categoryMatch={categoryMatch}
            companyColor={selectedCompany.color}
            depth={depth}
            graph={graph}
            region={region}
            riskOnly={riskOnly}
            searchText={searchText}
            selectedCompanyId={selectedCompanyId}
            selectedRelId={selectedRel?.id}
            selectNode={selectNode}
            selectRelation={selectRelation}
            setViewMode={setViewMode}
            viewMode={viewMode}
          />
          <PathBar company={selectedCompany} depth={depth} path={selectedPath} selectedRel={selectedRel} />
        </section>

        <aside className="matrix-panel">
          <MatrixPanel company={selectedCompany} matrix={matrix} />
          <SupplierRelationsPanel
            relationReviews={relationReviews}
            relations={supplierRelations}
            selectRelation={selectRelation}
            selectedRelId={selectedRel?.id}
          />
          <RelationshipInspector
            onSetReviewStatus={(status) => selectedRel && setRelationReviews((current) => ({ ...current, [selectedRel.id]: status }))}
            path={selectedPath}
            relation={selectedRel}
            reviewStatus={selectedReviewStatus}
            sources={evidenceSources}
          />
        </aside>
      </section>

      <EvidenceDrawer
        company={selectedCompany}
        evidence={filteredEvidence}
        selectedRel={selectedRel}
        selectedSourceIds={selectedSourceIds}
        setSourceType={setSourceType}
        sourceType={sourceType}
      />
    </main>
  );
}

function SelectControl({ icon, label, onChange, options, value }) {
  return (
    <label className="select-control">
      <span>{icon}{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
      <CaretDown size={14} />
    </label>
  );
}

function SegmentedDepth({ depth, setDepth }) {
  return (
    <div className="depth-control" aria-label="探索深度">
      <Path size={17} />
      {[1, 2, 3].map((level) => (
        <button className={depth === level ? "active" : ""} key={level} onClick={() => setDepth(level)}>
          {level}级
        </button>
      ))}
    </div>
  );
}

function CompanyBrief({ categoryMatch, company }) {
  return (
    <section className="panel-block company-brief">
      <div className="panel-kicker">
        <span style={{ background: company.color }} />
        当前入口
      </div>
      <h2>{company.ticker} {company.shortName}</h2>
      <p>{company.focus}</p>
      <div className="brief-grid">
        <Metric label="区域" value={company.region} />
        <Metric label="风险" value={riskLabels[company.risk]} tone={company.risk} />
        <Metric label="证据" value={`${company.sourceIds.length} 类`} />
      </div>
      <p className="brief-copy">{company.summary}</p>
      {!categoryMatch && (
        <div className="notice">
          <WarningCircle size={16} />
          当前公司与产品类别筛选不匹配，图中路径已降低强调。
        </div>
      )}
    </section>
  );
}

function Metric({ label, tone, value }) {
  return (
    <div className={`metric ${tone ? `tone-${tone}` : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PathLegend() {
  return (
    <section className="panel-block legend-block">
      <div className="panel-title">
        <MapPin size={16} />
        图例
      </div>
      <LegendRow color="#54d8ff" label="一级关系 L1" />
      <LegendRow color="#78db62" label="二级关系 L2" />
      <LegendRow color="#f8c14a" label="三级关系 L3" />
      <LegendRow color="#9ff5c8" label="供应商上下游" dashed />
      <LegendRow color="#ff8a3d" label="供应商竞合/替代" dashed />
      <LegendRow color="#ff3b30" label="高风险节点" dotted />
      <LegendRow color="#aab4bd" label="筛选弱化" muted />
    </section>
  );
}

function LegendRow({ color, dashed, dotted, label, muted }) {
  return (
    <div className={`legend-row ${muted ? "muted" : ""}`}>
      <span className={`${dotted ? "dot-ring" : ""} ${dashed ? "line-dashed" : ""}`} style={{ background: dotted || dashed ? "transparent" : color, borderColor: color }} />
      <span>{label}</span>
    </div>
  );
}

function SourceFilter({ sourceType, setSourceType, sources: evidenceSources }) {
  const counts = sourceTypes.map((type) => ({
    type,
    count: type === "全部" ? evidenceSources.length : evidenceSources.filter((source) => source.type === type).length,
  }));
  return (
    <section className="panel-block source-filter">
      <div className="panel-title">
        <Funnel size={16} />
        来源筛选
      </div>
      {counts.map(({ count, type }) => (
        <button className={sourceType === type ? "active" : ""} key={type} onClick={() => setSourceType(type)}>
          <span>{type}</span>
          <strong>{count}</strong>
        </button>
      ))}
    </section>
  );
}

function MapGraph({
  activeNodeId,
  categoryMatch,
  companyColor,
  depth,
  graph,
  region,
  riskOnly,
  searchText,
  selectedCompanyId,
  selectedRelId,
  selectNode,
  selectRelation,
  setViewMode,
  viewMode,
}) {
  const visibleNodes = graph.nodeIds.map((nodeId) => nodes[nodeId]).filter(Boolean);

  function isNodeDimmed(item) {
    const regionMismatch = region !== "全部区域" && !matchesRegion(item.region, region);
    const searchMismatch = searchText && !`${item.label} ${item.name} ${item.region}`.toLowerCase().includes(searchText);
    return !categoryMatch || regionMismatch || searchMismatch;
  }

  function isRelationDimmed(relation) {
    const fromNode = nodes[relation.from];
    const toNode = nodes[relation.to];
    const riskMismatch = riskOnly && relation.risk !== "high";
    const regionMismatch = region !== "全部区域" && !matchesRegion(toNode?.region, region) && !matchesRegion(fromNode?.region, region);
    const searchMismatch = searchText && !`${fromNode?.label} ${fromNode?.name} ${toNode?.label} ${toNode?.name} ${relation.description}`.toLowerCase().includes(searchText);
    const supplyModeMismatch = viewMode === "supply" && !isSupplierRelation(relation);
    return !categoryMatch || riskMismatch || regionMismatch || searchMismatch || supplyModeMismatch;
  }

  return (
    <div className={`map-canvas view-${viewMode}`}>
      <img className="world-map" src="/assets/dark-world-map.png" alt="" />
      <div className="map-vignette" />
      <div className="map-toolbar">
        <button className={`icon-button compact ${viewMode === "path" ? "active" : ""}`} onClick={() => setViewMode("path")} aria-label="聚焦路径"><MapPin size={16} /></button>
        <button className={`icon-button compact ${viewMode === "region" ? "active" : ""}`} onClick={() => setViewMode("region")} aria-label="区域视图"><GlobeHemisphereEast size={16} /></button>
        <button className={`icon-button compact ${viewMode === "supply" ? "active" : ""}`} onClick={() => setViewMode("supply")} aria-label="供应链模式"><PlugsConnected size={16} /></button>
      </div>
      <div className="depth-badge">
        <span>探索深度</span>
        <strong>{depth}级</strong>
      </div>
      <svg className="graph-layer" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="供应链关系图">
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="0.65" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {graph.relations.filter((relation) => relation.depth > 0).map((relation) => {
          const from = positions[relation.from];
          const to = positions[relation.to];
          if (!from || !to) return null;
          const color = edgeColor(relation);
          const dimmed = isRelationDimmed(relation);
          return (
            <g key={relation.id} className={`edge-group scope-${relation.relationScope} ${selectedRelId === relation.id ? "selected" : ""} ${dimmed ? "dimmed" : ""}`}>
              <path
                className="edge-hit"
                d={curvePath(from, to)}
                onClick={() => selectRelation(relation.id)}
              />
              <path
                className="edge-line"
                d={curvePath(from, to)}
                filter={selectedRelId === relation.id ? "url(#glow)" : undefined}
                stroke={color}
                strokeDasharray={edgeDash(relation)}
              />
            </g>
          );
        })}
        {visibleNodes.map((item) => {
          const point = positions[item.id];
          if (!point) return null;
          const isCompany = item.id === selectedCompanyId;
          const active = item.id === activeNodeId;
          const dimmed = item.type !== "company" && isNodeDimmed(item);
          const radius = isCompany ? 4.2 : item.type === "product" ? 2.35 : item.type === "raw" ? 1.25 : 1.75;
          const labelOffset = isCompany ? 4.7 : 2.15;
          return (
            <g
              className={`node-group type-${item.type} ${active ? "active" : ""} ${dimmed ? "dimmed" : ""}`}
              key={item.id}
              onClick={() => selectNode(item.id)}
              tabIndex="0"
            >
              <circle
                cx={point.x}
                cy={point.y}
                r={radius + 0.9}
                className="node-halo"
                style={{ "--node-color": isCompany ? companyColor : riskColor[item.risk] }}
              />
              <circle
                cx={point.x}
                cy={point.y}
                r={radius}
                className="node-dot"
                style={{ "--node-color": isCompany ? companyColor : riskColor[item.risk] }}
              />
              <text
                x={point.x + labelOffset}
                y={point.y - (isCompany ? 1.1 : 0.4)}
                className="node-label"
              >
                {item.label}
              </text>
              <text x={point.x + labelOffset} y={point.y + (isCompany ? 2.2 : 1.8)} className="node-sub">
                {item.region}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="map-note">
        <span style={{ background: companyColor }} />
        {nodes[selectedCompanyId].label} {viewModeLabel(viewMode)} · 点击节点或连线查看证据
      </div>
    </div>
  );
}

function PathBar({ company, depth, path, selectedRel }) {
  return (
    <div className="path-bar">
      <div className="path-trail">
        <span className="path-label">已选路径</span>
        {path.nodes.map((nodeId, index) => (
          <span className="crumb" key={`${nodeId}-${index}`}>
            {index > 0 && <LinkSimple size={13} />}
            {nodes[nodeId]?.label ?? nodeId}
          </span>
        ))}
      </div>
      <div className="path-meta">
        <span>{company.ticker}</span>
        <span>L1 → L2 → L3（当前 {Math.min(depth, selectedRel?.depth ?? depth)} 级）</span>
        <span className={`risk-pill ${selectedRel?.risk ?? "medium"}`}>{riskLabels[selectedRel?.risk] ?? "中"}风险</span>
      </div>
    </div>
  );
}

function MatrixPanel({ company, matrix }) {
  return (
    <section className="matrix-card">
      <div className="matrix-head">
        <div>
          <h2>产品 × 供应商矩阵</h2>
          <p>{company.ticker} {company.shortName}</p>
        </div>
        <div className="confidence-key">
          <span><i className="cell-high" />高</span>
          <span><i className="cell-medium" />中</span>
          <span><i className="cell-low" />低</span>
        </div>
      </div>
      <div className="matrix-scroll">
        <table>
          <thead>
            <tr>
              <th>产品 / 材料 / 服务</th>
              {matrix.columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((row) => (
              <tr key={row.label}>
                <td>{row.label}</td>
                {row.values.map((value, index) => (
                  <td className={`heat-cell ${heatClass(value)}`} key={`${row.label}-${index}`}>
                    {value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SupplierRelationsPanel({ relationReviews, relations, selectRelation, selectedRelId }) {
  const openItems = relations.filter((relation) => {
    const status = relationReviews[relation.id] ?? relation.verification?.status ?? "review";
    return status !== "verified";
  }).length;
  return (
    <section className="supplier-relations-card">
      <div className="supplier-relations-head">
        <div>
          <h2>供应商互联</h2>
          <p>上下游、设备材料、竞合/替代关系</p>
        </div>
        <span>{relations.length} 条 · {openItems} 待核</span>
      </div>
      <div className="supplier-relation-list">
        {relations.map((relation) => {
          const fromNode = nodes[relation.from];
          const toNode = nodes[relation.to];
          const status = relationReviews[relation.id] ?? relation.verification?.status ?? "review";
          return (
            <button
              className={`supplier-relation-row ${selectedRelId === relation.id ? "active" : ""}`}
              key={relation.id}
              onClick={() => selectRelation(relation.id)}
            >
              <span className={`scope-dot ${relation.relationScope}`} />
              <span className="supplier-relation-main">
                <strong>{fromNode?.label} → {toNode?.label}</strong>
                <em>{relationScopeLabels[relation.relationScope]} · {relation.relationType}</em>
              </span>
              <span className={`review-chip ${status}`}>{verificationStatusLabels[status]}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function RelationshipInspector({ onSetReviewStatus, path, relation, reviewStatus, sources: evidenceSources }) {
  const toNode = relation ? nodes[relation.to] : null;
  const fromNode = relation ? nodes[relation.from] : null;
  const relevantSources = relation?.sourceIds.map((sourceId) => ({ id: sourceId, ...sources[sourceId] })).filter(Boolean) ?? [];
  const verification = relation?.verification;
  return (
    <section className="inspector-card">
      <div className="inspector-head">
        <div>
          <span>关系详情</span>
          <h3>{fromNode?.label} → {toNode?.label}</h3>
        </div>
        <span className={`risk-pill ${relation?.risk ?? "medium"}`}>{riskLabels[relation?.risk] ?? "中"}</span>
      </div>
      <p>{relation?.description ?? "选择一条关系查看证据。"}</p>
      <div className="inspector-grid">
        <Metric label="关系类型" value={relation?.relationType ?? "-"} />
        <Metric label="关系范围" value={relationScopeLabels[relation?.relationScope] ?? `${relation?.depth ?? 0}级`} />
        <Metric label="置信度" value={riskLabels[relation?.confidence] ?? "中"} />
      </div>
      <div className="verification-panel">
        <div className="verification-topline">
          <div>
            <span>质疑 / 核验机制</span>
            <strong>{verification?.evidenceScore ?? 0}/100</strong>
          </div>
          <span className={`review-chip ${reviewStatus}`}>{verificationStatusLabels[reviewStatus]}</span>
        </div>
        <div className="review-actions" role="group" aria-label="关系核验状态">
          <button className={reviewStatus === "challenged" ? "active" : ""} onClick={() => onSetReviewStatus("challenged")}>
            <Question size={14} />
            质疑
          </button>
          <button className={reviewStatus === "review" ? "active" : ""} onClick={() => onSetReviewStatus("review")}>
            <ListChecks size={14} />
            复核中
          </button>
          <button className={reviewStatus === "verified" ? "active" : ""} onClick={() => onSetReviewStatus("verified")}>
            <CheckCircle size={14} />
            可靠
          </button>
        </div>
        <div className="verification-grid">
          <div>
            <span><ShieldCheck size={14} />核验清单</span>
            <ul>
              {(verification?.checklist ?? []).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <span><WarningCircle size={14} />主要疑点</span>
            <ul>
              {(verification?.doubts?.length ? verification.doubts : ["暂无核心疑点，按季度复核即可"]).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
        <p className="next-action">下一步：{verification?.nextAction ?? "选择关系后查看复核建议"}</p>
      </div>
      <div className="path-stack">
        {path.nodes.map((nodeId, index) => (
          <span key={`${nodeId}-${index}`}>{nodes[nodeId]?.label}</span>
        ))}
      </div>
      <div className="mini-sources">
        {relevantSources.map((source) => (
          <a href={source.url} key={source.id} target="_blank" rel="noreferrer">
            <FileText size={14} />
            {source.type} · {source.publisher}
          </a>
        ))}
        {!relevantSources.length && evidenceSources.slice(0, 2).map((source) => (
          <a href={source.url} key={source.id} target="_blank" rel="noreferrer">
            <FileText size={14} />
            {source.type} · {source.publisher}
          </a>
        ))}
      </div>
    </section>
  );
}

function EvidenceDrawer({ company, evidence, selectedRel, selectedSourceIds, setSourceType, sourceType }) {
  return (
    <footer className="evidence-drawer">
      <div className="drawer-head">
        <div>
          <span>来源证据</span>
          <h2>
            {company.ticker} {selectedRel ? `→ ${nodes[selectedRel.to]?.label}` : ""} · {sourceType}
          </h2>
        </div>
        <div className="drawer-meta">
          <span>路径来源 {selectedSourceIds.length}</span>
          <span>展示 {evidence.length}</span>
          <button className="ghost-button slim" onClick={() => setSourceType("全部")}>
            查看全部证据
          </button>
        </div>
      </div>
      <div className="evidence-list">
        {evidence.map((source) => (
          <article className="evidence-card" key={source.id}>
            <div className="source-chip">{source.type}</div>
            <h3>{source.title}</h3>
            <p>{source.publisher} · {source.date}</p>
            <div className="card-foot">
              <span className="confidence-dots" aria-label="置信度">
                <i />
                <i />
                <i className={source.type === "媒体" ? "empty" : ""} />
              </span>
              <a href={source.url} target="_blank" rel="noreferrer">
                打开来源
                <ArrowSquareOut size={14} />
              </a>
            </div>
          </article>
        ))}
      </div>
    </footer>
  );
}

function buildGraph(companyId, maxDepth) {
  const relationIds = new Set();
  const relationList = [];
  const nodeIds = new Set([companyId]);
  let changed = true;

  while (changed) {
    changed = false;
    for (const relation of relationships) {
      if (relation.depth > maxDepth) continue;
      if (relation.company !== companyId && relation.company !== "global") continue;
      if (!nodeIds.has(relation.from)) continue;
      if (relationIds.has(relation.id)) continue;
      relationIds.add(relation.id);
      relationList.push(relation);
      if (!nodeIds.has(relation.to)) {
        nodeIds.add(relation.to);
        changed = true;
      }
    }
  }

  return { relations: relationList, nodeIds: [...nodeIds] };
}

function buildPath(relation, relationList, companyId) {
  if (!relation) return { nodes: [companyId], relations: [] };
  const parentByNode = new Map();
  relationList.forEach((item) => {
    if (!parentByNode.has(item.to)) parentByNode.set(item.to, item);
  });
  const rels = [];
  const nodePath = [relation.to];
  let cursor = relation.to;
  let guard = 0;
  while (parentByNode.has(cursor) && guard < 8) {
    const parent = parentByNode.get(cursor);
    rels.unshift(parent);
    nodePath.unshift(parent.from);
    cursor = parent.from;
    guard += 1;
  }
  if (nodePath[0] !== companyId) nodePath.unshift(companyId);
  return { nodes: [...new Set(nodePath)], relations: rels };
}

function curvePath(from, to) {
  const bend = Math.abs(to.y - from.y) > 18 ? 0.35 : 0.48;
  const c1x = from.x + (to.x - from.x) * bend;
  const c2x = from.x + (to.x - from.x) * 0.72;
  return `M ${from.x} ${from.y} C ${c1x} ${from.y}, ${c2x} ${to.y}, ${to.x} ${to.y}`;
}

function matchesRegion(nodeRegion = "", selectedRegion) {
  if (selectedRegion === "全球") return nodeRegion.includes("全球") || nodeRegion.includes("/") || nodeRegion.includes("美国");
  if (selectedRegion === "欧洲") return ["荷兰", "德国", "欧洲"].some((regionName) => nodeRegion.includes(regionName));
  return nodeRegion.includes(selectedRegion);
}

function heatClass(value) {
  if (value === "高") return "high";
  if (value === "中") return "medium";
  return "low";
}

function isSupplierRelation(relation) {
  return relation?.relationScope === "supplierSupplier" || relation?.relationScope === "supplierPeer";
}

function edgeColor(relation) {
  if (relation.relationScope === "supplierPeer") return "#ff8a3d";
  if (relation.relationScope === "supplierSupplier") return relation.depth === 3 ? "#f7c948" : "#9ff5c8";
  if (relation.depth === 1) return "#52d8ff";
  if (relation.depth === 2) return "#77d86a";
  return "#f7c948";
}

function edgeDash(relation) {
  if (relation.relationScope === "supplierPeer") return "1.2 1.6";
  if (relation.relationScope === "supplierSupplier") return relation.depth === 3 ? "1.5 1.25" : "3 1.25";
  if (relation.depth === 3) return "1.4 1.4";
  return undefined;
}

function viewModeLabel(viewMode) {
  if (viewMode === "region") return "区域风险";
  if (viewMode === "supply") return "供应商层级";
  return "路径映射";
}

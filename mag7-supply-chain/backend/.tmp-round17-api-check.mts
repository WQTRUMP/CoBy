import { readFile } from 'node:fs/promises';
import { buildApp } from './src/app.ts';
import {
  loadNormalizedImportPackage,
  prepareNormalizedImport,
  type PreparedNormalizedImport,
} from './src/lib/normalized-package.ts';
import type { CacheClient } from './src/lib/redis.ts';
import type { GraphRepository, Neo4jHealth } from './src/lib/neo4j.ts';
import type {
  CompanyDetailDTO,
  CompanyListQuery,
  CompanyOverviewDTO,
  CompanySearchMatchDTO,
  EvidenceDTO,
  GraphNodeDTO,
  GraphPathQuery,
  GraphStatsDTO,
  GraphStatsQuery,
  RelationDTO,
  SnapshotDTO,
  SubgraphDTO,
  SubgraphQuery,
  SearchCompaniesQuery,
  SuggestCompaniesQuery,
} from '@mag7/contracts';

const FULL_PACKAGE_DIR = '/workspace/agents/evidence-collector/output/mag7-full-package';
const FULL_PACKAGE_MANIFEST = `${FULL_PACKAGE_DIR}/mag7-full-package-manifest.json`;
const cache = new Map();
const cacheClient = {
  enabled: true,
  async get(key) { return cache.get(key) ?? null; },
  async set(key, value) { cache.set(key, value); },
  async del(key) { cache.delete(key); },
  async health() { return { status: 'up', enabled: true, detail: 'test cache', required: true }; },
  async close() {},
} satisfies CacheClient;
function matchesSnapshot(snapshotId: string, snapshotQuery: string) { return snapshotQuery === 'published' ? true : snapshotId === snapshotQuery; }
function compareSnapshotRecency(left: Pick<SnapshotDTO,'publishedAt'|'id'> | null, right: Pick<SnapshotDTO,'publishedAt'|'id'> | null) {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return (right.publishedAt ?? '').localeCompare(left.publishedAt ?? '') || right.id.localeCompare(left.id);
}
function pickLatestSnapshot(snapshots: SnapshotDTO[]) { return [...snapshots].sort(compareSnapshotRecency)[0] ?? null; }
function normalizeSearchValue(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, ''); }
function buildSearchMatch(company: CompanyDetailDTO, query: string): CompanySearchMatchDTO | undefined {
  const normalizedQuery = normalizeSearchValue(query);
  const directCandidates: Array<{ field: CompanySearchMatchDTO['field']; value?: string }> = [
    { field: 'ticker', value: company.ticker },
    { field: 'displayName', value: company.displayName },
    { field: 'canonicalName', value: company.canonicalName },
    { field: 'name', value: company.name },
  ];
  for (const candidate of directCandidates) {
    if (candidate.value && normalizeSearchValue(candidate.value).includes(normalizedQuery)) {
      return { field: candidate.field, value: candidate.value, explanation: `Matched ${candidate.field} \"${candidate.value}\".` };
    }
  }
  const aliasRecords = [ ...(company.entityProfile?.aliases ?? []), ...(company.entityProfile?.legalEntities ?? []), ...(company.entityProfile?.brands ?? []), ];
  for (const alias of aliasRecords) {
    if (normalizeSearchValue(alias.normalizedName || alias.name).includes(normalizedQuery)) {
      return { field: 'alias', value: alias.name, aliasType: alias.aliasType, explanation: `Matched ${alias.aliasType} alias \"${alias.name}\" for canonical \"${company.canonicalName ?? company.name}\".` };
    }
  }
  for (const alias of company.aliases) {
    if (normalizeSearchValue(alias).includes(normalizedQuery)) {
      return { field: 'alias', value: alias, explanation: `Matched legacy alias \"${alias}\" for canonical \"${company.canonicalName ?? company.name}\".` };
    }
  }
}
function sortCompaniesForSearch(left: CompanyDetailDTO, right: CompanyDetailDTO, query: string) {
  const priority = ['ticker','displayName','canonicalName','name','alias'];
  const leftPriority = priority.indexOf(buildSearchMatch(left, query)?.field ?? 'alias');
  const rightPriority = priority.indexOf(buildSearchMatch(right, query)?.field ?? 'alias');
  return leftPriority - rightPriority || Number(right.isMag7) - Number(left.isMag7) || (right.marketCapUsd ?? 0) - (left.marketCapUsd ?? 0) || (left.displayName ?? left.name).localeCompare(right.displayName ?? right.name);
}
function pickLatestRelationSnapshotId(relations: Array<Pick<RelationDTO,'snapshotId'|'lastVerifiedAt'>>) {
  return [...relations].sort((left,right)=>(right.lastVerifiedAt ?? '').localeCompare(left.lastVerifiedAt ?? '') || right.snapshotId.localeCompare(left.snapshotId))[0]?.snapshotId ?? null;
}
function buildCompanyDetails(prepared: PreparedNormalizedImport) {
  const byId = new Map<string, CompanyDetailDTO>();
  const relationByCompany = new Map<string, { snapshotId: string; lastVerifiedAt: string | null }>();
  for (const edge of prepared.relationEdges) {
    const relation = prepared.relations.find((item) => item.id === edge.relationId);
    if (!relation) continue;
    const current = relationByCompany.get(edge.targetCompanyId);
    const next = { snapshotId: edge.snapshotId, lastVerifiedAt: relation.lastVerifiedAt };
    if (!current || compareSnapshotRecency({ id: next.snapshotId, publishedAt: next.lastVerifiedAt }, { id: current.snapshotId, publishedAt: current.lastVerifiedAt }) < 0) relationByCompany.set(edge.targetCompanyId, next);
  }
  for (const company of prepared.companies) {
    const active = relationByCompany.get(company.id);
    byId.set(company.id, { ...company, primaryRegion: company.country, activeSnapshotId: active?.snapshotId ?? null, summary: company.description, lastUpdatedAt: active?.lastVerifiedAt ?? null });
  }
  return byId;
}
function buildSubgraph(companyById: Map<string, CompanyDetailDTO>, prepared: PreparedNormalizedImport, relations: RelationDTO[]): SubgraphDTO {
  const nodeMap = new Map<string, GraphNodeDTO>();
  for (const relation of relations) {
    const source = companyById.get(relation.sourceId);
    const target = companyById.get(relation.targetId);
    if (source) nodeMap.set(source.id, { id: source.id, entityType: 'Company', label: source.displayName ?? source.name, company: source, country: source.country, marketCapUsd: source.marketCapUsd, importanceScore: source.importanceScore });
    if (target) nodeMap.set(target.id, { id: target.id, entityType: 'Company', label: target.displayName ?? target.name, company: target, country: target.country, marketCapUsd: target.marketCapUsd, importanceScore: target.importanceScore });
  }
  const snapshot = pickLatestSnapshot(relations.map((relation) => prepared.snapshots.find((s) => s.id === relation.snapshotId) ?? null).filter(Boolean) as SnapshotDTO[]);
  return { snapshot: snapshot ?? { id: pickLatestRelationSnapshotId(relations) ?? 'snapshot:published', version: (pickLatestRelationSnapshotId(relations) ?? 'snapshot:published').replace('snapshot:','').replace(/-/g,'.'), status: 'published', publishedAt: null, scope: [], notes: null }, nodes: [...nodeMap.values()], relations };
}
class Repo implements GraphRepository {
  source = 'neo4j' as const;
  private readonly companyById: Map<string, CompanyDetailDTO>;
  private readonly evidenceByRelationId = new Map<string, EvidenceDTO[]>();
  private readonly relationById = new Map<string, RelationDTO>();
  constructor(private readonly prepared: PreparedNormalizedImport) {
    this.companyById = buildCompanyDetails(prepared);
    for (const relation of prepared.relations) {
      this.relationById.set(relation.id, {
        ...relation,
        sourceId: prepared.relationEdges.find((edge) => edge.relationId === relation.id)?.sourceCompanyId ?? '',
        targetId: prepared.relationEdges.find((edge) => edge.relationId === relation.id)?.targetCompanyId ?? '',
        status: relation.status as RelationDTO['status'],
        skuGranularityDetail: relation.skuGranularityDetailValue && relation.skuGranularitySource ? { value: relation.skuGranularityDetailValue, source: relation.skuGranularitySource, raw: relation.skuGranularityRaw, note: relation.skuGranularityNote, isBackfilled: relation.skuGranularityIsBackfilled } : null,
      });
    }
    for (const binding of prepared.evidenceBindings) {
      const evidenceNode = prepared.evidence.find((item) => item.id === binding.evidenceId);
      if (!evidenceNode) continue;
      const evidence: EvidenceDTO = {
        id: evidenceNode.id,
        sourceType: evidenceNode.sourceType,
        skuGranularity: evidenceNode.skuGranularity,
        skuGranularityDetail: evidenceNode.skuGranularityDetailValue && evidenceNode.skuGranularitySource ? { value: evidenceNode.skuGranularityDetailValue, source: evidenceNode.skuGranularitySource, raw: evidenceNode.skuGranularityRaw, note: evidenceNode.skuGranularityNote, isBackfilled: evidenceNode.skuGranularityIsBackfilled } : null,
        title: evidenceNode.title,
        publisher: evidenceNode.publisher,
        url: evidenceNode.url,
        publishedAt: evidenceNode.publishedAt,
        publishedAtResolution: evidenceNode.publishedAtResolution,
        coverageStart: evidenceNode.coverageStart,
        coverageEnd: evidenceNode.coverageEnd,
        coverageStartResolution: evidenceNode.coverageStartResolution,
        coverageEndResolution: evidenceNode.coverageEndResolution,
        retrievedAt: evidenceNode.retrievedAt,
        excerpt: evidenceNode.excerpt,
        pageRef: evidenceNode.pageRef,
        language: evidenceNode.language,
        hash: evidenceNode.hash,
        sourceDomain: evidenceNode.sourceDomain,
        citationText: evidenceNode.citationText,
        reliabilityTier: evidenceNode.reliabilityTier,
        licenseNote: evidenceNode.licenseNote,
        parserVersion: evidenceNode.parserVersion,
      };
      const current = this.evidenceByRelationId.get(binding.relationId) ?? [];
      current.push(evidence);
      this.evidenceByRelationId.set(binding.relationId, current);
    }
  }
  async listCompanies(query: CompanyListQuery) { return [...this.companyById.values()].filter((company) => (query.isMag7 === undefined ? true : company.isMag7 === query.isMag7)).map((company)=>({ id: company.id, ticker: company.ticker, name: company.name, canonicalName: company.canonicalName, displayName: company.displayName, isMag7: company.isMag7, marketCapUsd: company.marketCapUsd, entityProfile: company.entityProfile, primaryRegion: company.primaryRegion, activeSnapshotId: company.activeSnapshotId })); }
  async searchCompanies(query: SearchCompaniesQuery) { return [...this.companyById.values()].filter((company) => (query.isMag7 === undefined ? true : company.isMag7 === query.isMag7)).filter((company) => Boolean(buildSearchMatch(company, query.q))).sort((left, right) => sortCompaniesForSearch(left, right, query.q)).slice(0, query.limit).map((company)=>({ id: company.id, ticker: company.ticker, name: company.name, isMag7: company.isMag7, marketCapUsd: company.marketCapUsd, primaryRegion: company.primaryRegion, activeSnapshotId: company.activeSnapshotId, canonicalName: company.canonicalName, displayName: company.displayName, entityProfile: company.entityProfile, match: buildSearchMatch(company, query.q) })); }
  async suggestCompanies(query: SuggestCompaniesQuery) { return [...this.companyById.values()].filter((company) => Boolean(buildSearchMatch(company, query.q))).sort((left, right) => sortCompaniesForSearch(left, right, query.q)).slice(0, query.limit).map((company)=>({ id: company.id, label: company.ticker ? `${company.displayName ?? company.name} (${company.ticker})` : (company.displayName ?? company.name), secondaryLabel: company.canonicalName && company.canonicalName !== company.displayName ? company.canonicalName : undefined, ticker: company.ticker, isMag7: company.isMag7, canonicalName: company.canonicalName, displayName: company.displayName, entityProfile: company.entityProfile, match: buildSearchMatch(company, query.q) })); }
  async getCompany(companyId: string) { return this.companyById.get(companyId) ?? null; }
  async getCompanyOverview(companyId: string): Promise<CompanyOverviewDTO | null> {
    const company = this.companyById.get(companyId); if (!company) return null;
    const relatedRelations = [...this.relationById.values()].filter((relation) => relation.sourceId === companyId || relation.targetId === companyId);
    return { companyId, companyName: company.name, activeSnapshotId: company.activeSnapshotId, totalRelations: relatedRelations.length, tier1SupplierCount: relatedRelations.filter((relation) => relation.tier === 1).length, supplierCount: new Set(relatedRelations.map((relation) => relation.sourceId)).size, highRiskRelationCount: relatedRelations.filter((relation) => relation.confidence !== 'confirmed').length, evidenceCount: relatedRelations.reduce((sum, relation) => sum + relation.evidenceCount, 0), evidenceCoverage: relatedRelations.length === 0 ? 0 : relatedRelations.filter((relation) => relation.evidenceCount > 0).length / relatedRelations.length, lastUpdatedAt: company.lastUpdatedAt ?? null, source: this.source };
  }
  async getSubgraph(query: SubgraphQuery): Promise<SubgraphDTO> {
    const rootCompany = this.companyById.get(query.companyId) ?? null;
    const relations = [...this.relationById.values()].filter((relation)=>relation.depthFromMag7 <= query.depth).filter((relation)=>matchesSnapshot(relation.snapshotId, query.snapshot)).filter((relation)=>!query.relationshipTypes || query.relationshipTypes.includes(relation.relationshipType)).filter((relation)=>relation.sourceId === query.companyId || relation.targetId === query.companyId).map((relation)=>({ ...relation, evidence: query.includeEvidence ? this.evidenceByRelationId.get(relation.id) ?? [] : undefined }));
    if (relations.length === 0) return { snapshot: { id: rootCompany?.activeSnapshotId ?? 'snapshot:published', version: (rootCompany?.activeSnapshotId ?? 'snapshot:published').replace('snapshot:','').replace(/-/g,'.'), status: 'published', publishedAt: null, scope: rootCompany ? [rootCompany.id] : [], notes: 'No matching relations for this snapshot filter.' }, nodes: rootCompany ? [{ id: rootCompany.id, entityType: 'Company', label: rootCompany.displayName ?? rootCompany.name, company: rootCompany, country: rootCompany.country, marketCapUsd: rootCompany.marketCapUsd, importanceScore: rootCompany.importanceScore }] : [], relations: [] };
    return buildSubgraph(this.companyById, this.prepared, relations);
  }
  async getPath(query: GraphPathQuery): Promise<SubgraphDTO> {
    const directRelations = [...this.relationById.values()].filter((relation)=>relation.depthFromMag7 <= query.maxDepth).filter((relation)=>matchesSnapshot(relation.snapshotId, query.snapshot)).filter((relation)=>(relation.sourceId === query.sourceCompanyId && relation.targetId === query.targetCompanyId) || (relation.sourceId === query.targetCompanyId && relation.targetId === query.sourceCompanyId)).map((relation)=>({ ...relation, evidence: query.includeEvidence ? this.evidenceByRelationId.get(relation.id) ?? [] : undefined }));
    return directRelations.length === 0 ? { snapshot: { id: 'snapshot:published', version: 'published', status: 'published', publishedAt: null, scope: [], notes: 'No path found.' }, nodes: [], relations: [] } : buildSubgraph(this.companyById, this.prepared, directRelations);
  }
  async getGraphStats(query: GraphStatsQuery): Promise<GraphStatsDTO> {
    const scopedRelations = [...this.relationById.values()].filter((relation)=>matchesSnapshot(relation.snapshotId, query.snapshot) && (!query.companyId || relation.sourceId === query.companyId || relation.targetId === query.companyId));
    const companyIds = new Set<string>(); const mag7Ids = new Set<string>(); const relationshipTypeBreakdown: Record<string, number> = {}; const confidenceBreakdown: Record<string, number> = {}; const evidenceIds = new Set<string>();
    for (const relation of scopedRelations) { companyIds.add(relation.sourceId); companyIds.add(relation.targetId); if (this.companyById.get(relation.sourceId)?.isMag7) mag7Ids.add(relation.sourceId); if (this.companyById.get(relation.targetId)?.isMag7) mag7Ids.add(relation.targetId); relationshipTypeBreakdown[relation.relationshipType] = (relationshipTypeBreakdown[relation.relationshipType] ?? 0) + 1; confidenceBreakdown[relation.confidence] = (confidenceBreakdown[relation.confidence] ?? 0) + 1; for (const evidenceId of relation.evidenceIds) evidenceIds.add(evidenceId); }
    const snapshot = pickLatestSnapshot(scopedRelations.map((relation) => this.prepared.snapshots.find((s) => s.id === relation.snapshotId) ?? null).filter(Boolean) as SnapshotDTO[]);
    return { snapshot, companyCount: companyIds.size, relationCount: scopedRelations.length, evidenceCount: evidenceIds.size, mag7CompanyCount: mag7Ids.size, relationshipTypeBreakdown, confidenceBreakdown, source: this.source };
  }
  async getRelationEvidence(relationId: string) { return this.evidenceByRelationId.get(relationId) ?? []; }
  async importNormalizedPackage(payload: PreparedNormalizedImport) { return { companyCount: payload.companies.length, relationCount: payload.relations.length, evidenceCount: payload.evidence.length, snapshotCount: payload.snapshots.length }; }
}
const companyMap = { Apple: 'company:AAPL', Alphabet: 'company:GOOGL', Meta: 'company:META', Tesla: 'company:TSLA' } as const;
const sampleRelationIds = {
  Apple: 'rel:apple:ups:logistics:launch-air-hub-delivery-sorting',
  Alphabet: 'rel:alphabet:padget-electronics:manufacturing:pixel-contract-manufacturing-india',
  Meta: 'rel:meta:amd:component_supply:ai-infrastructure-instinct-epyc-rack-scale-systems',
  Tesla: 'rel:tesla:panasonic:manufacturing:battery-cell-production-equipment-finance-lease',
} as const;
const [pkg, manifestRaw] = await Promise.all([
  loadNormalizedImportPackage(`${FULL_PACKAGE_DIR}/relations.jsonl`, `${FULL_PACKAGE_DIR}/evidence.jsonl`),
  readFile(FULL_PACKAGE_MANIFEST, 'utf8'),
]);
const manifest = JSON.parse(manifestRaw);
const prepared = prepareNormalizedImport(pkg);
const app = await buildApp({ cacheClient, graphRepository: new Repo(prepared), neo4jHealth: async (): Promise<Neo4jHealth> => ({ status: 'up', detail: 'full-package sample repository', required: true }), runtimeMode: 'live' });
const results: any = { manifest: { package_snapshot_id: manifest.package_snapshot_id, authoritative_snapshot: manifest.authoritative_snapshot, baseline_snapshot_id: manifest.coverage_summary?.baseline_snapshot_id, formal_net_new_by_company: manifest.coverage_summary?.formal_net_new_by_company, candidate_only: manifest.coverage_summary?.candidate_only }, companies: {}, boundarySummary: { relationSkuGranularityCounts: {}, evidenceSkuGranularityCounts: {}, datePrecisionCounts: {}, confidenceCounts: {}, sourceTypeCounts: {} } };
for (const [companyName, companyId] of Object.entries(companyMap)) {
  const [detailRes, overviewRes, subgraphRes, statsRes] = await Promise.all([
    app.inject({ method: 'GET', url: `/api/v1/companies/${encodeURIComponent(companyId)}` }),
    app.inject({ method: 'GET', url: `/api/v1/companies/${encodeURIComponent(companyId)}/overview` }),
    app.inject({ method: 'GET', url: `/api/v1/graph/subgraph?companyId=${encodeURIComponent(companyId)}&depth=3&snapshot=published&includeEvidence=true` }),
    app.inject({ method: 'GET', url: `/api/v1/graph/stats?snapshot=published&companyId=${encodeURIComponent(companyId)}` }),
  ]);
  const detail = detailRes.json();
  const overview = overviewRes.json();
  const subgraph = subgraphRes.json();
  const stats = statsRes.json();
  const sampleRelationId = sampleRelationIds[companyName as keyof typeof sampleRelationIds];
  const sampleRelation = subgraph.relations.find((r: any) => r.id === sampleRelationId);
  const pathRes = await app.inject({ method: 'GET', url: `/api/v1/graph/path?sourceCompanyId=${encodeURIComponent(sampleRelation.sourceId)}&targetCompanyId=${encodeURIComponent(sampleRelation.targetId)}&maxDepth=1&snapshot=published&includeEvidence=true` });
  const evidenceRes = await app.inject({ method: 'GET', url: `/api/v1/relations/${encodeURIComponent(sampleRelationId)}/evidence` });
  const path = pathRes.json();
  const evidence = evidenceRes.json();
  const relationSkuCounts: Record<string, number> = {};
  const evidenceSkuCounts: Record<string, number> = {};
  const datePrecisionCounts: Record<string, number> = {};
  const confidenceCounts: Record<string, number> = {};
  const sourceTypeCounts: Record<string, number> = {};
  for (const relation of subgraph.relations) {
    relationSkuCounts[String(relation.skuGranularity ?? 'null')] = (relationSkuCounts[String(relation.skuGranularity ?? 'null')] ?? 0) + 1;
    datePrecisionCounts[String(relation.evidenceDateResolution ?? 'null')] = (datePrecisionCounts[String(relation.evidenceDateResolution ?? 'null')] ?? 0) + 1;
    confidenceCounts[String(relation.confidence ?? 'null')] = (confidenceCounts[String(relation.confidence ?? 'null')] ?? 0) + 1;
    for (const ev of relation.evidence ?? []) {
      evidenceSkuCounts[String(ev.skuGranularity ?? 'null')] = (evidenceSkuCounts[String(ev.skuGranularity ?? 'null')] ?? 0) + 1;
      sourceTypeCounts[String(ev.sourceType ?? 'null')] = (sourceTypeCounts[String(ev.sourceType ?? 'null')] ?? 0) + 1;
    }
  }
  results.companies[companyName] = {
    companyId,
    detailStatus: detailRes.statusCode,
    overviewStatus: overviewRes.statusCode,
    subgraphStatus: subgraphRes.statusCode,
    statsStatus: statsRes.statusCode,
    pathStatus: pathRes.statusCode,
    evidenceStatus: evidenceRes.statusCode,
    detail: { canonicalName: detail.canonicalName, displayName: detail.displayName, activeSnapshotId: detail.activeSnapshotId },
    overview: { totalRelations: overview.totalRelations, tier1SupplierCount: overview.tier1SupplierCount, evidenceCount: overview.evidenceCount, source: overview.source },
    subgraph: { snapshot: subgraph.snapshot, relationCount: subgraph.relations.length, nodeCount: subgraph.nodes.length, relationshipTypes: [...new Set(subgraph.relations.map((r: any) => r.relationshipType))].sort(), confidences: [...new Set(subgraph.relations.map((r: any) => r.confidence))].sort() },
    stats: { snapshot: stats.snapshot, relationCount: stats.relationCount, evidenceCount: stats.evidenceCount, relationshipTypeBreakdown: stats.relationshipTypeBreakdown, confidenceBreakdown: stats.confidenceBreakdown, source: stats.source },
    sampleRelation: { id: sampleRelation.id, sourceId: sampleRelation.sourceId, targetId: sampleRelation.targetId, relationshipType: sampleRelation.relationshipType, relationshipSubtype: sampleRelation.relationshipSubtype, confidence: sampleRelation.confidence, evidenceDate: sampleRelation.evidenceDate, evidenceDateResolution: sampleRelation.evidenceDateResolution, skuGranularity: sampleRelation.skuGranularity, evidenceCount: sampleRelation.evidenceCount, sourceDomain: sampleRelation.evidence?.[0]?.sourceDomain ?? null, sourceType: sampleRelation.evidence?.[0]?.sourceType ?? null },
    path: { relationCount: path.relations.length, snapshot: path.snapshot, relationIds: path.relations.map((r: any) => r.id) },
    evidence: evidence.map((ev: any) => ({ id: ev.id, sourceType: ev.sourceType, sourceDomain: ev.sourceDomain, publishedAt: ev.publishedAt, publishedAtResolution: ev.publishedAtResolution, skuGranularity: ev.skuGranularity, reliabilityTier: ev.reliabilityTier })),
    boundaryCounts: { relationSkuCounts, evidenceSkuCounts, datePrecisionCounts, confidenceCounts, sourceTypeCounts },
  };
  for (const [k,v] of Object.entries(relationSkuCounts)) results.boundarySummary.relationSkuGranularityCounts[k] = (results.boundarySummary.relationSkuGranularityCounts[k] ?? 0) + Number(v);
  for (const [k,v] of Object.entries(evidenceSkuCounts)) results.boundarySummary.evidenceSkuGranularityCounts[k] = (results.boundarySummary.evidenceSkuGranularityCounts[k] ?? 0) + Number(v);
  for (const [k,v] of Object.entries(datePrecisionCounts)) results.boundarySummary.datePrecisionCounts[k] = (results.boundarySummary.datePrecisionCounts[k] ?? 0) + Number(v);
  for (const [k,v] of Object.entries(confidenceCounts)) results.boundarySummary.confidenceCounts[k] = (results.boundarySummary.confidenceCounts[k] ?? 0) + Number(v);
  for (const [k,v] of Object.entries(sourceTypeCounts)) results.boundarySummary.sourceTypeCounts[k] = (results.boundarySummary.sourceTypeCounts[k] ?? 0) + Number(v);
}
await app.close();
console.log(JSON.stringify(results, null, 2));

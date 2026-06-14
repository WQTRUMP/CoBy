import type {
  CompanyDetailResponseDTO,
  CompanyDetailDTO,
  CompanyListItemDTO,
  CompanyListResponseDTO,
  CompanyOverviewDTO,
  CompanySearchResultItemDTO,
  CompanySuggestItemDTO,
  EvidenceDTO,
  RelationDTO,
  RelationEvidenceResponseDTO,
  SearchCompaniesResponseDTO,
  SubgraphDTO,
  SuggestCompaniesResponseDTO,
} from "@mag7/contracts";
import type {
  CompanyOptionViewModel,
  CompanyOverviewViewModel,
  CompanyProfileViewModel,
  EvidenceSummaryViewModel,
  EvidenceViewModel,
  GraphNodeKind,
  GraphNodeViewModel,
  GraphQuery,
  GraphRelationViewModel,
  GraphViewModel,
  RelationFilterOptionViewModel,
} from "../types/viewModels";
import {
  formatDateResolution,
  formatRelationshipSubtype,
  formatSourceMethod,
  formatValidityLabel,
  getRelationshipSemanticLabel,
  getRelationshipTypeLabel,
} from "../utils/relationSemantics.js";

type DisplayNameAwareCompany = {
  name?: string;
  label?: string;
  secondaryLabel?: string;
  canonicalName?: string;
  displayName?: string;
  entityProfile?: CompanyDetailDTO["entityProfile"];
};

type CompanyOptionSource = CompanyListItemDTO | CompanySearchResultItemDTO | CompanySuggestItemDTO;

const SOURCE_TYPE_LABELS = {
  "10k": "10-K",
  earnings_call: "Earnings Call",
  supplier_report: "Supplier Report",
  media: "Media",
  industry_report: "Industry Report",
  press_release: "Press Release",
  official_doc: "Official Document",
} satisfies Record<EvidenceDTO["sourceType"], string>;

const ENTITY_KIND_BY_TYPE: Record<SubgraphDTO["nodes"][number]["entityType"], GraphNodeKind> = {
  Company: "company",
  Facility: "facility",
  Product: "product",
  Technology: "technology",
  Material: "material",
};

export function adaptCompanyOptions(
  response: CompanyListResponseDTO | SearchCompaniesResponseDTO | SuggestCompaniesResponseDTO,
): CompanyOptionViewModel[] {
  return response.items.map(adaptCompanyOption);
}

export function adaptCompanyOverview(overview: CompanyOverviewDTO): CompanyOverviewViewModel {
  return {
    companyId: overview.companyId,
    companyName: overview.companyName,
    activeSnapshotId: overview.activeSnapshotId,
    supplierCount: overview.supplierCount,
    tier1SupplierCount: overview.tier1SupplierCount,
    relationCount: overview.totalRelations,
    evidenceCount: overview.evidenceCount,
    criticalDependencyCount: overview.highRiskRelationCount,
    evidenceCoverage: overview.evidenceCoverage,
    lastUpdated: overview.lastUpdatedAt,
    source: overview.source,
  };
}

export function adaptCompanyProfile(
  response: CompanyDetailResponseDTO,
  overview: CompanyOverviewDTO,
  optionOverride?: CompanyOptionViewModel | null,
): CompanyProfileViewModel {
  const company = response.item;
  const option = optionOverride ?? adaptCompanyOption(company);
  const overviewView = adaptCompanyOverview(overview);

  return {
    ...option,
    summary: company.summary ?? company.description ?? `${company.name} supply-chain overview.`,
    overview: overviewView,
    apiBindings: {
      companyEndpoint: `/api/v1/companies/${company.id}`,
      overviewEndpoint: `/api/v1/companies/${company.id}/overview`,
      graphEndpoint: `/api/v1/graph/subgraph?companyId=${encodeURIComponent(company.id)}`,
      evidenceEndpoint: "/api/v1/relations/:relationId/evidence",
    },
    lastUpdated: company.lastUpdatedAt ?? overview.lastUpdatedAt,
    source: response.source,
  };
}

export function adaptGraphViewModel(input: {
  company: CompanyDetailResponseDTO;
  overview: CompanyOverviewDTO;
  subgraph: SubgraphDTO;
  query: GraphQuery;
  focusCompanyOption?: CompanyOptionViewModel | null;
}): GraphViewModel {
  const focusCompany = adaptCompanyProfile(input.company, input.overview, input.focusCompanyOption);
  const layout = buildNodeLayout(input.subgraph.nodes, input.subgraph.relations, focusCompany.id);
  const typeFilteredRelations = input.subgraph.relations.filter((relation) => matchesRelationshipTypeFilter(relation, input.query));
  const filteredRelations = typeFilteredRelations.filter((relation) => matchesRelationshipSubtypeFilter(relation, input.query));
  const visibleNodeIds = selectVisibleNodeIds(layout, filteredRelations, focusCompany.id, input.query.search);
  const nodes = layout.filter((node) => visibleNodeIds.has(node.id));
  const relations = filteredRelations
    .filter((relation) => visibleNodeIds.has(relation.sourceId) && visibleNodeIds.has(relation.targetId))
    .map((relation) => adaptRelation(relation, focusCompany.id));

  return {
    snapshot: input.subgraph.snapshot,
    focusCompany,
    nodes,
    relations,
    evidenceOverview: summarizeEvidence(relations),
    relationTypeOptions: collectRelationTypeOptions(typeFilteredRelations.length > 0 ? typeFilteredRelations : input.subgraph.relations),
    relationshipSubtypeOptions: collectRelationshipSubtypeOptions(typeFilteredRelations),
  };
}

export function adaptRelationEvidence(
  response: RelationEvidenceResponseDTO,
  relation: Pick<RelationDTO, "confidence">,
): EvidenceViewModel[] {
  return response.items.map((item) => adaptEvidence(item, relation.confidence));
}

function adaptCompanyOption(company: CompanyOptionSource | CompanyDetailDTO): CompanyOptionViewModel {
  const enhancedCompany = company as (CompanyOptionSource | CompanyDetailDTO) & DisplayNameAwareCompany;
  const displayName = getPreferredDisplayName(enhancedCompany);
  const canonicalName = getCanonicalName(enhancedCompany);
  const name = getBaseCompanyName(company, displayName, canonicalName);
  const searchMatch = "match" in company ? company.match ?? null : null;

  return {
    id: company.id,
    ticker: company.ticker ?? name.slice(0, 4).toUpperCase(),
    name,
    displayName,
    canonicalName,
    shortName: displayName,
    focus: displayName,
    searchMatch,
    aliasHitExplanation: searchMatch?.field === "alias" ? searchMatch.explanation : null,
    hierarchySummary: formatHierarchySummary(enhancedCompany.entityProfile, "company"),
    primaryRegion: "primaryRegion" in company ? company.primaryRegion : "Global",
    marketCapUsd: "marketCapUsd" in company ? company.marketCapUsd : null,
    isMag7: company.isMag7,
    entityProfile: enhancedCompany.entityProfile ?? null,
  };
}

function adaptRelation(relation: RelationDTO, companyId: string): GraphRelationViewModel {
  return {
    id: relation.id,
    sourceId: relation.sourceId,
    targetId: relation.targetId,
    relationshipType: relation.relationshipType,
    relationshipTypeLabel: getRelationshipTypeLabel(relation.relationshipType),
    relationshipSemanticLabel: getRelationshipSemanticLabel(relation.relationshipType),
    relationshipSubtype: relation.relationshipSubtype ?? null,
    relationshipSubtypeLabel: formatRelationshipSubtype(relation.relationshipSubtype),
    tier: relation.tier,
    depthFromMag7: relation.depthFromMag7,
    confidence: relation.confidence,
    confidenceScore: relation.confidenceScore,
    summary: relation.summary,
    productScope: relation.productScope,
    notes: relation.notes ?? null,
    sourceMethod: relation.sourceMethod ?? null,
    sourceMethodLabel: formatSourceMethod(relation.sourceMethod),
    evidenceDateResolution: relation.evidenceDateResolution ?? null,
    evidenceDateResolutionLabel: formatDateResolution(relation.evidenceDateResolution),
    validFrom: relation.validFrom ?? null,
    validFromResolution: relation.validFromResolution ?? null,
    validFromResolutionLabel: formatDateResolution(relation.validFromResolution),
    validTo: relation.validTo ?? null,
    validToResolution: relation.validToResolution ?? null,
    validToResolutionLabel: formatDateResolution(relation.validToResolution),
    validityLabel: formatValidityLabel(relation.validFrom, relation.validTo),
    validityNote: relation.validityNote ?? null,
    evidenceCount: relation.evidenceCount,
    evidence: (relation.evidence ?? []).map((item) => adaptEvidence(item, relation.confidence)),
    isDirectRelation: relation.sourceId === companyId || relation.targetId === companyId,
  };
}

function adaptEvidence(evidence: EvidenceDTO, confidence: RelationDTO["confidence"]): EvidenceViewModel {
  return {
    id: evidence.id,
    title: evidence.title,
    publisher: evidence.publisher,
    sourceType: evidence.sourceType,
    sourceTypeLabel: SOURCE_TYPE_LABELS[evidence.sourceType],
    publishedAt: evidence.publishedAt,
    publishedAtResolution: evidence.publishedAtResolution,
    publishedAtResolutionLabel: formatDateResolution(evidence.publishedAtResolution) ?? "Not specified",
    publishedAtSemantic: getEvidencePrimaryDateSemantic(evidence.publishedAtResolution),
    reportedPeriodEnd: evidence.coverageEnd ?? null,
    reportedPeriodEndResolutionLabel: formatDateResolution(evidence.coverageEndResolution),
    retrievedAt: evidence.retrievedAt,
    retrievedAtSemantic: "retrieved_at_surrogate",
    compatibilityNote: getEvidenceCompatibilityNote(evidence.publishedAtResolution, evidence.publishedAt),
    url: evidence.url,
    citation: evidence.citationText,
    excerpt: evidence.excerpt,
    pageRef: evidence.pageRef ?? null,
    confidence,
  };
}

function summarizeEvidence(relations: GraphRelationViewModel[]): EvidenceSummaryViewModel {
  return relations.reduce<EvidenceSummaryViewModel>(
    (summary, relation) => {
      if (relation.confidence === "strong_evidence") {
        summary.strongEvidence += relation.evidenceCount;
      } else {
        summary[relation.confidence] += relation.evidenceCount;
      }
      return summary;
    },
    { confirmed: 0, strongEvidence: 0, inferred: 0 },
  );
}

function buildNodeLayout(
  nodes: SubgraphDTO["nodes"],
  relations: RelationDTO[],
  companyId: string,
): GraphNodeViewModel[] {
  const depths = calculateNodeDepths(nodes, relations, companyId);
  const nodesByDepth = new Map<number, typeof nodes>();

  for (const node of nodes) {
    const depth = depths.get(node.id) ?? 0;
    const bucket = nodesByDepth.get(depth) ?? [];
    bucket.push(node);
    nodesByDepth.set(depth, bucket);
  }

  const maxDepth = Math.max(...nodesByDepth.keys(), 0);
  const left = 14;
  const right = 84;

  return [...nodes]
    .sort((leftNode, rightNode) => (depths.get(leftNode.id) ?? 0) - (depths.get(rightNode.id) ?? 0))
    .map((node) => {
      const depth = depths.get(node.id) ?? 0;
      const bucket = (nodesByDepth.get(depth) ?? []).slice().sort((a, b) => a.label.localeCompare(b.label));
      const index = bucket.findIndex((item) => item.id === node.id);
      const rowStep = 62 / Math.max(bucket.length - 1, 1);
      const x = maxDepth === 0 ? 50 : left + ((right - left) / maxDepth) * depth;
      const y = bucket.length === 1 ? 50 : 19 + rowStep * index;

      return {
        id: node.id,
        label: getPreferredNodeLabel(node),
        secondaryLabel: describeNodeSecondaryLabel(node),
        displayName: getPreferredNodeLabel(node),
        canonicalName: node.company ? getCanonicalName(node.company) : null,
        hierarchySummary: formatHierarchySummary(node.company?.entityProfile, ENTITY_KIND_BY_TYPE[node.entityType]),
        kindLabel: humanizeNodeKind(ENTITY_KIND_BY_TYPE[node.entityType]),
        kind: ENTITY_KIND_BY_TYPE[node.entityType],
        region: node.company?.country ?? node.country ?? "Global",
        importanceScore: node.importanceScore ?? node.company?.importanceScore ?? 0.45,
        marketCapUsd: node.marketCapUsd ?? node.company?.marketCapUsd ?? null,
        x,
        y,
        isAnchor: node.id === companyId,
      };
    });
}

function calculateNodeDepths(
  nodes: SubgraphDTO["nodes"],
  relations: RelationDTO[],
  companyId: string,
): Map<string, number> {
  const adjacency = new Map<string, string[]>();
  for (const node of nodes) {
    adjacency.set(node.id, []);
  }

  for (const relation of relations) {
    adjacency.set(relation.sourceId, [...(adjacency.get(relation.sourceId) ?? []), relation.targetId]);
    adjacency.set(relation.targetId, [...(adjacency.get(relation.targetId) ?? []), relation.sourceId]);
  }

  const depths = new Map<string, number>([[companyId, 0]]);
  const queue = [companyId];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    const baseDepth = depths.get(current) ?? 0;

    for (const neighbor of adjacency.get(current) ?? []) {
      if (depths.has(neighbor)) continue;
      depths.set(neighbor, baseDepth + 1);
      queue.push(neighbor);
    }
  }

  for (const node of nodes) {
    if (!depths.has(node.id)) {
      depths.set(node.id, 0);
    }
  }

  return depths;
}

function selectVisibleNodeIds(
  nodes: GraphNodeViewModel[],
  relations: RelationDTO[],
  companyId: string,
  search?: string,
): Set<string> {
  const trimmed = search?.trim().toLowerCase();
  const allNodeIds = new Set(nodes.map((node) => node.id));

  if (!trimmed) {
    return allNodeIds;
  }

  const matchedIds = new Set(
    nodes
      .filter((node) => `${node.label} ${node.secondaryLabel} ${node.region}`.toLowerCase().includes(trimmed))
      .map((node) => node.id),
  );

  if (matchedIds.size === 0) {
    matchedIds.add(companyId);
  }

  for (const relation of relations) {
    if (matchedIds.has(relation.sourceId) || matchedIds.has(relation.targetId)) {
      matchedIds.add(relation.sourceId);
      matchedIds.add(relation.targetId);
    }
  }

  matchedIds.add(companyId);
  return matchedIds;
}

function matchesRelationshipTypeFilter(relation: RelationDTO, query: GraphQuery) {
  if (!query.relationshipTypes || query.relationshipTypes.length === 0) {
    return true;
  }

  return query.relationshipTypes.includes(relation.relationshipType);
}

function matchesRelationshipSubtypeFilter(relation: RelationDTO, query: GraphQuery) {
  const subtype = query.relationshipSubtype?.trim().toLowerCase();
  if (!subtype) {
    return true;
  }

  return relation.relationshipSubtype?.trim().toLowerCase() === subtype;
}

function collectRelationTypeOptions(relations: RelationDTO[]): RelationFilterOptionViewModel[] {
  const counts = new Map<string, number>();

  for (const relation of relations) {
    counts.set(relation.relationshipType, (counts.get(relation.relationshipType) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([value, count]) => ({
      value,
      count,
      label: getRelationshipTypeLabel(value as RelationDTO["relationshipType"]),
    }));
}

function collectRelationshipSubtypeOptions(relations: RelationDTO[]): RelationFilterOptionViewModel[] {
  const counts = new Map<string, number>();

  for (const relation of relations) {
    if (!relation.relationshipSubtype) {
      continue;
    }

    counts.set(relation.relationshipSubtype, (counts.get(relation.relationshipSubtype) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([value, count]) => ({
      value,
      count,
      label: formatRelationshipSubtype(value) ?? value,
    }));
}

function getPreferredDisplayName(company: DisplayNameAwareCompany) {
  return (
    company.displayName ??
    company.entityProfile?.displayName ??
    company.canonicalName ??
    company.name ??
    normalizeCompanyLabel(company.label) ??
    "Unknown company"
  );
}

function getCanonicalName(company: DisplayNameAwareCompany) {
  return (
    company.canonicalName ??
    company.entityProfile?.canonicalName ??
    company.name ??
    normalizeCompanyLabel(company.secondaryLabel) ??
    normalizeCompanyLabel(company.label) ??
    "Unknown company"
  );
}

function getBaseCompanyName(
  company: CompanyOptionSource | CompanyDetailDTO,
  displayName: string,
  canonicalName: string,
) {
  if ("name" in company && typeof company.name === "string") {
    return company.name;
  }

  if ("label" in company && typeof company.label === "string" && company.label.trim()) {
    return normalizeCompanyLabel(company.label) ?? displayName ?? canonicalName;
  }

  return displayName ?? canonicalName;
}

function normalizeCompanyLabel(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.replace(/\s+\([A-Z0-9.-]+\)$/, "");
}

function getPreferredNodeLabel(node: SubgraphDTO["nodes"][number]) {
  if (node.company) {
    return getPreferredDisplayName(node.company);
  }

  return node.label;
}

function describeNodeSecondaryLabel(node: SubgraphDTO["nodes"][number]) {
  const kind = humanizeNodeKind(ENTITY_KIND_BY_TYPE[node.entityType]);
  const ticker = node.company?.ticker;
  const canonicalName = node.company ? getCanonicalName(node.company) : null;
  const pieces = [kind];

  if (ticker) {
    pieces.push(ticker);
  }

  if (canonicalName && canonicalName !== getPreferredNodeLabel(node)) {
    pieces.push(canonicalName);
  }

  return pieces.join(" · ");
}

function formatHierarchySummary(
  entityProfile: CompanyDetailDTO["entityProfile"] | undefined,
  kind: GraphNodeKind,
) {
  const base =
    kind === "facility"
      ? "Facility node mapped under its operating group."
      : "Search and detail views distinguish group, brand, legal entity, and facility layers.";

  if (!entityProfile) {
    return base;
  }

  const parts = [
    `Group: ${entityProfile.canonicalName}`,
    `Display: ${entityProfile.displayName}`,
    entityProfile.legalEntities.length > 0 ? `Legal: ${entityProfile.legalEntities.map((item) => item.name).join(", ")}` : null,
    entityProfile.brands.length > 0 ? `Brands: ${entityProfile.brands.map((item) => item.name).join(", ")}` : null,
    entityProfile.aliases.some((item) => item.aliasType === "facility")
      ? `Facilities: ${entityProfile.aliases.filter((item) => item.aliasType === "facility").map((item) => item.name).join(", ")}`
      : "Facilities: represented as graph nodes or facility aliases when available",
  ].filter(Boolean);

  return parts.join(" | ");
}

function humanizeNodeKind(kind: GraphNodeKind) {
  if (kind === "company") return "Group / Company";
  if (kind === "facility") return "Facility";
  if (kind === "product") return "Product";
  if (kind === "technology") return "Technology";
  return "Material";
}

function getEvidencePrimaryDateSemantic(resolution: string | null | undefined) {
  const normalized = resolution?.trim().toLowerCase();

  if (normalized === "published_at") return "published_at";
  if (normalized === "filing_period") return "reported_period_end";
  if (normalized === "undated") return "retrieved_at_surrogate";
  if (normalized === "month" || normalized === "quarter" || normalized === "year") return "month-normalized compatibility";

  return normalized ?? "published_at";
}

function getEvidenceCompatibilityNote(resolution: string | null | undefined, publishedAt: string) {
  const normalized = resolution?.trim().toLowerCase();

  if (normalized === "month" || normalized === "quarter" || normalized === "year") {
    return `Legacy month-normalized inputs are rendered as ${normalized}-level values; ${publishedAt} may be a surrogate boundary, not a day-exact publication timestamp.`;
  }

  if (normalized === "undated") {
    return "Undated evidence falls back to a retrieved_at surrogate and should not be read as a source-published date.";
  }

  if (normalized === "filing_period") {
    return "This value represents the reported period end, not the document publication date.";
  }

  return null;
}

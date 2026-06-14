import type {
  CompanyDetailResponseDTO,
  CompanyDetailDTO,
  CompanyListItemDTO,
  CompanyListResponseDTO,
  CompanyOverviewDTO,
  EvidenceDTO,
  RelationDTO,
  RelationEvidenceResponseDTO,
  SubgraphDTO,
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
} from "../types/viewModels";

const SOURCE_TYPE_LABELS: Record<EvidenceDTO["sourceType"], string> = {
  "10k": "10-K",
  earnings_call: "Earnings Call",
  supplier_report: "Supplier Report",
  media: "Media",
  industry_report: "Industry Report",
  press_release: "Press Release",
  official_doc: "Official Document",
};

const ENTITY_KIND_BY_TYPE: Record<SubgraphDTO["nodes"][number]["entityType"], GraphNodeKind> = {
  Company: "company",
  Facility: "facility",
  Product: "product",
  Technology: "technology",
  Material: "material",
};

export function adaptCompanyOptions(response: CompanyListResponseDTO): CompanyOptionViewModel[] {
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
): CompanyProfileViewModel {
  const company = response.item;
  const option = adaptCompanyOption(company);
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
}): GraphViewModel {
  const focusCompany = adaptCompanyProfile(input.company, input.overview);
  const layout = buildNodeLayout(input.subgraph.nodes, input.subgraph.relations, focusCompany.id);
  const visibleNodeIds = selectVisibleNodeIds(layout, input.subgraph.relations, focusCompany.id, input.query.search);
  const nodes = layout.filter((node) => visibleNodeIds.has(node.id));
  const relations = input.subgraph.relations
    .filter((relation) => visibleNodeIds.has(relation.sourceId) && visibleNodeIds.has(relation.targetId))
    .map((relation) => adaptRelation(relation, focusCompany.id));

  return {
    snapshot: input.subgraph.snapshot,
    focusCompany,
    nodes,
    relations,
    evidenceOverview: summarizeEvidence(relations),
  };
}

export function adaptRelationEvidence(
  response: RelationEvidenceResponseDTO,
  relation: Pick<RelationDTO, "confidence">,
): EvidenceViewModel[] {
  return response.items.map((item) => adaptEvidence(item, relation.confidence));
}

function adaptCompanyOption(company: CompanyListItemDTO): CompanyOptionViewModel {
  return {
    id: company.id,
    ticker: company.ticker ?? company.name.slice(0, 4).toUpperCase(),
    name: company.name,
    shortName: getShortName(company),
    focus: company.name,
    primaryRegion: company.primaryRegion,
    marketCapUsd: company.marketCapUsd,
    isMag7: company.isMag7,
  };
}

function adaptRelation(relation: RelationDTO, companyId: string): GraphRelationViewModel {
  return {
    id: relation.id,
    sourceId: relation.sourceId,
    targetId: relation.targetId,
    relationshipType: relation.relationshipType,
    tier: relation.tier,
    depthFromMag7: relation.depthFromMag7,
    confidence: relation.confidence,
    confidenceScore: relation.confidenceScore,
    summary: relation.summary,
    productScope: relation.productScope,
    notes: relation.notes ?? null,
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
        label: node.label,
        secondaryLabel: node.company?.ticker ?? node.country ?? node.entityType,
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

function getShortName(company: Pick<CompanyListItemDTO, "name"> & { aliases?: string[] }): string {
  return company.aliases?.[0]?.replace(/,?\s+(Inc|Inc\.|Corporation|Corp\.|Ltd\.|Limited|Holdings|Platforms)$/i, "") ??
    company.name.replace(/,?\s+(Inc|Inc\.|Corporation|Corp\.|Ltd\.|Limited|Holdings|Platforms)$/i, "");
}

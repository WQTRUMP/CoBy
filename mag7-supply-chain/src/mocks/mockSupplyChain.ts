import type {
  CompanyDetailDTO,
  CompanyListItemDTO,
  CompanyListResponseDTO,
  CompanyOverviewDTO,
  CompanyDetailResponseDTO,
  EvidenceDTO,
  RelationDTO,
  RelationEvidenceResponseDTO,
  SnapshotDTO,
  SubgraphDTO,
} from "../../packages/contracts/src/index";

const snapshot: SnapshotDTO = {
  id: "snapshot:2026-06-14.1",
  version: "2026.06.14-01",
  status: "published",
  publishedAt: "2026-06-14T00:00:00.000Z",
  scope: ["company:TSLA"],
  notes: "Frontend mock aligned to shared contracts.",
};

const companies: CompanyDetailDTO[] = [
  {
    id: "company:TSLA",
    ticker: "TSLA",
    name: "Tesla",
    entityType: "Company",
    companyType: "public_company",
    country: "US",
    isMag7: true,
    marketCapUsd: 720000000000,
    description: "EV, battery, robotics, and FSD compute.",
    aliases: ["Tesla, Inc."],
    active: true,
    importanceScore: 1,
    primaryRegion: "North America",
    activeSnapshotId: snapshot.id,
    summary: "Tesla depends on battery cells, raw materials, and compute capacity across multiple tiers.",
    lastUpdatedAt: snapshot.publishedAt,
  },
  {
    id: "company:CATL",
    ticker: "300750.SZ",
    name: "CATL",
    entityType: "Company",
    companyType: "supplier",
    country: "CN",
    isMag7: false,
    marketCapUsd: 145000000000,
    description: "Battery cell and storage supplier.",
    aliases: ["Contemporary Amperex Technology Co. Limited"],
    active: true,
    importanceScore: 0.72,
    primaryRegion: "Greater China",
    activeSnapshotId: snapshot.id,
    summary: "CATL is both a direct Tesla supplier and a gateway to upstream lithium exposure.",
    lastUpdatedAt: snapshot.publishedAt,
  },
  {
    id: "company:PanasonicEnergy",
    ticker: "6752.T",
    name: "Panasonic Energy",
    entityType: "Company",
    companyType: "supplier",
    country: "JP",
    isMag7: false,
    marketCapUsd: 82000000000,
    description: "Cylindrical cell supplier.",
    aliases: [],
    active: true,
    importanceScore: 0.62,
    primaryRegion: "Japan / North America",
    activeSnapshotId: snapshot.id,
    summary: "Panasonic Energy remains a strategic cylindrical-cell supplier for Tesla.",
    lastUpdatedAt: snapshot.publishedAt,
  },
  {
    id: "company:Ganfeng",
    ticker: "1772.HK",
    name: "Ganfeng Lithium",
    entityType: "Company",
    companyType: "raw_material",
    country: "CN",
    isMag7: false,
    marketCapUsd: 13000000000,
    description: "Lithium compound producer.",
    aliases: [],
    active: true,
    importanceScore: 0.42,
    primaryRegion: "China",
    activeSnapshotId: snapshot.id,
    summary: "Ganfeng Lithium anchors an upstream raw-material relationship into CATL.",
    lastUpdatedAt: snapshot.publishedAt,
  },
];

const companyListItems: CompanyListItemDTO[] = companies.map((company) => ({
  id: company.id,
  ticker: company.ticker,
  name: company.name,
  isMag7: company.isMag7,
  marketCapUsd: company.marketCapUsd,
  primaryRegion: company.primaryRegion,
  activeSnapshotId: company.activeSnapshotId,
}));

const evidenceById: Record<string, EvidenceDTO> = {
  "evidence:tesla-10k": {
    id: "evidence:tesla-10k",
    sourceType: "10k",
    title: "Tesla FY2024 Form 10-K",
    publisher: "Tesla / SEC",
    url: "https://www.sec.gov/Archives/edgar/data/1318605/000162828025003063/tsla-20241231.htm",
    publishedAt: "2025-01-29T00:00:00.000Z",
    retrievedAt: "2026-06-14T00:00:00.000Z",
    excerpt: "Tesla identifies battery cells and raw materials as critical inputs.",
    pageRef: "Raw materials and supply chain",
    language: "en",
    hash: "sha256:tesla-10k",
    sourceDomain: "sec.gov",
    citationText: "Tesla identifies battery cells and raw materials as critical inputs.",
    reliabilityTier: 1,
    licenseNote: null,
    parserVersion: "mock-1.0.0",
  },
  "evidence:panasonic-report": {
    id: "evidence:panasonic-report",
    sourceType: "supplier_report",
    title: "Panasonic Energy Integrated Report 2025",
    publisher: "Panasonic Energy",
    url: "https://www.panasonic.com/global/energy/sustainability/ir.html",
    publishedAt: "2025-09-30T00:00:00.000Z",
    retrievedAt: "2026-06-14T00:00:00.000Z",
    excerpt: "Panasonic details North America cylindrical cell capacity expansion.",
    pageRef: "North America capacity",
    language: "en",
    hash: "sha256:panasonic-report",
    sourceDomain: "panasonic.com",
    citationText: "Panasonic details North America cylindrical cell capacity expansion.",
    reliabilityTier: 2,
    licenseNote: null,
    parserVersion: "mock-1.0.0",
  },
  "evidence:catl-report": {
    id: "evidence:catl-report",
    sourceType: "supplier_report",
    title: "CATL Annual Report 2025",
    publisher: "CATL",
    url: "https://www.catl.com/en/investor/financials/",
    publishedAt: "2026-04-15T00:00:00.000Z",
    retrievedAt: "2026-06-14T00:00:00.000Z",
    excerpt: "CATL confirms lithium and upstream materials as a core supply dependency.",
    pageRef: "Supply chain risk",
    language: "en",
    hash: "sha256:catl-report",
    sourceDomain: "catl.com",
    citationText: "CATL confirms lithium and upstream materials as a core supply dependency.",
    reliabilityTier: 2,
    licenseNote: null,
    parserVersion: "mock-1.0.0",
  },
};

const subgraph: SubgraphDTO = {
  snapshot,
  nodes: companies.map((company) => ({
    id: company.id,
    entityType: "Company",
    label: company.name,
    company,
    country: company.country,
    marketCapUsd: company.marketCapUsd,
    importanceScore: company.importanceScore,
  })),
  relations: [
    relation({
      id: "rel:tesla-panasonic",
      sourceId: "company:PanasonicEnergy",
      targetId: "company:TSLA",
      relationshipType: "component_supply",
      relationshipSubtype: "battery_cells",
      tier: 1,
      depthFromMag7: 1,
      confidence: "strong_evidence",
      confidenceScore: 0.83,
      summary: "Panasonic Energy supplies cylindrical battery cells into Tesla programs.",
      productScope: ["2170 cells", "4680 cells"],
      notes: "North America capacity remains strategically important.",
      evidenceIds: ["evidence:tesla-10k", "evidence:panasonic-report"],
      primaryEvidenceId: "evidence:panasonic-report",
      evidenceCount: 2,
      snapshotId: snapshot.id,
      status: "approved",
      sourceMethod: "mock_frontend_fixture",
      sourceCount: 2,
      lineageKey: "tesla|panasonic-energy|battery-cells",
      lastVerifiedAt: snapshot.publishedAt,
      validFrom: "2024-01-01",
      validTo: null,
      evidence: [evidenceById["evidence:tesla-10k"], evidenceById["evidence:panasonic-report"]],
    }),
    relation({
      id: "rel:tesla-catl",
      sourceId: "company:CATL",
      targetId: "company:TSLA",
      relationshipType: "component_supply",
      relationshipSubtype: "lfp_cells",
      tier: 1,
      depthFromMag7: 1,
      confidence: "confirmed",
      confidenceScore: 0.89,
      summary: "CATL supplies LFP battery cells for Tesla EV and stationary storage programs.",
      productScope: ["LFP cells", "stationary storage systems"],
      notes: "The same supplier node also anchors an upstream raw-material relation.",
      evidenceIds: ["evidence:tesla-10k", "evidence:catl-report"],
      primaryEvidenceId: "evidence:catl-report",
      evidenceCount: 2,
      snapshotId: snapshot.id,
      status: "approved",
      sourceMethod: "mock_frontend_fixture",
      sourceCount: 2,
      lineageKey: "tesla|catl|lfp-cells",
      lastVerifiedAt: snapshot.publishedAt,
      validFrom: "2024-01-01",
      validTo: null,
      evidence: [evidenceById["evidence:tesla-10k"], evidenceById["evidence:catl-report"]],
    }),
    relation({
      id: "rel:ganfeng-catl",
      sourceId: "company:Ganfeng",
      targetId: "company:CATL",
      relationshipType: "raw_material_supply",
      relationshipSubtype: "lithium_feedstock",
      tier: 2,
      depthFromMag7: 2,
      confidence: "strong_evidence",
      confidenceScore: 0.74,
      summary: "Ganfeng Lithium feeds CATL's upstream lithium input chain.",
      productScope: ["Lithium compounds"],
      notes: "This non-direct edge must stay visible when the subgraph includes upstream chains.",
      evidenceIds: ["evidence:catl-report"],
      primaryEvidenceId: "evidence:catl-report",
      evidenceCount: 1,
      snapshotId: snapshot.id,
      status: "approved",
      sourceMethod: "mock_frontend_fixture",
      sourceCount: 1,
      lineageKey: "catl|ganfeng|lithium",
      lastVerifiedAt: snapshot.publishedAt,
      validFrom: "2024-01-01",
      validTo: null,
      evidence: [evidenceById["evidence:catl-report"]],
    }),
  ],
};

const overviewByCompanyId: Record<string, CompanyOverviewDTO> = {
  "company:TSLA": {
    companyId: "company:TSLA",
    companyName: "Tesla",
    activeSnapshotId: snapshot.id,
    totalRelations: 3,
    tier1SupplierCount: 2,
    supplierCount: 2,
    highRiskRelationCount: 1,
    evidenceCount: 5,
    evidenceCoverage: 1,
    lastUpdatedAt: snapshot.publishedAt,
    source: "mock",
  },
};

export function getCompaniesResponse(query?: string): CompanyListResponseDTO {
  const normalized = query?.trim().toLowerCase();
  const items = normalized
    ? companyListItems.filter(
        (company) =>
          company.name.toLowerCase().includes(normalized) ||
          company.ticker?.toLowerCase().includes(normalized),
      )
    : companyListItems;

  return {
    items,
    page: 1,
    pageSize: items.length || 1,
    total: items.length,
    source: "mock",
  };
}

export function getCompanyResponse(companyId: string): CompanyDetailResponseDTO {
  return {
    item: getCompany(companyId),
    source: "mock",
  };
}

export function getCompanyOverviewResponse(companyId: string): CompanyOverviewDTO {
  return overviewByCompanyId[companyId] ?? overviewByCompanyId["company:TSLA"];
}

export function getSubgraphResponse(companyId: string, depth: number, includeEvidence: boolean): SubgraphDTO {
  const filteredRelations = subgraph.relations.filter(
    (relation) =>
      relation.depthFromMag7 <= depth &&
      touchesCompanyChain(relation, companyId, depth),
  );
  const visibleNodeIds = new Set(filteredRelations.flatMap((relation) => [relation.sourceId, relation.targetId]));
  visibleNodeIds.add(companyId);

  return {
    snapshot,
    nodes: subgraph.nodes.filter((node) => visibleNodeIds.has(node.id)),
    relations: filteredRelations.map((relation) =>
      includeEvidence ? relation : { ...relation, evidence: undefined },
    ),
  };
}

export function getRelationEvidenceResponse(relationId: string): RelationEvidenceResponseDTO {
  const relation = subgraph.relations.find((item) => item.id === relationId);

  return {
    relationId,
    items: relation?.evidence ?? [],
    total: relation?.evidence?.length ?? 0,
    source: "mock",
  };
}

function getCompany(companyId: string): CompanyDetailDTO {
  return companies.find((company) => company.id === companyId) ?? companies[0];
}

function touchesCompanyChain(relation: RelationDTO, companyId: string, depth: number): boolean {
  if (relation.sourceId === companyId || relation.targetId === companyId) {
    return true;
  }

  if (depth < 2) {
    return false;
  }

  return relation.id === "rel:ganfeng-catl" && companyId === "company:TSLA";
}

function relation(input: RelationDTO): RelationDTO {
  return input;
}

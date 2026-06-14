import type {
  CompanyDetail,
  EvidenceDTO,
  GraphNodeDTO,
  GraphRelationDTO,
  SnapshotDTO,
} from "../types/contracts";

const snapshot: SnapshotDTO = {
  id: "snapshot:2026-06-14.1",
  version: "2026.06.14-01",
  publishedAt: "2026-06-14",
  status: "mock",
};

export const companies: CompanyDetail[] = [
  {
    id: "aapl",
    ticker: "AAPL",
    name: "Apple",
    shortName: "Apple",
    focus: "Devices, silicon, services",
    primaryRegion: "US",
    marketCapUsd: 3150000000000,
    riskLevel: "medium",
    lastUpdated: snapshot.publishedAt,
    summary: "Consumer hardware depends on advanced foundry capacity, assembly, displays, cameras, and radio components across Asia.",
    stats: { supplierCount: 8, relationCount: 15, evidenceCoverage: 0.92, criticalDependencyCount: 3 },
    apiBindings: {
      overviewEndpoint: "/api/v1/companies/company:AAPL/overview",
      graphEndpoint: "/api/v1/graph/subgraph?companyId=company:AAPL",
      evidenceEndpoint: "/api/v1/relations/:relationId/evidence",
    },
  },
  {
    id: "msft",
    ticker: "MSFT",
    name: "Microsoft",
    shortName: "Microsoft",
    focus: "Azure AI, cloud, Copilot",
    primaryRegion: "US",
    marketCapUsd: 3380000000000,
    riskLevel: "high",
    lastUpdated: snapshot.publishedAt,
    summary: "Azure AI capacity is constrained by GPU supply, advanced packaging, networking, and datacenter infrastructure.",
    stats: { supplierCount: 6, relationCount: 13, evidenceCoverage: 0.89, criticalDependencyCount: 4 },
    apiBindings: {
      overviewEndpoint: "/api/v1/companies/company:MSFT/overview",
      graphEndpoint: "/api/v1/graph/subgraph?companyId=company:MSFT",
      evidenceEndpoint: "/api/v1/relations/:relationId/evidence",
    },
  },
  {
    id: "nvda",
    ticker: "NVDA",
    name: "NVIDIA",
    shortName: "NVIDIA",
    focus: "AI GPUs, networking, CUDA",
    primaryRegion: "US",
    marketCapUsd: 3520000000000,
    riskLevel: "high",
    lastUpdated: snapshot.publishedAt,
    summary: "A fabless model concentrates risk into TSMC manufacturing, HBM suppliers, and semiconductor equipment layers.",
    stats: { supplierCount: 7, relationCount: 16, evidenceCoverage: 0.95, criticalDependencyCount: 5 },
    apiBindings: {
      overviewEndpoint: "/api/v1/companies/company:NVDA/overview",
      graphEndpoint: "/api/v1/graph/subgraph?companyId=company:NVDA",
      evidenceEndpoint: "/api/v1/relations/:relationId/evidence",
    },
  },
  {
    id: "amzn",
    ticker: "AMZN",
    name: "Amazon",
    shortName: "Amazon",
    focus: "AWS AI, Trainium, retail cloud infra",
    primaryRegion: "US",
    marketCapUsd: 2350000000000,
    riskLevel: "high",
    lastUpdated: snapshot.publishedAt,
    summary: "AWS AI supply spans Trainium custom silicon, Blackwell GPU capacity, and datacenter power/network infrastructure.",
    stats: { supplierCount: 6, relationCount: 12, evidenceCoverage: 0.84, criticalDependencyCount: 4 },
    apiBindings: {
      overviewEndpoint: "/api/v1/companies/company:AMZN/overview",
      graphEndpoint: "/api/v1/graph/subgraph?companyId=company:AMZN",
      evidenceEndpoint: "/api/v1/relations/:relationId/evidence",
    },
  },
  {
    id: "googl",
    ticker: "GOOGL",
    name: "Alphabet",
    shortName: "Alphabet",
    focus: "TPU, Gemini, Google Cloud",
    primaryRegion: "US",
    marketCapUsd: 2480000000000,
    riskLevel: "high",
    lastUpdated: snapshot.publishedAt,
    summary: "Google Cloud depends on TPU, NVIDIA GPU capacity, and ASIC / foundry partners for AI scale-out.",
    stats: { supplierCount: 5, relationCount: 11, evidenceCoverage: 0.81, criticalDependencyCount: 4 },
    apiBindings: {
      overviewEndpoint: "/api/v1/companies/company:GOOGL/overview",
      graphEndpoint: "/api/v1/graph/subgraph?companyId=company:GOOGL",
      evidenceEndpoint: "/api/v1/relations/:relationId/evidence",
    },
  },
  {
    id: "meta",
    ticker: "META",
    name: "Meta Platforms",
    shortName: "Meta",
    focus: "GenAI infra, MTIA, Llama",
    primaryRegion: "US",
    marketCapUsd: 1640000000000,
    riskLevel: "high",
    lastUpdated: snapshot.publishedAt,
    summary: "Meta AI training relies on GPU clusters, networking, and custom silicon manufacturing partners.",
    stats: { supplierCount: 5, relationCount: 11, evidenceCoverage: 0.78, criticalDependencyCount: 3 },
    apiBindings: {
      overviewEndpoint: "/api/v1/companies/company:META/overview",
      graphEndpoint: "/api/v1/graph/subgraph?companyId=company:META",
      evidenceEndpoint: "/api/v1/relations/:relationId/evidence",
    },
  },
  {
    id: "tsla",
    ticker: "TSLA",
    name: "Tesla",
    shortName: "Tesla",
    focus: "EV, battery, FSD compute",
    primaryRegion: "US",
    marketCapUsd: 720000000000,
    riskLevel: "high",
    lastUpdated: snapshot.publishedAt,
    summary: "Battery cells, cathode materials, lithium and cobalt flows, and GPU training demand define Tesla's current supply exposure.",
    stats: { supplierCount: 8, relationCount: 17, evidenceCoverage: 0.86, criticalDependencyCount: 4 },
    apiBindings: {
      overviewEndpoint: "/api/v1/companies/company:TSLA/overview",
      graphEndpoint: "/api/v1/graph/subgraph?companyId=company:TSLA",
      evidenceEndpoint: "/api/v1/relations/:relationId/evidence",
    },
  },
];

export const evidenceById: Record<string, EvidenceDTO> = {
  apple10k: {
    id: "apple10k",
    title: "Apple FY2025 Form 10-K",
    publisher: "Apple / SEC",
    sourceType: "10-K",
    publishedAt: "2025-10-31",
    url: "https://www.sec.gov/Archives/edgar/data/320193/000032019325000079/aapl-20250927.htm",
    citation: "Apple identifies dependence on components, manufacturing partners, and single-source suppliers.",
    confidence: "confirmed",
    pageRef: "Item 1A",
  },
  appleSupplierList: {
    id: "appleSupplierList",
    title: "Apple Supplier List 2024",
    publisher: "Apple",
    sourceType: "Supplier Report",
    publishedAt: "2024-04-18",
    url: "https://s203.q4cdn.com/367071867/files/doc_downloads/2024/04/Apple-Supplier-List.pdf",
    citation: "Apple names key manufacturing and component suppliers across its device ecosystem.",
    confidence: "strong_evidence",
    pageRef: "Supplier list",
  },
  azureH100: {
    id: "azureH100",
    title: "Azure ND H100 v5 virtual machines",
    publisher: "Microsoft Learn",
    sourceType: "Industry Report",
    publishedAt: "2025-02-04",
    url: "https://learn.microsoft.com/en-us/azure/virtual-machines/sizes/gpu-accelerated/nd-family",
    citation: "Microsoft publicly documents H100-based Azure AI capacity.",
    confidence: "confirmed",
  },
  nvidiaAnnual: {
    id: "nvidiaAnnual",
    title: "NVIDIA FY2026 Form 10-K",
    publisher: "NVIDIA / SEC",
    sourceType: "10-K",
    publishedAt: "2026-02-26",
    url: "https://www.sec.gov/Archives/edgar/data/1045810/000104581026000021/nvda-20260125.htm",
    citation: "NVIDIA notes dependence on foundry, packaging, and memory partners.",
    confidence: "confirmed",
    pageRef: "Supply and manufacturing",
  },
  tsmcAnnual: {
    id: "tsmcAnnual",
    title: "TSMC Annual Report 2025",
    publisher: "TSMC",
    sourceType: "Supplier Report",
    publishedAt: "2026-04-19",
    url: "https://investor.tsmc.com/english/annual-reports",
    citation: "TSMC documents advanced-node and packaging capacity expansion for AI demand.",
    confidence: "strong_evidence",
  },
  skhynixNews: {
    id: "skhynixNews",
    title: "SK hynix AI memory collaboration coverage",
    publisher: "NVIDIA Newsroom",
    sourceType: "Media",
    publishedAt: "2026-06-07",
    url: "https://nvidianews.nvidia.com/news/sk-hynix-ai-factory",
    citation: "HBM supply remains central to AI system throughput and qualification cycles.",
    confidence: "strong_evidence",
  },
  tesla10k: {
    id: "tesla10k",
    title: "Tesla FY2024 Form 10-K",
    publisher: "Tesla / SEC",
    sourceType: "10-K",
    publishedAt: "2025-01-29",
    url: "https://www.sec.gov/Archives/edgar/data/1318605/000162828025003063/tsla-20241231.htm",
    citation: "Tesla details battery suppliers, raw material exposure, and energy storage dependencies.",
    confidence: "confirmed",
    pageRef: "Raw materials and supply chain",
  },
  panasonicReport: {
    id: "panasonicReport",
    title: "Panasonic Energy Integrated Report 2025",
    publisher: "Panasonic Energy",
    sourceType: "Supplier Report",
    publishedAt: "2025-09-30",
    url: "https://www.panasonic.com/global/energy/sustainability/ir.html",
    citation: "Panasonic outlines cylindrical-cell capacity and North America expansion plans.",
    confidence: "strong_evidence",
  },
  catlReport: {
    id: "catlReport",
    title: "CATL Annual Report 2025",
    publisher: "CATL",
    sourceType: "Supplier Report",
    publishedAt: "2026-04-15",
    url: "https://www.catl.com/en/investor/financials/",
    citation: "CATL reports battery manufacturing scale and upstream material dependence.",
    confidence: "strong_evidence",
  },
  metaInfra: {
    id: "metaInfra",
    title: "Meta GenAI infrastructure update",
    publisher: "Meta Engineering",
    sourceType: "Industry Report",
    publishedAt: "2024-03-12",
    url: "https://engineering.fb.com/2024/03/12/data-center-engineering/building-metas-genai-infrastructure/",
    citation: "Meta describes GPU cluster expansion and networking requirements.",
    confidence: "strong_evidence",
  },
  googleCloud: {
    id: "googleCloud",
    title: "Google Cloud and NVIDIA partnership",
    publisher: "Google Cloud",
    sourceType: "Industry Report",
    publishedAt: "2024-03-18",
    url: "https://www.googlecloudpresscorner.com/2024-03-18-Google-Cloud-and-NVIDIA-Expand-Partnership-to-Scale-AI-Development",
    citation: "Google Cloud highlights NVIDIA platform availability and co-selling posture.",
    confidence: "strong_evidence",
  },
};

const nodesByCompany: Record<string, GraphNodeDTO[]> = {
  aapl: [
    makeNode("aapl", "Apple", "AAPL", "company", "US", 1, 14, 48, 3150000000000),
    makeNode("aapl-devices", "Devices + Services", "Product line", "product", "Global", 0.64, 33, 49),
    makeNode("tsmc", "TSMC", "Foundry", "supplier", "Taiwan", 0.82, 54, 34),
    makeNode("honhai", "Foxconn", "Assembly", "supplier", "China / Taiwan", 0.58, 53, 57),
    makeNode("samsung-display", "Samsung Display", "OLED", "supplier", "Korea", 0.5, 68, 43),
    makeNode("sony", "Sony Semi", "CMOS", "supplier", "Japan", 0.46, 64, 25),
  ],
  msft: [
    makeNode("msft", "Microsoft", "MSFT", "company", "US", 1, 14, 48, 3380000000000),
    makeNode("msft-azure", "Azure AI", "Compute fabric", "product", "Global", 0.68, 34, 46),
    makeNode("nvidia", "NVIDIA", "GPU systems", "supplier", "US", 0.9, 56, 33, 3520000000000),
    makeNode("amd", "AMD", "Accelerators", "supplier", "US", 0.55, 58, 57),
    makeNode("broadcom", "Broadcom", "Networking", "supplier", "US", 0.48, 74, 46),
  ],
  nvda: [
    makeNode("nvda", "NVIDIA", "NVDA", "company", "US", 1, 14, 48, 3520000000000),
    makeNode("nvda-platform", "Blackwell + CUDA", "Platform", "product", "Global", 0.72, 34, 46),
    makeNode("tsmc", "TSMC", "Foundry", "supplier", "Taiwan", 0.84, 55, 30),
    makeNode("sk-hynix", "SK hynix", "HBM", "supplier", "Korea", 0.7, 59, 47),
    makeNode("micron", "Micron", "HBM / DRAM", "supplier", "US", 0.56, 58, 63),
    makeNode("asml", "ASML", "EUV", "supplier", "Netherlands", 0.52, 77, 30),
  ],
  amzn: [
    makeNode("amzn", "Amazon", "AMZN", "company", "US", 1, 14, 48, 2350000000000),
    makeNode("amzn-aws", "AWS AI", "Cloud fabric", "product", "Global", 0.7, 34, 46),
    makeNode("nvidia", "NVIDIA", "GPU systems", "supplier", "US", 0.82, 55, 33, 3520000000000),
    makeNode("tsmc", "TSMC", "Foundry", "supplier", "Taiwan", 0.69, 56, 57),
    makeNode("broadcom", "Broadcom", "Network ASIC", "supplier", "US", 0.47, 74, 46),
  ],
  googl: [
    makeNode("googl", "Alphabet", "GOOGL", "company", "US", 1, 14, 48, 2480000000000),
    makeNode("googl-cloud", "TPU + GCP", "Cloud AI", "product", "Global", 0.71, 35, 46),
    makeNode("broadcom", "Broadcom", "ASIC", "supplier", "US", 0.58, 57, 33),
    makeNode("nvidia", "NVIDIA", "GPU capacity", "supplier", "US", 0.73, 59, 50, 3520000000000),
    makeNode("tsmc", "TSMC", "Foundry", "supplier", "Taiwan", 0.64, 73, 39),
  ],
  meta: [
    makeNode("meta", "Meta", "META", "company", "US", 1, 14, 48, 1640000000000),
    makeNode("meta-genai", "Llama + MTIA", "AI infra", "product", "Global", 0.68, 35, 46),
    makeNode("nvidia", "NVIDIA", "GPU clusters", "supplier", "US", 0.76, 57, 33, 3520000000000),
    makeNode("broadcom", "Broadcom", "Custom silicon", "supplier", "US", 0.53, 59, 56),
    makeNode("tsmc", "TSMC", "Manufacturing", "supplier", "Taiwan", 0.61, 74, 44),
  ],
  tsla: [
    makeNode("tsla", "Tesla", "TSLA", "company", "US", 1, 14, 48, 720000000000),
    makeNode("tsla-battery", "Battery + FSD", "Vehicle stack", "product", "Global", 0.7, 35, 46),
    makeNode("panasonic-energy", "Panasonic Energy", "Cells", "supplier", "Japan / US", 0.62, 54, 28),
    makeNode("lges", "LG Energy Solution", "Cells", "supplier", "Korea", 0.56, 56, 46),
    makeNode("catl", "CATL", "LFP / storage", "supplier", "China", 0.72, 55, 65),
    makeNode("ganfeng", "Ganfeng Lithium", "Lithium", "material", "China", 0.42, 76, 60),
    makeNode("nvidia", "NVIDIA", "Training compute", "supplier", "US", 0.48, 74, 36, 3520000000000),
  ],
};

const relationsByCompany: Record<string, GraphRelationDTO[]> = {
  aapl: [
    relation("aapl-product", "aapl", "aapl-devices", "software_dependency", 0, "confirmed", 0.94, "Primary product umbrella for device and services exposure.", ["apple10k"]),
    relation("aapl-tsmc", "aapl-devices", "tsmc", "manufacturing", 1, "confirmed", 0.92, "Apple Silicon demand is gated by TSMC advanced-node capacity.", ["apple10k", "appleSupplierList", "tsmcAnnual"]),
    relation("aapl-honhai", "aapl-devices", "honhai", "component_supply", 1, "strong_evidence", 0.83, "Assembly concentration remains a tier-one execution risk.", ["appleSupplierList"]),
    relation("aapl-samsung-display", "aapl-devices", "samsung-display", "component_supply", 1, "strong_evidence", 0.79, "OLED panels remain a strategic display dependency.", ["appleSupplierList"]),
    relation("aapl-sony", "aapl-devices", "sony", "component_supply", 1, "strong_evidence", 0.76, "CMOS image sensor sourcing influences flagship camera roadmaps.", ["appleSupplierList"]),
  ],
  msft: [
    relation("msft-product", "msft", "msft-azure", "software_dependency", 0, "confirmed", 0.91, "Azure AI is the anchor workload for the current graph.", ["azureH100"]),
    relation("msft-nvidia", "msft-azure", "nvidia", "cloud_service", 1, "confirmed", 0.9, "Azure exposes H100 and next-gen GPU capacity to enterprise customers.", ["azureH100"]),
    relation("msft-amd", "msft-azure", "amd", "component_supply", 1, "strong_evidence", 0.77, "AMD remains a diversification path for accelerator and CPU supply.", ["azureH100"]),
    relation("msft-broadcom", "msft-azure", "broadcom", "equipment_supply", 1, "strong_evidence", 0.72, "Networking and custom silicon vendors shape datacenter readiness.", ["azureH100"]),
  ],
  nvda: [
    relation("nvda-product", "nvda", "nvda-platform", "software_dependency", 0, "confirmed", 0.95, "Blackwell, NVLink, and CUDA define the current platform scope.", ["nvidiaAnnual"]),
    relation("nvda-tsmc", "nvda-platform", "tsmc", "manufacturing", 1, "confirmed", 0.94, "Foundry and advanced packaging capacity are structural chokepoints.", ["nvidiaAnnual", "tsmcAnnual"]),
    relation("nvda-skhynix", "nvda-platform", "sk-hynix", "component_supply", 1, "confirmed", 0.91, "HBM remains a first-order bottleneck for AI system shipments.", ["nvidiaAnnual", "skhynixNews"]),
    relation("nvda-micron", "nvda-platform", "micron", "component_supply", 1, "strong_evidence", 0.79, "Micron broadens HBM / DRAM sourcing but still trails leading capacity.", ["nvidiaAnnual"]),
    relation("tsmc-asml", "tsmc", "asml", "equipment_supply", 2, "strong_evidence", 0.81, "Upstream EUV tool availability indirectly caps NVIDIA output.", ["tsmcAnnual"]),
  ],
  amzn: [
    relation("amzn-product", "amzn", "amzn-aws", "software_dependency", 0, "confirmed", 0.88, "AWS AI capacity is the focal product surface for this skeleton.", ["googleCloud"]),
    relation("amzn-nvidia", "amzn-aws", "nvidia", "cloud_service", 1, "strong_evidence", 0.82, "Blackwell and Hopper capacity remain central to premium AI instances.", ["googleCloud"]),
    relation("amzn-tsmc", "amzn-aws", "tsmc", "manufacturing", 1, "strong_evidence", 0.76, "Trainium program execution depends on foundry and packaging throughput.", ["tsmcAnnual"]),
    relation("amzn-broadcom", "amzn-aws", "broadcom", "equipment_supply", 1, "inferred", 0.62, "Network ASIC and switching layers remain an active research seam.", ["googleCloud"]),
  ],
  googl: [
    relation("googl-product", "googl", "googl-cloud", "software_dependency", 0, "confirmed", 0.89, "TPU and cloud AI services anchor the current subgraph.", ["googleCloud"]),
    relation("googl-broadcom", "googl-cloud", "broadcom", "component_supply", 1, "strong_evidence", 0.77, "Custom ASIC collaboration informs TPU-related supplier exposure.", ["googleCloud"]),
    relation("googl-nvidia", "googl-cloud", "nvidia", "cloud_service", 1, "strong_evidence", 0.8, "Google Cloud still exposes NVIDIA platforms for external workloads.", ["googleCloud"]),
    relation("googl-tsmc", "googl-cloud", "tsmc", "manufacturing", 1, "strong_evidence", 0.74, "Foundry dependence remains relevant for TPU and custom silicon.", ["tsmcAnnual"]),
  ],
  meta: [
    relation("meta-product", "meta", "meta-genai", "software_dependency", 0, "confirmed", 0.87, "Meta AI infra graph starts from Llama and MTIA system demand.", ["metaInfra"]),
    relation("meta-nvidia", "meta-genai", "nvidia", "cloud_service", 1, "strong_evidence", 0.82, "GPU cluster growth is still tightly linked to NVIDIA availability.", ["metaInfra"]),
    relation("meta-broadcom", "meta-genai", "broadcom", "component_supply", 1, "inferred", 0.66, "Custom silicon and networking relationships require additional direct disclosures.", ["metaInfra"]),
    relation("meta-tsmc", "meta-genai", "tsmc", "manufacturing", 1, "strong_evidence", 0.71, "Self-designed AI accelerators inherit foundry and packaging risk.", ["metaInfra", "tsmcAnnual"]),
  ],
  tsla: [
    relation("tsla-product", "tsla", "tsla-battery", "software_dependency", 0, "confirmed", 0.9, "Vehicle, energy storage, and FSD stack are grouped as one graph entry.", ["tesla10k"]),
    relation("tsla-panasonic", "tsla-battery", "panasonic-energy", "component_supply", 1, "strong_evidence", 0.83, "Cylindrical cell supply remains central to North America output.", ["tesla10k", "panasonicReport"]),
    relation("tsla-lges", "tsla-battery", "lges", "component_supply", 1, "strong_evidence", 0.77, "LGES provides alternate EV cell capacity and regional flexibility.", ["tesla10k"]),
    relation("tsla-catl", "tsla-battery", "catl", "component_supply", 1, "confirmed", 0.89, "LFP and energy storage exposure keep CATL strategically important.", ["tesla10k", "catlReport"]),
    relation("catl-ganfeng", "catl", "ganfeng", "raw_material_supply", 2, "strong_evidence", 0.73, "Lithium input risk propagates from CATL into Tesla cost structure.", ["catlReport"]),
    relation("tsla-nvidia", "tsla-battery", "nvidia", "cloud_service", 1, "inferred", 0.61, "Training compute remains relevant for FSD and robotics programs.", ["tesla10k"]),
  ],
};

export function getCompanies() {
  return companies;
}

export function getCompany(companyId: string) {
  return companies.find((company) => company.id === companyId) ?? companies[0];
}

export function getSubgraph(companyId: string, depth: number, search = "") {
  const company = getCompany(companyId);
  const graphNodes = nodesByCompany[company.id] ?? [];
  const graphRelations = (relationsByCompany[company.id] ?? []).filter((relation) => relation.tier <= depth);
  const normalizedSearch = search.trim().toLowerCase();

  const visibleNodeIds = new Set<string>();
  graphRelations.forEach((relation) => {
    visibleNodeIds.add(relation.sourceId);
    visibleNodeIds.add(relation.targetId);
  });

  let visibleNodes = graphNodes.filter((node) => visibleNodeIds.has(node.id));
  if (normalizedSearch) {
    const matchedIds = new Set(
      visibleNodes.filter((node) => `${node.label} ${node.secondaryLabel ?? ""}`.toLowerCase().includes(normalizedSearch)).map((node) => node.id),
    );
    graphRelations.forEach((relation) => {
      if (matchedIds.has(relation.sourceId) || matchedIds.has(relation.targetId)) {
        matchedIds.add(relation.sourceId);
        matchedIds.add(relation.targetId);
      }
    });
    visibleNodes = visibleNodes.filter((node) => matchedIds.has(node.id));
  }

  const visibleNodeSet = new Set(visibleNodes.map((node) => node.id));
  const visibleRelations = graphRelations.filter((relation) => visibleNodeSet.has(relation.sourceId) && visibleNodeSet.has(relation.targetId));
  const evidence = Array.from(new Set(visibleRelations.flatMap((relation) => relation.evidenceIds)))
    .map((id) => evidenceById[id])
    .filter(Boolean);

  return {
    snapshot,
    company,
    nodes: visibleNodes,
    relations: visibleRelations,
    evidence,
  };
}

function makeNode(
  id: string,
  label: string,
  secondaryLabel: string,
  kind: GraphNodeDTO["kind"],
  region: string,
  importanceScore: number,
  x: number,
  y: number,
  marketCapUsd?: number,
): GraphNodeDTO {
  return { id, label, secondaryLabel, kind, region, importanceScore, x, y, marketCapUsd };
}

function relation(
  id: string,
  sourceId: string,
  targetId: string,
  relationshipType: GraphRelationDTO["relationshipType"],
  tier: number,
  confidence: GraphRelationDTO["confidence"],
  confidenceScore: number,
  summary: string,
  evidenceIds: string[],
): GraphRelationDTO {
  return {
    id,
    sourceId,
    targetId,
    relationshipType,
    tier,
    confidence,
    confidenceScore,
    summary,
    evidenceIds,
  };
}

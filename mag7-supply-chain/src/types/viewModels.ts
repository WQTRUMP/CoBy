import type { EvidenceDTO, RelationDTO, SnapshotDTO } from "../contracts/api";

export interface GraphQuery {
  companyId: string;
  depth: number;
  search?: string;
}

export interface CompanyOptionViewModel {
  id: string;
  ticker: string;
  name: string;
  shortName: string;
  focus: string;
  primaryRegion: string;
  marketCapUsd: number | null;
  isMag7: boolean;
}

export interface CompanyProfileViewModel extends CompanyOptionViewModel {
  summary: string;
  stats: {
    supplierCount: number;
    tier1SupplierCount: number;
    relationCount: number;
    evidenceCount: number;
    criticalDependencyCount: number;
    evidenceCoverage: number;
  };
  apiBindings: {
    companyEndpoint: string;
    overviewEndpoint: string;
    graphEndpoint: string;
    evidenceEndpoint: string;
  };
  lastUpdated: string | null;
  source: "mock" | "neo4j";
}

export type GraphNodeKind = "company" | "facility" | "product" | "technology" | "material";

export interface GraphNodeViewModel {
  id: string;
  label: string;
  secondaryLabel: string;
  kind: GraphNodeKind;
  region: string;
  importanceScore: number;
  marketCapUsd: number | null;
  x: number;
  y: number;
  isAnchor: boolean;
}

export interface EvidenceViewModel {
  id: string;
  title: string;
  publisher: string;
  sourceType: EvidenceDTO["sourceType"];
  sourceTypeLabel: string;
  publishedAt: string;
  url: string;
  citation: string;
  excerpt: string;
  pageRef: string | null;
  confidence: RelationDTO["confidence"];
}

export interface GraphRelationViewModel {
  id: string;
  sourceId: string;
  targetId: string;
  relationshipType: RelationDTO["relationshipType"];
  tier: number;
  depthFromMag7: number;
  confidence: RelationDTO["confidence"];
  confidenceScore: number;
  summary: string;
  productScope: string[];
  notes: string | null;
  evidenceCount: number;
  evidence: EvidenceViewModel[];
  isDirectRelation: boolean;
}

export interface EvidenceSummaryViewModel {
  confirmed: number;
  strongEvidence: number;
  inferred: number;
}

export interface GraphViewModel {
  snapshot: SnapshotDTO;
  company: CompanyProfileViewModel;
  nodes: GraphNodeViewModel[];
  relations: GraphRelationViewModel[];
  evidenceSummary: EvidenceSummaryViewModel;
}

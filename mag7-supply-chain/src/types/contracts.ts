export type ConfidenceLevel = "confirmed" | "strong_evidence" | "inferred";
export type EntityKind = "company" | "product" | "supplier" | "material" | "facility";
export type RelationshipType =
  | "component_supply"
  | "manufacturing"
  | "cloud_service"
  | "raw_material_supply"
  | "equipment_supply"
  | "software_dependency";

export interface CompanySummary {
  id: string;
  ticker: string;
  name: string;
  shortName: string;
  focus: string;
  primaryRegion: string;
  marketCapUsd: number;
  riskLevel: "high" | "medium" | "low";
  lastUpdated: string;
}

export interface CompanyDetail extends CompanySummary {
  summary: string;
  stats: {
    supplierCount: number;
    relationCount: number;
    evidenceCoverage: number;
    criticalDependencyCount: number;
  };
  apiBindings: {
    overviewEndpoint: string;
    graphEndpoint: string;
    evidenceEndpoint: string;
  };
}

export interface EvidenceDTO {
  id: string;
  title: string;
  publisher: string;
  sourceType: "10-K" | "Earnings Call" | "Supplier Report" | "Industry Report" | "Media";
  publishedAt: string;
  url: string;
  citation: string;
  confidence: ConfidenceLevel;
  pageRef?: string;
}

export interface GraphNodeDTO {
  id: string;
  label: string;
  secondaryLabel?: string;
  kind: EntityKind;
  region: string;
  importanceScore: number;
  marketCapUsd?: number;
  x: number;
  y: number;
}

export interface GraphRelationDTO {
  id: string;
  sourceId: string;
  targetId: string;
  relationshipType: RelationshipType;
  tier: number;
  confidence: ConfidenceLevel;
  confidenceScore: number;
  summary: string;
  evidenceIds: string[];
}

export interface SnapshotDTO {
  id: string;
  version: string;
  publishedAt: string;
  status: "mock" | "published" | "draft";
}

export interface SubgraphDTO {
  snapshot: SnapshotDTO;
  company: CompanyDetail;
  nodes: GraphNodeDTO[];
  relations: GraphRelationDTO[];
  evidence: EvidenceDTO[];
}

export interface GraphQuery {
  companyId: string;
  depth: number;
  search?: string;
}

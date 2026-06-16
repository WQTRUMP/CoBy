import type { BackendSource, CompanySearchMatchDTO, EntityProfile, EvidenceDTO, RelationDTO, SnapshotDTO } from "@mag7/contracts";

export interface GraphQuery {
  companyId?: string | null;
  depth: number;
  search?: string;
  relationshipTypes?: RelationDTO["relationshipType"][];
  relationshipSubtype?: string | null;
}

export interface CompanyOptionViewModel {
  id: string;
  ticker: string;
  name: string;
  displayName: string;
  canonicalName: string;
  shortName: string;
  focus: string;
  searchMatch: CompanySearchMatchDTO | null;
  aliasHitExplanation: string | null;
  hierarchySummary: string;
  primaryRegion: string;
  marketCapUsd: number | null;
  isMag7: boolean;
  entityProfile: EntityProfile | null;
}

export interface CompanyProfileViewModel extends CompanyOptionViewModel {
  summary: string;
  overview: CompanyOverviewViewModel;
  apiBindings: {
    companyEndpoint: string;
    overviewEndpoint: string;
    graphEndpoint: string;
    evidenceEndpoint: string;
  };
  lastUpdated: string | null;
  source: BackendSource;
}

export interface CompanyOverviewViewModel {
  companyId: string;
  companyName: string;
  activeSnapshotId: string | null;
  supplierCount: number;
  tier1SupplierCount: number;
  relationCount: number;
  evidenceCount: number;
  criticalDependencyCount: number;
  evidenceCoverage: number;
  lastUpdated: string | null;
  source: BackendSource;
}

export type GraphNodeKind = "company" | "facility" | "product" | "technology" | "material";

export interface GraphNodeViewModel {
  id: string;
  label: string;
  secondaryLabel: string;
  displayName: string;
  canonicalName: string | null;
  hierarchySummary: string;
  kindLabel: string;
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
  publishedAtResolution: string;
  publishedAtResolutionLabel: string;
  publishedAtSemantic: string;
  reportedPeriodEnd: string | null;
  reportedPeriodEndResolutionLabel: string | null;
  retrievedAt: string;
  retrievedAtSemantic: string;
  compatibilityNote: string | null;
  url: string;
  citation: string;
  excerpt: string;
  pageRef: string | null;
  confidence: RelationDTO["confidence"];
  skuGranularityValue: string | null;
  skuGranularityLabel: string;
  skuGranularitySource: string | null;
  skuGranularitySourceLabel: string | null;
  skuGranularityRaw: string | null;
  skuGranularityNote: string | null;
  skuGranularityBoundaryHint: string | null;
  skuGranularityIsBackfilled: boolean;
}

export interface GraphRelationViewModel {
  id: string;
  sourceId: string;
  targetId: string;
  relationshipType: RelationDTO["relationshipType"];
  relationshipTypeLabel: string;
  relationshipSemanticLabel: string;
  relationshipSubtype: string | null;
  relationshipSubtypeLabel: string | null;
  tier: number;
  depthFromMag7: number;
  confidence: RelationDTO["confidence"];
  confidenceScore: number;
  summary: string;
  productScope: string[];
  notes: string | null;
  sourceMethod: string | null;
  sourceMethodLabel: string | null;
  evidenceDateResolution: string | null;
  evidenceDateResolutionLabel: string | null;
  validFrom: string | null;
  validFromResolution: string | null;
  validFromResolutionLabel: string | null;
  validTo: string | null;
  validToResolution: string | null;
  validToResolutionLabel: string | null;
  validityLabel: string;
  validityNote: string | null;
  evidenceCount: number;
  evidence: EvidenceViewModel[];
  isDirectRelation: boolean;
  skuGranularityValue: string | null;
  skuGranularityLabel: string;
  skuGranularitySource: string | null;
  skuGranularitySourceLabel: string | null;
  skuGranularityNote: string | null;
  skuGranularityBoundaryHint: string | null;
  skuGranularityIsBackfilled: boolean;
}

export interface RelationFilterOptionViewModel {
  count: number;
  label: string;
  value: string;
}

export interface EvidenceSummaryViewModel {
  confirmed: number;
  strongEvidence: number;
  inferred: number;
}

export interface GraphViewModel {
  snapshot: SnapshotDTO;
  focusCompany: CompanyProfileViewModel;
  nodes: GraphNodeViewModel[];
  relations: GraphRelationViewModel[];
  evidenceOverview: EvidenceSummaryViewModel;
  relationTypeOptions: RelationFilterOptionViewModel[];
  relationshipSubtypeOptions: RelationFilterOptionViewModel[];
}

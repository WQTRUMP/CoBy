import { z } from "zod";

export const backendSourceSchema = z.enum(["neo4j", "mock"]);
export const confidenceSchema = z.enum(["confirmed", "strong_evidence", "inferred"]);
export const relationStatusSchema = z.enum(["draft", "approved", "deprecated", "disputed"]);
export const dateResolutionSchema = z.enum([
  "year",
  "quarter",
  "month",
  "day",
  "datetime",
  "published_at",
  "filing_period",
  "undated",
]);
export const aliasTypeSchema = z.enum([
  "canonical",
  "legal_entity",
  "brand",
  "facility",
  "historical",
  "short_name",
  "search_hint",
]);
export const skuGranularitySchema = z.enum([
  "target_sku",
  "platform_component_sku",
  "family_only",
  "out_of_scope_sku",
]);

export const knownSourceTypes = [
  "10k",
  "earnings_call",
  "supplier_report",
  "supplier_page",
  "supplier_blog",
  "media",
  "authoritative_media",
  "industry_report",
  "press_release",
  "official_doc",
 ] as const;

export const sourceTypeSchema = z.enum(knownSourceTypes);

export const knownRelationshipTypes = [
  "component_supply",
  "raw_material_supply",
  "manufacturing",
  "cloud_service",
  "logistics",
  "professional_service",
  "equipment_supply",
  "software_dependency",
  "channel_partner",
 ] as const;

export const relationshipTypeSchema = z.string().min(1);

export const snapshotStatusSchema = z.enum(["draft", "review", "published", "archived"]);

export const knownEntityTypes = [
  "Company",
  "Facility",
  "Product",
  "Technology",
  "Material",
  "SupplyRelation",
  "Evidence",
  "Snapshot",
] as const;

export const entityTypeSchema = z.enum(knownEntityTypes);

export const entityAliasRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  normalizedName: z.string(),
  aliasType: aliasTypeSchema,
  language: z.string().nullable().optional(),
  isPrimary: z.boolean().default(false),
  validFrom: z.string().nullable().optional(),
  validTo: z.string().nullable().optional(),
  validFromResolution: dateResolutionSchema.nullable().optional(),
  validToResolution: dateResolutionSchema.nullable().optional(),
  source: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const entityProfileSchema = z.object({
  canonicalName: z.string(),
  displayName: z.string(),
  legalEntities: z.array(entityAliasRecordSchema).default([]),
  brands: z.array(entityAliasRecordSchema).default([]),
  aliases: z.array(entityAliasRecordSchema).default([]),
});

export const companySchema = z.object({
  id: z.string(),
  ticker: z.string().optional(),
  name: z.string(),
  canonicalName: z.string().optional(),
  displayName: z.string().optional(),
  entityType: z.literal("Company"),
  companyType: z.enum([
    "public_company",
    "supplier",
    "manufacturer",
    "logistics",
    "service_provider",
    "raw_material",
  ]),
  country: z.string(),
  isMag7: z.boolean(),
  marketCapUsd: z.number().nullable(),
  description: z.string().nullable().optional(),
  aliases: z.array(z.string()).default([]),
  entityProfile: entityProfileSchema.optional(),
  active: z.boolean().default(true),
  importanceScore: z.number().min(0).max(1).optional(),
});

export const companyListItemSchema = z.object({
  id: z.string(),
  ticker: z.string().optional(),
  name: z.string(),
  canonicalName: z.string().optional(),
  displayName: z.string().optional(),
  isMag7: z.boolean(),
  marketCapUsd: z.number().nullable(),
  entityProfile: entityProfileSchema.optional(),
  primaryRegion: z.string(),
  activeSnapshotId: z.string().nullable(),
});

export const companySearchMatchSchema = z.object({
  field: z.enum(["name", "ticker", "canonicalName", "displayName", "alias"]),
  value: z.string(),
  aliasType: aliasTypeSchema.nullable().optional(),
  explanation: z.string(),
});

export const companySearchResultItemSchema = companyListItemSchema.extend({
  match: companySearchMatchSchema.optional(),
});

export const companySuggestItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  secondaryLabel: z.string().optional(),
  ticker: z.string().optional(),
  isMag7: z.boolean(),
  canonicalName: z.string().optional(),
  displayName: z.string().optional(),
  entityProfile: entityProfileSchema.optional(),
  match: companySearchMatchSchema.optional(),
});

export const companyListQuerySchema = z.object({
  q: z.string().optional(),
  isMag7: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const companyListResponseSchema = z.object({
  items: z.array(companyListItemSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(100),
  total: z.number().int().min(0),
  source: backendSourceSchema,
});

export const evidenceSchema = z.object({
  id: z.string(),
  sourceType: sourceTypeSchema,
  skuGranularity: skuGranularitySchema.nullable().optional(),
  title: z.string(),
  publisher: z.string(),
  url: z.string().url(),
  publishedAt: z.string(),
  publishedAtResolution: dateResolutionSchema.default("published_at"),
  coverageStart: z.string().nullable().optional(),
  coverageEnd: z.string().nullable().optional(),
  coverageStartResolution: dateResolutionSchema.nullable().optional(),
  coverageEndResolution: dateResolutionSchema.nullable().optional(),
  retrievedAt: z.string(),
  excerpt: z.string(),
  pageRef: z.string().nullable().optional(),
  language: z.string().default("en"),
  hash: z.string(),
  sourceDomain: z.string(),
  citationText: z.string(),
  reliabilityTier: z.number().int().min(1).max(4),
  licenseNote: z.string().nullable().optional(),
  parserVersion: z.string(),
});

export const snapshotSchema = z.object({
  id: z.string(),
  version: z.string(),
  status: snapshotStatusSchema,
  publishedAt: z.string().nullable(),
  scope: z.array(z.string()),
  notes: z.string().nullable().optional(),
});

export const companyDetailSchema = companySchema.extend({
  primaryRegion: z.string(),
  activeSnapshotId: z.string().nullable(),
  summary: z.string().nullable().optional(),
  lastUpdatedAt: z.string().nullable().optional(),
});

export const companyDetailResponseSchema = z.object({
  item: companyDetailSchema,
  source: backendSourceSchema,
});

export const companyOverviewSchema = z.object({
  companyId: z.string(),
  companyName: z.string(),
  activeSnapshotId: z.string().nullable(),
  totalRelations: z.number().int().min(0),
  tier1SupplierCount: z.number().int().min(0),
  supplierCount: z.number().int().min(0),
  highRiskRelationCount: z.number().int().min(0),
  evidenceCount: z.number().int().min(0),
  evidenceCoverage: z.number().min(0).max(1),
  lastUpdatedAt: z.string().nullable(),
  source: backendSourceSchema,
});

export const graphNodeSchema = z.object({
  id: z.string(),
  entityType: entityTypeSchema.exclude(["SupplyRelation", "Evidence", "Snapshot"]),
  label: z.string(),
  company: companyDetailSchema.optional(),
  country: z.string().optional(),
  marketCapUsd: z.number().nullable().optional(),
  importanceScore: z.number().min(0).max(1).optional(),
});

export const relationSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  targetId: z.string(),
  relationshipType: relationshipTypeSchema,
  skuGranularity: skuGranularitySchema.nullable().optional(),
  relationshipSubtype: z.string().nullable().optional(),
  tier: z.number().int().min(1),
  depthFromMag7: z.number().int().min(0),
  confidence: confidenceSchema,
  confidenceScore: z.number().min(0).max(1),
  summary: z.string(),
  productScope: z.array(z.string()).default([]),
  notes: z.string().nullable().optional(),
  evidenceIds: z.array(z.string()).default([]),
  primaryEvidenceId: z.string().nullable().optional(),
  evidenceCount: z.number().int().min(0),
  snapshotId: z.string(),
  status: relationStatusSchema,
  sourceMethod: z.string().nullable().optional(),
  evidenceDate: z.string().nullable().optional(),
  evidenceDateResolution: dateResolutionSchema.nullable().optional(),
  evidenceDateNormalized: z.string().nullable().optional(),
  evidenceDateIsNormalized: z.boolean().optional(),
  sourceCount: z.number().int().min(0).optional(),
  lineageKey: z.string().nullable().optional(),
  lastVerifiedAt: z.string().nullable().optional(),
  validFrom: z.string().nullable().optional(),
  validFromResolution: dateResolutionSchema.nullable().optional(),
  validTo: z.string().nullable().optional(),
  validToResolution: dateResolutionSchema.nullable().optional(),
  validityNote: z.string().nullable().optional(),
  evidence: z.array(evidenceSchema).optional(),
});

export const subgraphQuerySchema = z.object({
  companyId: z.string(),
  depth: z.coerce.number().int().min(1).max(5).default(2),
  relationshipTypes: z
    .union([relationshipTypeSchema, z.array(relationshipTypeSchema)])
    .transform((value: z.infer<typeof relationshipTypeSchema> | Array<z.infer<typeof relationshipTypeSchema>>) =>
      Array.isArray(value) ? value : [value],
    )
    .optional(),
  snapshot: z.string().default("published"),
  includeEvidence: z.coerce.boolean().default(false),
});

export const subgraphSchema = z.object({
  snapshot: snapshotSchema,
  nodes: z.array(graphNodeSchema),
  relations: z.array(relationSchema),
});

export const searchCompaniesQuerySchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  isMag7: z.coerce.boolean().optional(),
});

export const searchCompaniesResponseSchema = z.object({
  items: z.array(companySearchResultItemSchema),
  total: z.number().int().min(0),
  query: z.string(),
  source: backendSourceSchema,
});

export const suggestCompaniesQuerySchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(20).default(8),
});

export const suggestCompaniesResponseSchema = z.object({
  items: z.array(companySuggestItemSchema),
  total: z.number().int().min(0),
  query: z.string(),
  source: backendSourceSchema,
});

export const graphPathQuerySchema = z.object({
  sourceCompanyId: z.string(),
  targetCompanyId: z.string(),
  maxDepth: z.coerce.number().int().min(1).max(4).default(3),
  snapshot: z.string().default("published"),
  includeEvidence: z.coerce.boolean().default(false),
});

export const graphStatsQuerySchema = z.object({
  snapshot: z.string().default("published"),
  companyId: z.string().optional(),
});

export const graphStatsSchema = z.object({
  snapshot: snapshotSchema.nullable(),
  companyCount: z.number().int().min(0),
  relationCount: z.number().int().min(0),
  evidenceCount: z.number().int().min(0),
  mag7CompanyCount: z.number().int().min(0),
  relationshipTypeBreakdown: z.record(z.string(), z.number().int().min(0)),
  confidenceBreakdown: z.record(z.string(), z.number().int().min(0)),
  source: backendSourceSchema,
});

export const relationEvidenceResponseSchema = z.object({
  relationId: z.string(),
  items: z.array(evidenceSchema),
  total: z.number().int().min(0),
  source: backendSourceSchema,
});

const legacyDateResolutionAliases = {
  "month-normalized": "month",
  metadata_date_published: "published_at",
  retrieved_at_only: "undated",
} as const;

const legacyDateResolutionAliasSchema = z.enum([
  "month-normalized",
  "metadata_date_published",
  "retrieved_at_only",
]);

const legacySkuGranularityAliasSchema = z.enum(["target_sku_or_official_component"]);

const dateResolutionCompatSchema = z
  .union([dateResolutionSchema, legacyDateResolutionAliasSchema])
  .transform((value) => legacyDateResolutionAliases[value as keyof typeof legacyDateResolutionAliases] ?? value);

const skuGranularityCompatSchema = z
  .union([skuGranularitySchema, legacySkuGranularityAliasSchema])
  .transform((value) =>
    value === "target_sku_or_official_component" ? "platform_component_sku" : value,
  );

export const importEntityRefSchema = z.object({
  entity_id: z.string(),
  display_name: z.string(),
  legal_entity_name: z.string().nullable().optional(),
});

const standardizedImportRelationRecordBaseSchema = z.object({
  relation_id: z.string(),
  snapshot_id: z.string(),
  company: z.string(),
  company_slug: z.string(),
  supplier: z.string(),
  supplier_slug: z.string(),
  tier: z.number().int().min(1),
  depth_from_mag7: z.number().int().min(0),
  relationship_type: relationshipTypeSchema,
  sku_granularity: skuGranularityCompatSchema.nullable().optional(),
  relationship_subtype: z.string(),
  product_scope: z.array(z.string()).min(1),
  evidence_ids: z.array(z.string()).min(1),
  primary_evidence_id: z.string(),
  evidence_date: z.string(),
  evidence_date_resolution: dateResolutionCompatSchema,
  evidence_date_normalized: z.string().nullable().optional(),
  evidence_date_is_normalized: z.boolean().optional(),
  evidence_excerpt: z.string(),
  source_url: z.string().url(),
  confidence_label: confidenceSchema,
  confidence_score: z.number().min(0).max(1),
  source_method: z.string(),
  source_count: z.number().int().min(1),
  status: relationStatusSchema,
  summary: z.string(),
  notes: z.string().optional(),
  lineage_key: z.string(),
  source_report_path: z.string(),
  last_verified_at: z.string(),
});

const standardizedImportRelationRecordV2Schema = standardizedImportRelationRecordBaseSchema.extend({
  company_entity_ref: importEntityRefSchema.optional(),
  supplier_entity_ref: importEntityRefSchema.optional(),
  valid_from: z.string().nullable().optional(),
  valid_from_resolution: dateResolutionCompatSchema.nullable().optional(),
  valid_to: z.string().nullable().optional(),
  valid_to_resolution: dateResolutionCompatSchema.nullable().optional(),
  validity_note: z.string().nullable().optional(),
});

const standardizedImportRelationRecordV3Schema = standardizedImportRelationRecordBaseSchema.extend({
  company_entity_ref: importEntityRefSchema,
  supplier_entity_ref: importEntityRefSchema,
  valid_from: z.string().nullable().optional(),
  valid_from_resolution: dateResolutionCompatSchema.nullable().optional(),
  valid_to: z.string().nullable().optional(),
  valid_to_resolution: dateResolutionCompatSchema.nullable().optional(),
  validity_note: z.string().nullable().optional(),
});

export const standardizedImportRelationRecordSchema = z
  .union([standardizedImportRelationRecordV2Schema, standardizedImportRelationRecordV3Schema])
  .transform((record) => {
    const evidenceDateIsMonthNormalized = record.evidence_date_resolution === "month";
    const validFromIsMonthNormalized = record.valid_from_resolution === "month";
    const validToIsMonthNormalized = record.valid_to_resolution === "month";

    return {
      ...record,
      company_entity_ref:
        record.company_entity_ref ?? {
          entity_id: `company:${record.company_slug}`,
          display_name: record.company,
          legal_entity_name: record.company,
        },
      supplier_entity_ref:
        record.supplier_entity_ref ?? {
          entity_id: `company:${record.supplier_slug}`,
          display_name: record.supplier,
          legal_entity_name: record.supplier,
        },
      evidence_date_resolution: record.evidence_date_resolution,
      evidence_date_normalized:
        record.evidence_date_normalized ??
        (evidenceDateIsMonthNormalized ? record.evidence_date : null),
      evidence_date_is_normalized:
        record.evidence_date_is_normalized ?? evidenceDateIsMonthNormalized,
      valid_from_resolution:
        record.valid_from_resolution == null
          ? null
          : record.valid_from_resolution,
      valid_to_resolution:
        record.valid_to_resolution == null
          ? null
          : record.valid_to_resolution,
    };
  });

export const standardizedImportEvidenceRecordSchema = z.object({
  evidence_id: z.string(),
  relation_id: z.string(),
  source_type: sourceTypeSchema,
  title: z.string(),
  publisher: z.string(),
  source_url: z.string().url(),
  source_domain: z.string(),
  sku_granularity: skuGranularityCompatSchema.nullable().optional(),
  published_at: z.string(),
  published_at_resolution: dateResolutionCompatSchema,
  coverage_start: z.string().nullable().optional(),
  coverage_end: z.string().nullable().optional(),
  coverage_start_resolution: dateResolutionSchema.nullable().optional(),
  coverage_end_resolution: dateResolutionSchema.nullable().optional(),
  retrieved_at: z.string(),
  excerpt: z.string(),
  citation_text: z.string(),
  page_ref: z.string().nullable().optional(),
  language: z.string().optional(),
  reliability_tier: z.number().int().min(1).max(4),
  parser_version: z.string(),
  license_note: z.string().nullable().optional(),
  source_report_path: z.string(),
  notes: z.string().nullable().optional(),
}).transform((record) => ({
  ...record,
  published_at_resolution: record.published_at_resolution,
}));

export const standardizedImportPackageSchema = z.object({
  schemaVersion: z.string().default("mag7-supply-chain.import-relations.v3"),
  relations: z.array(standardizedImportRelationRecordSchema).min(1),
  evidence: z.array(standardizedImportEvidenceRecordSchema).min(1),
});

export const importRelationsRequestSchema = z.object({
  requestId: z.string(),
  source: z.string(),
  dataVersion: z.string(),
  schemaVersion: z.string().default("mag7-supply-chain.import-relations.v3"),
  relations: z.array(standardizedImportRelationRecordSchema).min(1),
});

export const importRelationsFieldCatalog = [
  {
    name: "relation_id",
    type: "string",
    required: true,
    description: "Stable relation primary key from the normalized package.",
  },
  {
    name: "snapshot_id",
    type: "string",
    required: true,
    description: "Snapshot identifier that versions this relation fact.",
  },
  {
    name: "company",
    type: "string",
    required: true,
    description: "Downstream company display label.",
  },
  {
    name: "company_slug",
    type: "string",
    required: true,
    description: "Canonical downstream company slug.",
  },
  {
    name: "supplier",
    type: "string",
    required: true,
    description: "Upstream supplier display label.",
  },
  {
    name: "supplier_slug",
    type: "string",
    required: true,
    description: "Canonical upstream supplier slug.",
  },
  {
    name: "tier",
    type: "integer",
    required: true,
    description: "Supplier tier relative to the downstream company.",
  },
  {
    name: "depth_from_mag7",
    type: "integer",
    required: true,
    description: "Traversal depth from the Mag7 anchor company.",
  },
  {
    name: "relationship_type",
    type: "string",
    required: true,
    description: "Normalized supply-chain relationship type. Open string to avoid blocking newly promoted edge categories.",
  },
  {
    name: "sku_granularity",
    type: "enum",
    required: false,
    description: "Optional target-SKU specificity marker used to distinguish target SKU, platform component SKU, family-only, and out-of-scope SKU boundaries.",
  },
  {
    name: "relationship_subtype",
    type: "string",
    required: true,
    description: "Human-readable subtype preserved from research normalization.",
  },
  {
    name: "product_scope",
    type: "string[]",
    required: true,
    description: "Lossless array of products, materials, services, or technologies in scope.",
  },
  {
    name: "evidence_ids",
    type: "string[]",
    required: true,
    description: "All evidence identifiers attached to the relation.",
  },
  {
    name: "primary_evidence_id",
    type: "string",
    required: true,
    description: "Primary evidence identifier for summary and ranking.",
  },
  {
    name: "company_entity_ref",
    type: "object",
    required: true,
    description: "Canonical downstream entity reference with display and legal naming context.",
  },
  {
    name: "supplier_entity_ref",
    type: "object",
    required: true,
    description: "Canonical upstream entity reference with display and legal naming context.",
  },
  {
    name: "evidence_date",
    type: "string",
    required: true,
    description: "Evidence time anchor or covered period string; not necessarily a day-level date.",
  },
  {
    name: "evidence_date_resolution",
    type: "enum",
    required: true,
    description: "Explicit date precision for the evidence time anchor.",
  },
  {
    name: "evidence_date_normalized",
    type: "string",
    required: false,
    description: "Optional ISO day-level anchor derived for sorting or bucketing when the evidence date is coarser than a day.",
  },
  {
    name: "evidence_date_is_normalized",
    type: "boolean",
    required: false,
    description: "True when the normalized anchor is system-derived and must not be treated as original day-level evidence.",
  },
  {
    name: "evidence_excerpt",
    type: "string",
    required: true,
    description: "Supporting excerpt kept for auditability and UI display.",
  },
  {
    name: "source_url",
    type: "string",
    required: true,
    description: "Canonical URL for the primary evidence source.",
  },
  {
    name: "confidence_label",
    type: "enum",
    required: true,
    description: "Display confidence bucket.",
  },
  {
    name: "confidence_score",
    type: "number",
    required: true,
    description: "Continuous confidence score between 0 and 1.",
  },
  {
    name: "valid_from",
    type: "string",
    required: false,
    description: "When the relation is believed to start being effective, distinct from evidence publication time.",
  },
  {
    name: "valid_from_resolution",
    type: "enum",
    required: false,
    description: "Explicit precision for valid_from.",
  },
  {
    name: "valid_to",
    type: "string",
    required: false,
    description: "When the relation is believed to stop being effective, if known.",
  },
  {
    name: "valid_to_resolution",
    type: "enum",
    required: false,
    description: "Explicit precision for valid_to.",
  },
  {
    name: "validity_note",
    type: "string",
    required: false,
    description: "Optional explanation for inferred or quarter/month-level validity bounds.",
  },
  {
    name: "source_method",
    type: "string",
    required: true,
    description: "Collection method used to derive the relation.",
  },
  {
    name: "source_count",
    type: "integer",
    required: true,
    description: "Number of supporting sources considered during normalization.",
  },
  {
    name: "status",
    type: "enum",
    required: true,
    description: "Lifecycle status of the relation fact.",
  },
  {
    name: "summary",
    type: "string",
    required: true,
    description: "Canonical analyst summary for the relation.",
  },
  {
    name: "notes",
    type: "string",
    required: false,
    description: "Optional analyst notes and caveats.",
  },
  {
    name: "lineage_key",
    type: "string",
    required: true,
    description: "Lineage key used for deduplication and version tracking.",
  },
  {
    name: "source_report_path",
    type: "string",
    required: true,
    description: "Collector output path where the evidence bundle originated.",
  },
  {
    name: "last_verified_at",
    type: "string",
    required: true,
    description: "Latest verification timestamp for this relation.",
  },
] as const;

export type BackendSource = z.infer<typeof backendSourceSchema>;
export type DateResolution = z.infer<typeof dateResolutionSchema>;
export type AliasType = z.infer<typeof aliasTypeSchema>;
export type SkuGranularity = z.infer<typeof skuGranularitySchema>;
export type CompanyDTO = z.infer<typeof companySchema>;
export type CompanyListItemDTO = z.infer<typeof companyListItemSchema>;
export type CompanySearchMatchDTO = z.infer<typeof companySearchMatchSchema>;
export type CompanySearchResultItemDTO = z.infer<typeof companySearchResultItemSchema>;
export type CompanySuggestItemDTO = z.infer<typeof companySuggestItemSchema>;
export type CompanyListQuery = z.infer<typeof companyListQuerySchema>;
export type CompanyListResponseDTO = z.infer<typeof companyListResponseSchema>;
export type CompanyDetailDTO = z.infer<typeof companyDetailSchema>;
export type CompanyDetailResponseDTO = z.infer<typeof companyDetailResponseSchema>;
export type CompanyOverviewDTO = z.infer<typeof companyOverviewSchema>;
export type EntityAliasRecord = z.infer<typeof entityAliasRecordSchema>;
export type EntityProfile = z.infer<typeof entityProfileSchema>;
export type EvidenceDTO = z.infer<typeof evidenceSchema>;
export type GraphNodeDTO = z.infer<typeof graphNodeSchema>;
export type GraphPathQuery = z.infer<typeof graphPathQuerySchema>;
export type GraphStatsDTO = z.infer<typeof graphStatsSchema>;
export type GraphStatsQuery = z.infer<typeof graphStatsQuerySchema>;
export type RelationDTO = z.infer<typeof relationSchema>;
export type SearchCompaniesQuery = z.infer<typeof searchCompaniesQuerySchema>;
export type SearchCompaniesResponseDTO = z.infer<typeof searchCompaniesResponseSchema>;
export type SnapshotDTO = z.infer<typeof snapshotSchema>;
export type SuggestCompaniesQuery = z.infer<typeof suggestCompaniesQuerySchema>;
export type SuggestCompaniesResponseDTO = z.infer<typeof suggestCompaniesResponseSchema>;
export type SubgraphDTO = z.infer<typeof subgraphSchema>;
export type SubgraphQuery = z.infer<typeof subgraphQuerySchema>;
export type RelationEvidenceResponseDTO = z.infer<typeof relationEvidenceResponseSchema>;
export type ImportEntityRef = z.infer<typeof importEntityRefSchema>;
export type StandardizedImportRelationRecord = z.infer<typeof standardizedImportRelationRecordSchema>;
export type StandardizedImportEvidenceRecord = z.infer<typeof standardizedImportEvidenceRecordSchema>;
export type StandardizedImportPackage = z.infer<typeof standardizedImportPackageSchema>;
export type ImportRelationsRequest = z.infer<typeof importRelationsRequestSchema>;

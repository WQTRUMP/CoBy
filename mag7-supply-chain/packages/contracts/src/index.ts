import { z } from "zod";

export const confidenceSchema = z.enum(["confirmed", "strong_evidence", "inferred"]);
export const relationStatusSchema = z.enum(["draft", "approved", "deprecated", "disputed"]);

export const sourceTypeSchema = z.enum([
  "10k",
  "earnings_call",
  "supplier_report",
  "media",
  "industry_report",
  "press_release",
]);

export const relationshipTypeSchema = z.enum([
  "component_supply",
  "raw_material_supply",
  "manufacturing",
  "cloud_service",
  "logistics",
  "professional_service",
  "equipment_supply",
  "software_dependency",
  "channel_partner",
]);

export const snapshotStatusSchema = z.enum(["draft", "review", "published", "archived"]);

export const entityTypeSchema = z.enum([
  "Company",
  "Facility",
  "Product",
  "Technology",
  "Material",
  "SupplyRelation",
  "Evidence",
  "Snapshot",
]);

export const companySchema = z.object({
  id: z.string(),
  ticker: z.string().optional(),
  name: z.string(),
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
  active: z.boolean().default(true),
  importanceScore: z.number().min(0).max(1).optional(),
});

export const evidenceSchema = z.object({
  id: z.string(),
  sourceType: sourceTypeSchema,
  title: z.string(),
  publisher: z.string(),
  url: z.string().url(),
  publishedAt: z.string(),
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

export const graphNodeSchema = z.object({
  id: z.string(),
  entityType: entityTypeSchema.exclude(["SupplyRelation", "Evidence", "Snapshot"]),
  label: z.string(),
  company: companySchema.optional(),
  country: z.string().optional(),
  marketCapUsd: z.number().nullable().optional(),
  importanceScore: z.number().min(0).max(1).optional(),
});

export const relationSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  targetId: z.string(),
  relationshipType: relationshipTypeSchema,
  tier: z.number().int().min(1),
  depthFromMag7: z.number().int().min(0),
  confidence: confidenceSchema,
  confidenceScore: z.number().min(0).max(1),
  summary: z.string(),
  productScope: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  evidenceCount: z.number().int().min(0),
  snapshotId: z.string(),
  status: relationStatusSchema,
  validFrom: z.string().nullable().optional(),
  validTo: z.string().nullable().optional(),
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

export const standardizedImportRelationRecordSchema = z.object({
  company: z.string(),
  supplier: z.string(),
  tier: z.number().int().min(1),
  relationship_type: relationshipTypeSchema,
  product_scope: z.string(),
  evidence_date: z.string(),
  evidence_excerpt: z.string(),
  source_url: z.string().url(),
  confidence_label: confidenceSchema,
  confidence_score: z.number().min(0).max(1),
  notes: z.string(),
  source_type: sourceTypeSchema.optional(),
  source_title: z.string().optional(),
  source_publisher: z.string().optional(),
  evidence_page_ref: z.string().optional(),
  source_domain: z.string().optional(),
  parser_version: z.string().optional(),
  reliability_tier: z.number().int().min(1).max(4).optional(),
  depth_from_mag7: z.number().int().min(0).optional(),
  snapshot_id: z.string().optional(),
});

export const importRelationsRequestSchema = z.object({
  requestId: z.string(),
  source: z.string(),
  dataVersion: z.string(),
  schemaVersion: z.string().default("mag7-supply-chain.import-relations.v1"),
  relations: z.array(standardizedImportRelationRecordSchema).min(1),
});

export const importRelationsFieldCatalog = [
  {
    name: "company",
    type: "string",
    required: true,
    description: "Target Mag7 or downstream company canonical label or identifier.",
  },
  {
    name: "supplier",
    type: "string",
    required: true,
    description: "Supplier or upstream provider canonical label or identifier.",
  },
  {
    name: "tier",
    type: "integer",
    required: true,
    description: "Supplier tier relative to the target company.",
  },
  {
    name: "relationship_type",
    type: "enum",
    required: true,
    description: "Normalized supply-chain relationship type.",
  },
  {
    name: "product_scope",
    type: "string",
    required: true,
    description: "Product, component, material, or service scope for the relation.",
  },
  {
    name: "evidence_date",
    type: "string",
    required: true,
    description: "Source publication date in ISO-8601 string form.",
  },
  {
    name: "evidence_excerpt",
    type: "string",
    required: true,
    description: "Short evidence excerpt used for downstream review and display.",
  },
  {
    name: "source_url",
    type: "string",
    required: true,
    description: "Canonical source URL for the evidence item.",
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
    name: "notes",
    type: "string",
    required: true,
    description: "Analyst notes, caveats, or inference chain context.",
  },
] as const;

export type CompanyDTO = z.infer<typeof companySchema>;
export type EvidenceDTO = z.infer<typeof evidenceSchema>;
export type SnapshotDTO = z.infer<typeof snapshotSchema>;
export type GraphNodeDTO = z.infer<typeof graphNodeSchema>;
export type RelationDTO = z.infer<typeof relationSchema>;
export type SubgraphDTO = z.infer<typeof subgraphSchema>;
export type SubgraphQuery = z.infer<typeof subgraphQuerySchema>;
export type StandardizedImportRelationRecord = z.infer<typeof standardizedImportRelationRecordSchema>;
export type ImportRelationsRequest = z.infer<typeof importRelationsRequestSchema>;

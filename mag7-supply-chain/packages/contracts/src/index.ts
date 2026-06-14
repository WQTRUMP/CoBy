import { z } from "zod";

export const confidenceSchema = z.enum(["confirmed", "strong_evidence", "inferred"]);

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
  evidenceCount: z.number().int().min(0),
  snapshotId: z.string(),
  status: z.enum(["draft", "approved", "deprecated", "disputed"]),
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

export const importRelationRecordSchema = z.object({
  sourceCompanyId: z.string(),
  targetCompanyId: z.string(),
  relationshipType: relationshipTypeSchema,
  tier: z.number().int().min(1),
  depthFromMag7: z.number().int().min(0),
  confidence: confidenceSchema,
  confidenceScore: z.number().min(0).max(1),
  summary: z.string(),
  lineageKey: z.string(),
  snapshotId: z.string(),
  evidence: z.array(evidenceSchema).min(1),
});

export const importRelationsRequestSchema = z.object({
  requestId: z.string(),
  source: z.string(),
  dataVersion: z.string(),
  relations: z.array(importRelationRecordSchema).min(1),
});

export type CompanyDTO = z.infer<typeof companySchema>;
export type EvidenceDTO = z.infer<typeof evidenceSchema>;
export type SnapshotDTO = z.infer<typeof snapshotSchema>;
export type GraphNodeDTO = z.infer<typeof graphNodeSchema>;
export type RelationDTO = z.infer<typeof relationSchema>;
export type SubgraphDTO = z.infer<typeof subgraphSchema>;
export type SubgraphQuery = z.infer<typeof subgraphQuerySchema>;
export type ImportRelationsRequest = z.infer<typeof importRelationsRequestSchema>;

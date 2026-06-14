import { z } from "zod";

export {
  companySchema,
  confidenceSchema,
  evidenceSchema,
  graphNodeSchema,
  relationSchema,
  relationshipTypeSchema,
  snapshotSchema,
  sourceTypeSchema,
  subgraphQuerySchema,
  subgraphSchema,
} from "../../packages/contracts/src/index";

export type {
  CompanyDTO,
  EvidenceDTO,
  GraphNodeDTO,
  RelationDTO,
  SnapshotDTO,
  SubgraphDTO,
  SubgraphQuery,
} from "../../packages/contracts/src/index";

import {
  companySchema,
  evidenceSchema,
  subgraphSchema,
} from "../../packages/contracts/src/index";

export const apiSourceSchema = z.enum(["mock", "neo4j"]);

export const companiesResponseSchema = z.object({
  items: z.array(companySchema),
  total: z.number().int().nonnegative(),
  source: apiSourceSchema,
});

export const companyResponseSchema = z.object({
  item: companySchema,
  source: apiSourceSchema,
});

export const companyOverviewSchema = z.object({
  companyId: z.string(),
  companyName: z.string(),
  totalRelations: z.number().int().nonnegative(),
  supplierCount: z.number().int().nonnegative(),
  evidenceCount: z.number().int().nonnegative(),
  lastUpdatedAt: z.string().nullable(),
  source: apiSourceSchema.optional(),
});

export const relationEvidenceResponseSchema = z.object({
  relationId: z.string(),
  items: z.array(evidenceSchema),
  total: z.number().int().nonnegative(),
  source: apiSourceSchema,
});

export const subgraphResponseSchema = subgraphSchema;

export type ApiSource = z.infer<typeof apiSourceSchema>;
export type CompaniesResponse = z.infer<typeof companiesResponseSchema>;
export type CompanyResponse = z.infer<typeof companyResponseSchema>;
export type CompanyOverviewDTO = z.infer<typeof companyOverviewSchema>;
export type RelationEvidenceResponse = z.infer<typeof relationEvidenceResponseSchema>;

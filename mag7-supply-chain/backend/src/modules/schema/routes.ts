import type { FastifyInstance } from "fastify";

import {
  aliasTypeSchema,
  confidenceSchema,
  dateResolutionSchema,
  importRelationsFieldCatalog,
  knownRelationshipTypes,
  knownSourceTypes,
  skuGranularitySourceSchema,
  skuGranularitySchema,
} from "@mag7/contracts";

export async function registerSchemaRoutes(app: FastifyInstance) {
  app.get("/api/v1/schema/import-relations", async () => {
    return {
      schemaVersion: "mag7-supply-chain.import-relations.v3",
      mode:
        app.runtimeMode === "prototype"
          ? "prototype-mock-ready"
          : "live-database-required",
      fields: importRelationsFieldCatalog,
      enums: {
        relationship_type: knownRelationshipTypes,
        confidence_label: confidenceSchema.options,
        source_type: knownSourceTypes,
        date_resolution: dateResolutionSchema.options,
        alias_type: aliasTypeSchema.options,
        sku_granularity: skuGranularitySchema.options,
        sku_granularity_detail_source: skuGranularitySourceSchema.options,
      },
      compatibility: {
        previousSchemaVersions: ["mag7-supply-chain.import-relations.v2"],
      },
      guidance: {
        requiredEvidenceFields: ["evidence_ids", "primary_evidence_id", "evidence_date", "evidence_excerpt", "source_url"],
        relationEvidenceBinding: "Use relation_id -> SUPPORTED_BY edges for evidence grouping; do not rely on Evidence.relationId in query consumers.",
        temporalSemantics:
          "evidence_date anchors the evidence time or covered period; valid_from/valid_to describe relation effectiveness and must not default from evidence_date.",
        notes:
          "Use this schema as the lossless ingestion boundary for standardized research packages; preserve entity refs, date resolution fields, and audit metadata end to end.",
      },
    };
  });
}

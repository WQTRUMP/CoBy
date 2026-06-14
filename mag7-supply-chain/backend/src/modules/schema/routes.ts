import type { FastifyInstance } from "fastify";

import {
  confidenceSchema,
  importRelationsFieldCatalog,
  relationshipTypeSchema,
  sourceTypeSchema,
} from "../../../../packages/contracts/src/index.js";

export async function registerSchemaRoutes(app: FastifyInstance) {
  app.get("/api/v1/schema/import-relations", async () => {
    return {
      schemaVersion: "mag7-supply-chain.import-relations.v2",
      mode: app.graphRepository.source === "mock" ? "mock-ready" : "database-ready",
      fields: importRelationsFieldCatalog,
      enums: {
        relationship_type: relationshipTypeSchema.options,
        confidence_label: confidenceSchema.options,
        source_type: sourceTypeSchema.options,
      },
      guidance: {
        requiredEvidenceFields: ["evidence_ids", "primary_evidence_id", "evidence_date", "evidence_excerpt", "source_url"],
        relationEvidenceBinding: "Use relation_id -> SUPPORTED_BY edges for evidence grouping; do not rely on Evidence.relationId in query consumers.",
        notes:
          "Use this schema as the lossless ingestion boundary for standardized research packages; preserve product_scope arrays and audit fields end to end.",
      },
    };
  });
}

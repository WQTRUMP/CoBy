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
      schemaVersion: "mag7-supply-chain.import-relations.v1",
      mode: app.graphRepository.source === "mock" ? "mock-ready" : "database-ready",
      fields: importRelationsFieldCatalog,
      enums: {
        relationship_type: relationshipTypeSchema.options,
        confidence_label: confidenceSchema.options,
        source_type: sourceTypeSchema.options,
      },
      guidance: {
        requiredEvidenceFields: ["evidence_date", "evidence_excerpt", "source_url"],
        notes:
          "Use this schema as the ingestion boundary for standardized research packages; do not reuse frontend mock fields.",
      },
    };
  });
}

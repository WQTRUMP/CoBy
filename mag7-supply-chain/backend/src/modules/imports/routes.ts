import type { FastifyInstance } from "fastify";

import { importRelationsRequestSchema } from "../../../../packages/contracts/src/index.js";

export async function registerImportRoutes(app: FastifyInstance) {
  app.post("/api/v1/imports/relations", async (request, reply) => {
    const payload = importRelationsRequestSchema.parse(request.body);

    reply.code(202);
    return {
      accepted: true,
      requestId: payload.requestId,
      schemaVersion: payload.schemaVersion,
      relationCount: payload.relations.length,
      storageMode: "reserved",
      reservedFields: [
        "company",
        "supplier",
        "tier",
        "relationship_type",
        "product_scope",
        "evidence_date",
        "evidence_excerpt",
        "source_url",
        "confidence_label",
        "confidence_score",
        "notes",
      ],
      nextStep: "persist standardized package to Neo4j/Object Storage pipeline",
    };
  });
}

import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { importRelationsRequestSchema } from "../../../../packages/contracts/src/index.js";
import {
  loadNormalizedImportPackage,
  prepareNormalizedImport,
} from "../../lib/normalized-package.js";

const normalizedImportRequestSchema = z.object({
  requestId: z.string(),
  relationFile: z.string(),
  evidenceFile: z.string(),
});

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

  app.post("/api/v1/imports/normalized-package", async (request, reply) => {
    const payload = normalizedImportRequestSchema.parse(request.body);
    const pkg = await loadNormalizedImportPackage(payload.relationFile, payload.evidenceFile);
    const prepared = prepareNormalizedImport(pkg);
    const summary = await app.graphRepository.importNormalizedPackage(prepared);

    reply.code(202);
    return {
      accepted: true,
      requestId: payload.requestId,
      source: app.graphRepository.source,
      relationFile: payload.relationFile,
      evidenceFile: payload.evidenceFile,
      ...summary,
    };
  });
}

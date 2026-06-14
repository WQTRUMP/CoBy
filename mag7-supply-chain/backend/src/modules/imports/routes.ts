import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  importRelationsFieldCatalog,
  importRelationsRequestSchema,
} from "@mag7/contracts";
import {
  loadNormalizedImportPackage,
  prepareNormalizedImport,
} from "../../lib/normalized-package.js";
import { parseRequest } from "../../lib/request-validation.js";

const normalizedImportRequestSchema = z.object({
  requestId: z.string(),
  relationFile: z.string(),
  evidenceFile: z.string(),
});

export async function registerImportRoutes(app: FastifyInstance) {
  app.post("/api/v1/imports/relations", async (request, reply) => {
    const payload = parseRequest(importRelationsRequestSchema, request.body);

    reply.code(202);
    return {
      accepted: true,
      requestId: payload.requestId,
      schemaVersion: payload.schemaVersion,
      relationCount: payload.relations.length,
      storageMode: "lossless",
      reservedFields: importRelationsFieldCatalog.map((field) => field.name),
      nextStep: "persist normalized relation package to Neo4j/Object Storage pipeline without dropping audit metadata",
    };
  });

  app.post("/api/v1/imports/normalized-package", async (request, reply) => {
    const payload = parseRequest(normalizedImportRequestSchema, request.body);
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

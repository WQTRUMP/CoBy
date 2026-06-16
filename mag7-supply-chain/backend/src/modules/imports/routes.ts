import { timingSafeEqual } from "node:crypto";

import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  importRelationsFieldCatalog,
  importRelationsRequestSchema,
} from "@mag7/contracts";
import { env } from "../../config/env.js";
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

function getBearerToken(authorizationHeader: string | string[] | undefined) {
  if (typeof authorizationHeader !== "string") {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(" ", 2);
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

function tokenMatches(expected: string, received: string | null) {
  if (!received) {
    return false;
  }

  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, receivedBuffer);
}

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
    if (app.runtimeMode === "live") {
      const liveImportEnabled = env.IMPORT_HTTP_ENABLED && Boolean(env.IMPORT_API_TOKEN);

      if (!liveImportEnabled) {
        return reply.code(404).send({
          error: "not_found",
          message: "Route not found.",
        });
      }

      const bearerToken = getBearerToken(request.headers.authorization);
      if (!tokenMatches(env.IMPORT_API_TOKEN!, bearerToken)) {
        return reply.code(403).send({
          error: "forbidden",
          message: "Administrative import access is required.",
        });
      }
    }

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

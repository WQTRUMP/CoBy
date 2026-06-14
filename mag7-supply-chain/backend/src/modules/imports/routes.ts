import type { FastifyInstance } from "fastify";

import { importRelationsRequestSchema } from "@mag7/contracts";

export async function registerImportRoutes(app: FastifyInstance) {
  app.post("/api/v1/imports/relations", async (request, reply) => {
    const payload = importRelationsRequestSchema.parse(request.body);

    reply.code(202);
    return {
      accepted: true,
      requestId: payload.requestId,
      relationCount: payload.relations.length,
      storageMode: "reserved",
      nextStep: "persist to Neo4j/Object Storage pipeline",
    };
  });
}

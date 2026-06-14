import type { FastifyInstance } from "fastify";

import { subgraphQuerySchema } from "@mag7/contracts";

const CACHE_TTL_SECONDS = 600;

export async function registerGraphRoutes(app: FastifyInstance) {
  app.get("/api/v1/graph/subgraph", async (request, reply) => {
    const query = subgraphQuerySchema.parse(request.query);
    const cacheKey = [
      "subgraph",
      query.companyId,
      query.depth,
      (query.relationshipTypes ?? []).join(",") || "all",
      query.snapshot,
      query.includeEvidence ? "evidence" : "compact",
    ].join(":");

    const cached = await app.cacheClient.get(cacheKey);
    if (cached) {
      reply.header("x-cache", "hit");
      return JSON.parse(cached);
    }

    const subgraph = await app.graphRepository.getSubgraph(query);
    await app.cacheClient.set(cacheKey, JSON.stringify(subgraph), CACHE_TTL_SECONDS);

    reply.header("x-cache", "miss");
    reply.header("x-snapshot-version", subgraph.snapshot.version);
    return subgraph;
  });
}

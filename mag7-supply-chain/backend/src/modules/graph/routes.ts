import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  graphPathQuerySchema,
  graphStatsQuerySchema,
  subgraphQuerySchema,
} from "@mag7/contracts";
import { parseRequest } from "../../lib/request-validation.js";

const CACHE_TTL_SECONDS = 600;

export async function registerGraphRoutes(app: FastifyInstance) {
  app.get("/api/v1/graph/subgraph", async (request, reply) => {
    const query = parseRequest(subgraphQuerySchema, request.query);
    const cacheKey = [
      "subgraph",
      app.graphRepository.source,
      query.companyId,
      query.depth,
      (query.relationshipTypes ?? []).join(",") || "all",
      query.snapshot,
      query.includeEvidence ? "evidence" : "compact",
    ].join(":");

    const cached = await app.cacheClient.get(cacheKey);
    if (cached) {
      const payload = JSON.parse(cached);
      reply.header("x-cache", "hit");
      reply.header("x-snapshot-version", payload.snapshot.version);
      return payload;
    }

    const subgraph = await app.graphRepository.getSubgraph(query);
    await app.cacheClient.set(cacheKey, JSON.stringify(subgraph), CACHE_TTL_SECONDS);

    reply.header("x-cache", "miss");
    reply.header("x-snapshot-version", subgraph.snapshot.version);
    return subgraph;
  });

  app.get("/api/v1/graph/path", async (request, reply) => {
    const query = parseRequest(graphPathQuerySchema, request.query);
    const cacheKey = [
      "graph",
      "path",
      app.graphRepository.source,
      query.sourceCompanyId,
      query.targetCompanyId,
      query.maxDepth,
      query.snapshot,
      query.includeEvidence ? "evidence" : "compact",
    ].join(":");
    const cached = await app.cacheClient.get(cacheKey);
    if (cached) {
      const payload = JSON.parse(cached);
      reply.header("x-cache", "hit");
      reply.header("x-snapshot-version", payload.snapshot.version);
      return payload;
    }

    const payload = await app.graphRepository.getPath(query);
    await app.cacheClient.set(cacheKey, JSON.stringify(payload), CACHE_TTL_SECONDS);

    reply.header("x-cache", "miss");
    reply.header("x-snapshot-version", payload.snapshot.version);
    return payload;
  });

  app.get("/api/v1/graph/stats", async (request, reply) => {
    const query = parseRequest(graphStatsQuerySchema, request.query);
    const cacheKey = ["graph", "stats", app.graphRepository.source, query.snapshot, query.companyId ?? "all"].join(":");
    const cached = await app.cacheClient.get(cacheKey);
    if (cached) {
      const payload = JSON.parse(cached);
      reply.header("x-cache", "hit");
      if (payload.snapshot) {
        reply.header("x-snapshot-version", payload.snapshot.version);
      }
      return payload;
    }

    const payload = await app.graphRepository.getGraphStats(query);
    await app.cacheClient.set(cacheKey, JSON.stringify(payload), CACHE_TTL_SECONDS);

    reply.header("x-cache", "miss");
    if (payload.snapshot) {
      reply.header("x-snapshot-version", payload.snapshot.version);
    }
    return payload;
  });

  app.get("/api/v1/relations/:relationId/evidence", async (request, reply) => {
    const params = parseRequest(z.object({ relationId: z.string() }), request.params);
    const evidence = await app.graphRepository.getRelationEvidence(params.relationId);

    if (evidence.length === 0) {
      reply.code(404);
      return {
        error: "relation_evidence_not_found",
        relationId: params.relationId,
      };
    }

    return {
      relationId: params.relationId,
      items: evidence,
      total: evidence.length,
      source: app.graphRepository.source,
    };
  });
}

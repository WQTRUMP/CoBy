import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { mockSubgraph } from "../src/lib/mock-data.js";
import type { CacheClient } from "../src/lib/redis.js";
import type { GraphRepository, Neo4jHealth } from "../src/lib/neo4j.js";
import type { GraphNodeDTO } from "../../packages/contracts/src/index.js";

const cache = new Map<string, string>();

const cacheClient: CacheClient = {
  enabled: true,
  async get(key) {
    return cache.get(key) ?? null;
  },
  async set(key, value) {
    cache.set(key, value);
  },
  async del(key) {
    cache.delete(key);
  },
  async health() {
    return { status: "up", detail: "test cache" };
  },
  async close() {},
};

const graphRepository: GraphRepository = {
  source: "mock",
  async listCompanies() {
    return mockSubgraph.nodes
      .filter((node: GraphNodeDTO) => node.entityType === "Company" && Boolean(node.company))
      .map((node: GraphNodeDTO) => node.company!)
      .filter(Boolean);
  },
  async getSubgraph() {
    return mockSubgraph;
  },
};

let app: Awaited<ReturnType<typeof buildApp>>;

beforeAll(async () => {
  const neo4jHealth = async (): Promise<Neo4jHealth> => ({
    status: "not_configured",
    detail: "test mode",
  });

  app = await buildApp({
    cacheClient,
    graphRepository,
    neo4jHealth,
  });
});

afterAll(async () => {
  await app.close();
});

describe("backend app", () => {
  it("returns health status", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "degraded",
      service: "mag7-backend",
    });
  });

  it("returns subgraph payload", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/graph/subgraph?companyId=company:AAPL&depth=2&includeEvidence=true",
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["x-cache"]).toBe("miss");
    expect(response.json().snapshot.id).toBe("snapshot:2026-06-14.1");
  });

  it("accepts import payload", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/imports/relations",
      payload: {
        requestId: "import-test",
        source: "unit-test",
        dataVersion: "2026.06.14-01",
        relations: [
          {
            sourceCompanyId: "company:TSMC",
            targetCompanyId: "company:AAPL",
            relationshipType: "manufacturing",
            tier: 1,
            depthFromMag7: 1,
            confidence: "strong_evidence",
            confidenceScore: 0.88,
            summary: "TSMC -> Apple",
            lineageKey: "a",
            snapshotId: "snapshot:2026-06-14.1",
            evidence: [
              {
                id: "evidence:1",
                sourceType: "supplier_report",
                title: "Report",
                publisher: "TSMC",
                url: "https://example.com/report",
                publishedAt: "2026-06-14T00:00:00.000Z",
                retrievedAt: "2026-06-14T00:00:00.000Z",
                excerpt: "Evidence",
                pageRef: "1",
                language: "en",
                hash: "hash",
              },
            ],
          },
        ],
      },
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toMatchObject({
      accepted: true,
      relationCount: 1,
    });
  });
});

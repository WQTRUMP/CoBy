import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { mockSubgraph } from "../src/lib/mock-data.js";
import { prepareNormalizedImport } from "../src/lib/normalized-package.js";
import type { CacheClient } from "../src/lib/redis.js";
import type { GraphRepository, Neo4jHealth } from "../src/lib/neo4j.js";
import type { CompanyListQuery, GraphNodeDTO } from "@mag7/contracts";

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
  async listCompanies(query: CompanyListQuery) {
    const items = mockSubgraph.nodes
      .filter((node: GraphNodeDTO) => node.entityType === "Company" && Boolean(node.company))
      .map((node: GraphNodeDTO) => node.company!)
      .filter(Boolean);

    const normalized = query.q?.toLowerCase();
    return items
      .filter((company) => (query.isMag7 === undefined ? true : company.isMag7 === query.isMag7))
      .filter((company) => {
        if (!normalized) {
          return true;
        }

        return (
          company.name.toLowerCase().includes(normalized) ||
          company.ticker?.toLowerCase().includes(normalized)
        );
      })
      .map((company) => ({
        id: company.id,
        ticker: company.ticker,
        name: company.name,
        isMag7: company.isMag7,
        marketCapUsd: company.marketCapUsd,
        primaryRegion: company.primaryRegion,
        activeSnapshotId: company.activeSnapshotId,
      }));
  },
  async getCompany(companyId) {
    return (
      mockSubgraph.nodes
        .filter((node: GraphNodeDTO) => node.entityType === "Company" && Boolean(node.company))
        .map((node: GraphNodeDTO) => node.company!)
        .find((company) => company.id === companyId) ?? null
    );
  },
  async getCompanyOverview(companyId) {
    return {
      companyId,
      companyName: "Apple",
      activeSnapshotId: mockSubgraph.snapshot.id,
      totalRelations: 2,
      tier1SupplierCount: 1,
      supplierCount: 1,
      highRiskRelationCount: 1,
      evidenceCount: 2,
      evidenceCoverage: 1,
      lastUpdatedAt: mockSubgraph.snapshot.publishedAt,
      source: "mock",
    };
  },
  async getSubgraph() {
    return mockSubgraph;
  },
  async getPath() {
    return mockSubgraph;
  },
  async getGraphStats() {
    return {
      snapshot: mockSubgraph.snapshot,
      companyCount: 3,
      relationCount: mockSubgraph.relations.length,
      evidenceCount: mockSubgraph.relations.reduce((sum, relation) => sum + relation.evidenceCount, 0),
      mag7CompanyCount: 2,
      relationshipTypeBreakdown: {
        manufacturing: 1,
        component_supply: 1,
      },
      confidenceBreakdown: {
        confirmed: 1,
        strong_evidence: 1,
      },
      source: "mock" as const,
    };
  },
  async getRelationEvidence(relationId) {
    return mockSubgraph.relations.find((relation) => relation.id === relationId)?.evidence ?? [];
  },
  async importNormalizedPackage(payload) {
    return {
      companyCount: payload.companies.length,
      relationCount: payload.relations.length,
      evidenceCount: payload.evidence.length,
      snapshotCount: payload.snapshots.length,
    };
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
      contracts: {
        importSchemaVersion: "mag7-supply-chain.import-relations.v2",
        mockGraphBoundary: true,
      },
    });
  });

  it("returns subgraph payload", async () => {
    const [subgraphResponse, pathResponse, statsResponse] = await Promise.all([
      app.inject({
        method: "GET",
        url: "/api/v1/graph/subgraph?companyId=company:AAPL&depth=2&includeEvidence=true",
      }),
      app.inject({
        method: "GET",
        url: "/api/v1/graph/path?sourceCompanyId=company:TSMC&targetCompanyId=company:AAPL&maxDepth=2&includeEvidence=true",
      }),
      app.inject({
        method: "GET",
        url: "/api/v1/graph/stats?snapshot=published",
      }),
    ]);

    expect(subgraphResponse.statusCode).toBe(200);
    expect(subgraphResponse.headers["x-cache"]).toBe("miss");
    expect(subgraphResponse.json().snapshot.id).toBe("snapshot:2026-06-14.1");

    expect(pathResponse.statusCode).toBe(200);
    expect(pathResponse.json().relations).toHaveLength(2);

    expect(statsResponse.statusCode).toBe(200);
    expect(statsResponse.json()).toMatchObject({
      relationCount: 2,
      companyCount: 3,
      source: "mock",
    });
  });

  it("returns search and suggest payloads", async () => {
    const [searchResponse, suggestResponse] = await Promise.all([
      app.inject({
        method: "GET",
        url: "/api/v1/companies/search?q=app&limit=5",
      }),
      app.inject({
        method: "GET",
        url: "/api/v1/companies/suggest?q=app&limit=5",
      }),
    ]);

    expect(searchResponse.statusCode).toBe(200);
    expect(searchResponse.json()).toMatchObject({
      total: 1,
      query: "app",
      source: "mock",
    });

    expect(suggestResponse.statusCode).toBe(200);
    expect(suggestResponse.json()).toMatchObject({
      total: 1,
      query: "app",
      source: "mock",
    });
    expect(suggestResponse.json().items[0]).toMatchObject({
      id: "company:AAPL",
      label: "Apple (AAPL)",
    });
  });

  it("returns company detail and overview payloads", async () => {
    const [listResponse, detailResponse, overviewResponse] = await Promise.all([
      app.inject({
        method: "GET",
        url: "/api/v1/companies?q=app&page=1&pageSize=10",
      }),
      app.inject({
        method: "GET",
        url: "/api/v1/companies/company:AAPL",
      }),
      app.inject({
        method: "GET",
        url: "/api/v1/companies/company:AAPL/overview",
      }),
    ]);

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toMatchObject({
      items: [
        {
          id: "company:AAPL",
          primaryRegion: "US",
          activeSnapshotId: "snapshot:2026-06-14.1",
        },
      ],
      page: 1,
      pageSize: 10,
      total: 1,
      source: "mock",
    });

    expect(detailResponse.statusCode).toBe(200);
    expect(detailResponse.json()).toMatchObject({
      item: {
        id: "company:AAPL",
        name: "Apple",
        primaryRegion: "US",
        activeSnapshotId: "snapshot:2026-06-14.1",
      },
      source: "mock",
    });

    expect(overviewResponse.statusCode).toBe(200);
    expect(overviewResponse.json()).toMatchObject({
      companyId: "company:AAPL",
      totalRelations: 2,
      tier1SupplierCount: 1,
      evidenceCount: 2,
      evidenceCoverage: 1,
    });
  });

  it("returns relation evidence payload", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/relations/rel:tsmc-aapl-manufacturing/evidence",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      relationId: "rel:tsmc-aapl-manufacturing",
      total: 1,
      source: "mock",
    });
  });

  it("maps query validation failures to 400 responses", async () => {
    const [searchResponse, suggestResponse, subgraphResponse, pathResponse] = await Promise.all([
      app.inject({
        method: "GET",
        url: "/api/v1/companies/search",
      }),
      app.inject({
        method: "GET",
        url: "/api/v1/companies/suggest?q=apple&limit=0",
      }),
      app.inject({
        method: "GET",
        url: "/api/v1/graph/subgraph?companyId=company:AAPL&depth=0",
      }),
      app.inject({
        method: "GET",
        url: "/api/v1/graph/path?sourceCompanyId=company:TSMC&targetCompanyId=company:AAPL&maxDepth=99",
      }),
    ]);

    for (const response of [searchResponse, suggestResponse, subgraphResponse, pathResponse]) {
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        error: "bad_request",
        message: "Invalid request parameters.",
      });
      expect(response.json().details).toEqual(expect.any(Array));
      expect(response.json().details.length).toBeGreaterThan(0);
    }

    expect(searchResponse.json().details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "q",
        }),
      ]),
    );
    expect(suggestResponse.json().details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "limit",
        }),
      ]),
    );
    expect(subgraphResponse.json().details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "depth",
        }),
      ]),
    );
    expect(pathResponse.json().details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "maxDepth",
        }),
      ]),
    );
  });

  it("keeps ceo-reported malformed query inputs on stable 400 responses", async () => {
    const [searchResponse, suggestResponse, pathResponse] = await Promise.all([
      app.inject({
        method: "GET",
        url: "/api/v1/companies/search?limit=5",
      }),
      app.inject({
        method: "GET",
        url: "/api/v1/companies/suggest?limit=5",
      }),
      app.inject({
        method: "GET",
        url: "/api/v1/graph/path?sourceCompanyId=company:TSMC&targetCompanyId=company:AAPL&maxDepth=0&snapshot=published",
      }),
    ]);

    expect(searchResponse.statusCode).toBe(400);
    expect(searchResponse.json().details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "q" })]),
    );

    expect(suggestResponse.statusCode).toBe(400);
    expect(suggestResponse.json().details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "q" })]),
    );

    expect(pathResponse.statusCode).toBe(400);
    expect(pathResponse.json().details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "maxDepth" })]),
    );
  });

  it("accepts import payload", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/imports/relations",
      payload: {
        requestId: "import-test",
        source: "unit-test",
        dataVersion: "2026.06.14-01",
        schemaVersion: "mag7-supply-chain.import-relations.v2",
        relations: [
          {
            relation_id: "rel:apple:tsmc:manufacturing:apple-silicon",
            snapshot_id: "snapshot:2026-06-14.1",
            company: "Apple",
            company_slug: "apple",
            supplier: "TSMC",
            supplier_slug: "tsmc",
            tier: 1,
            depth_from_mag7: 1,
            relationship_type: "manufacturing",
            relationship_subtype: "wafer_foundry",
            product_scope: ["advanced silicon manufacturing"],
            evidence_ids: ["evidence:apple:2025-08-06:tsmc-arizona"],
            primary_evidence_id: "evidence:apple:2025-08-06:tsmc-arizona",
            evidence_date: "2026-06-14T00:00:00.000Z",
            evidence_date_resolution: "published_at",
            evidence_excerpt: "Evidence",
            source_url: "https://example.com/report",
            confidence_label: "strong_evidence",
            confidence_score: 0.88,
            source_method: "unit_test",
            source_count: 1,
            status: "approved",
            summary: "TSMC provides manufacturing capacity for Apple silicon.",
            notes: "TSMC -> Apple",
            lineage_key: "Apple|TSMC|manufacturing|Apple silicon",
            source_report_path: "/tmp/unit-test.md",
            last_verified_at: "2026-06-14T00:00:00.000Z",
          },
        ],
      },
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toMatchObject({
      accepted: true,
      relationCount: 1,
      schemaVersion: "mag7-supply-chain.import-relations.v2",
      storageMode: "lossless",
    });
  });

  it("returns standardized import schema metadata", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/schema/import-relations",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      schemaVersion: "mag7-supply-chain.import-relations.v2",
      mode: "mock-ready",
    });
  });

  it("accepts normalized package import payload", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/imports/normalized-package",
      payload: {
        requestId: "normalized-import-test",
        relationFile:
          "/workspace/agents/evidence-collector/output/mag7-normalized-relations-sample.jsonl",
        evidenceFile:
          "/workspace/agents/evidence-collector/output/mag7-normalized-evidence-sample.jsonl",
      },
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toMatchObject({
      accepted: true,
      requestId: "normalized-import-test",
      relationCount: 8,
      evidenceCount: 9,
      source: "mock",
    });
  });

  it("prepares normalized import companies with mag7 ids", () => {
    const prepared = prepareNormalizedImport({
      relations: [
        {
          relation_id: "rel:apple:tsmc:manufacturing:apple-silicon",
          snapshot_id: "snapshot:2026-06-14.1",
          company: "Apple",
          company_slug: "apple",
          supplier: "TSMC",
          supplier_slug: "tsmc",
          tier: 1,
          depth_from_mag7: 1,
          relationship_type: "manufacturing",
          relationship_subtype: "晶圆代工",
          product_scope: ["Apple silicon"],
          evidence_ids: ["evidence:apple:2025-08-06:tsmc-arizona"],
          primary_evidence_id: "evidence:apple:2025-08-06:tsmc-arizona",
          evidence_date: "2025-08-06",
          evidence_date_resolution: "published_at",
          evidence_excerpt: "TSMC in Arizona is producing chips for Apple.",
          source_url:
            "https://www.apple.com/newsroom/2025/08/apple-increases-us-commitment-to-600-billion-usd-announces-ambitious-program/",
          confidence_label: "confirmed",
          confidence_score: 0.96,
          source_method: "direct_disclosure",
          source_count: 1,
          status: "approved",
          summary: "TSMC 为 Apple 代工 Apple silicon。",
          notes: "sample",
          lineage_key: "Apple|TSMC|manufacturing|Apple silicon",
          source_report_path: "/tmp/apple-report.md",
          last_verified_at: "2026-06-14T00:00:00Z",
        },
      ],
      evidence: [
        {
          evidence_id: "evidence:apple:2025-08-06:tsmc-arizona",
          relation_id: "rel:apple:tsmc:manufacturing:apple-silicon",
          source_type: "press_release",
          title: "Apple newsroom",
          publisher: "Apple",
          source_url:
            "https://www.apple.com/newsroom/2025/08/apple-increases-us-commitment-to-600-billion-usd-announces-ambitious-program/",
          source_domain: "apple.com",
          published_at: "2025-08-06",
          published_at_resolution: "published_at",
          retrieved_at: "2026-06-14T00:00:00Z",
          excerpt: "TSMC in Arizona is producing chips for Apple.",
          citation_text: "TSMC in Arizona is producing chips for Apple.",
          page_ref: "not_provided",
          language: "en",
          reliability_tier: 1,
          parser_version: "manual-normalization-v1",
          license_note: "excerpt only",
          source_report_path: "/tmp/apple-report.md",
          notes: "sample",
        },
      ],
    });

    expect(prepared.companies.map((company) => company.id)).toContain("company:AAPL");
    expect(prepared.companies.map((company) => company.id)).toContain("company:TSMC");
    expect(prepared.relations[0]).toMatchObject({
      productScope: ["Apple silicon"],
      evidenceIds: ["evidence:apple:2025-08-06:tsmc-arizona"],
      primaryEvidenceId: "evidence:apple:2025-08-06:tsmc-arizona",
    });
    expect(prepared.relationEdges[0]).toEqual({
      relationId: "rel:apple:tsmc:manufacturing:apple-silicon",
      sourceCompanyId: "company:TSMC",
      targetCompanyId: "company:AAPL",
      snapshotId: "snapshot:2026-06-14.1",
    });
  });
});

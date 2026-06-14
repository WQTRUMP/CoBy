import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { mockSubgraph } from "../src/lib/mock-data.js";
import { prepareNormalizedImport } from "../src/lib/normalized-package.js";
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
      totalRelations: 2,
      supplierCount: 1,
      evidenceCount: 2,
      lastUpdatedAt: mockSubgraph.snapshot.publishedAt,
      source: "mock",
    };
  },
  async getSubgraph() {
    return mockSubgraph;
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
        importSchemaVersion: "mag7-supply-chain.import-relations.v1",
        mockGraphBoundary: true,
      },
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

  it("returns company detail and overview payloads", async () => {
    const [detailResponse, overviewResponse] = await Promise.all([
      app.inject({
        method: "GET",
        url: "/api/v1/companies/company:AAPL",
      }),
      app.inject({
        method: "GET",
        url: "/api/v1/companies/company:AAPL/overview",
      }),
    ]);

    expect(detailResponse.statusCode).toBe(200);
    expect(detailResponse.json()).toMatchObject({
      item: {
        id: "company:AAPL",
        name: "Apple",
      },
      source: "mock",
    });

    expect(overviewResponse.statusCode).toBe(200);
    expect(overviewResponse.json()).toMatchObject({
      companyId: "company:AAPL",
      totalRelations: 2,
      evidenceCount: 2,
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

  it("accepts import payload", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/imports/relations",
      payload: {
        requestId: "import-test",
        source: "unit-test",
        dataVersion: "2026.06.14-01",
        schemaVersion: "mag7-supply-chain.import-relations.v1",
        relations: [
          {
            company: "Apple",
            supplier: "TSMC",
            tier: 1,
            relationship_type: "manufacturing",
            product_scope: "advanced silicon manufacturing",
            evidence_date: "2026-06-14T00:00:00.000Z",
            evidence_excerpt: "Evidence",
            source_url: "https://example.com/report",
            confidence_label: "strong_evidence",
            confidence_score: 0.88,
            notes: "TSMC -> Apple",
            source_type: "supplier_report",
          },
        ],
      },
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toMatchObject({
      accepted: true,
      relationCount: 1,
      schemaVersion: "mag7-supply-chain.import-relations.v1",
    });
  });

  it("returns standardized import schema metadata", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/schema/import-relations",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      schemaVersion: "mag7-supply-chain.import-relations.v1",
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
      sourceCompanyId: "company:TSMC",
      targetCompanyId: "company:AAPL",
    });
  });
});

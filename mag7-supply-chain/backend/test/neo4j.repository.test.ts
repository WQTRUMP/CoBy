import { describe, expect, it } from "vitest";

import { Neo4jGraphRepository } from "../src/lib/neo4j.js";

class FakeRecord {
  constructor(private readonly values: Record<string, unknown>) {}

  get(key: string) {
    return this.values[key];
  }
}

describe("Neo4jGraphRepository", () => {
  it("maps subgraph rows via SOURCE_OF/TARGET_OF joins and groups evidence by traversed relation", async () => {
    let capturedQuery = "";

    const records = [
      new FakeRecord({
        source: {
          properties: {
            id: "company:TSMC",
            ticker: "TSM",
            name: "TSMC",
            companyType: "manufacturer",
            country: "TW",
            isMag7: false,
            marketCapUsd: 910000000000,
            description: "Semiconductor foundry",
            aliases: ["Taiwan Semiconductor Manufacturing Company"],
            active: true,
            importanceScore: 0.86,
            primaryRegion: "TW",
            activeSnapshotId: "snapshot:2026-06-14.1",
            summary: "Advanced-node manufacturing partner",
            lastUpdatedAt: "2026-06-14T00:00:00.000Z",
          },
        },
        rel: {
          properties: {
            id: "rel:apple:tsmc:manufacturing:apple-silicon",
            relationshipType: "manufacturing",
            relationshipSubtype: "wafer_foundry",
            tier: 1,
            depthFromMag7: 1,
            confidence: "confirmed",
            confidenceScore: 0.96,
            summary: "TSMC manufactures Apple silicon.",
            productScope: ["Apple silicon"],
            notes: "Joined from SupplyRelation node",
            evidenceIds: ["evidence:apple:tsmc"],
            primaryEvidenceId: "evidence:apple:tsmc",
            evidenceCount: 1,
            snapshotId: "snapshot:2026-06-14.1",
            status: "approved",
            sourceMethod: "direct_disclosure",
            sourceCount: 1,
            lineageKey: "apple|tsmc|manufacturing|apple-silicon",
            lastVerifiedAt: "2026-06-14T00:00:00.000Z",
            validFrom: "2025-08-06",
            validTo: null,
          },
        },
        target: {
          properties: {
            id: "company:AAPL",
            ticker: "AAPL",
            name: "Apple",
            companyType: "public_company",
            country: "US",
            isMag7: true,
            marketCapUsd: 3100000000000,
            description: "Consumer hardware and services",
            aliases: ["Apple Inc."],
            active: true,
            importanceScore: 1,
            primaryRegion: "US",
            activeSnapshotId: "snapshot:2026-06-14.1",
            summary: "Mag7 anchor company",
            lastUpdatedAt: "2026-06-14T00:00:00.000Z",
          },
        },
        evidence: [
          {
            properties: {
              id: "evidence:apple:tsmc",
              sourceType: "press_release",
              title: "Apple newsroom",
              publisher: "Apple",
              url: "https://example.com/apple",
              publishedAt: "2025-08-06",
              retrievedAt: "2026-06-14T00:00:00.000Z",
              excerpt: "TSMC in Arizona is producing chips for Apple.",
              pageRef: "newsroom",
              language: "en",
              hash: "sha256:apple",
              sourceDomain: "apple.com",
              citationText: "TSMC in Arizona is producing chips for Apple.",
              reliabilityTier: 1,
              licenseNote: null,
              parserVersion: "manual-normalization-v1",
            },
          },
        ],
        snapshot: {
          properties: {
            id: "snapshot:2026-06-14.1",
            version: "2026.06.14-01",
            status: "published",
            publishedAt: "2026-06-14T00:00:00.000Z",
            scope: ["company:AAPL"],
            notes: "test snapshot",
          },
        },
      }),
    ];

    const session = {
      async run(query: string) {
        capturedQuery = query;
        return { records };
      },
      async close() {},
    };

    const driver = {
      session() {
        return session;
      },
    };

    const repository = new Neo4jGraphRepository(driver as never, "neo4j");
    const subgraph = await repository.getSubgraph({
      companyId: "company:AAPL",
      depth: 2,
      snapshot: "published",
      includeEvidence: true,
    });

    expect(capturedQuery).toContain("MATCH (source:Company)-[:SOURCE_OF]->(rel)-[:TARGET_OF]->(target:Company)");
    expect(capturedQuery).toContain("OPTIONAL MATCH (rel)-[:SUPPORTED_BY]->(e:Evidence)");
    expect(subgraph.relations).toHaveLength(1);
    expect(subgraph.relations[0]).toMatchObject({
      id: "rel:apple:tsmc:manufacturing:apple-silicon",
      sourceId: "company:TSMC",
      targetId: "company:AAPL",
      relationshipSubtype: "wafer_foundry",
      productScope: ["Apple silicon"],
      evidenceIds: ["evidence:apple:tsmc"],
      primaryEvidenceId: "evidence:apple:tsmc",
    });
    expect(subgraph.relations[0].evidence?.[0]).toMatchObject({
      id: "evidence:apple:tsmc",
      sourceType: "press_release",
    });
  });
});

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
    expect(capturedQuery).toContain("MATCH (snapshot:Snapshot)-[:CONTAINS]->(rel)");
    expect(capturedQuery).toContain("snapshot.status = 'published'");
    expect(capturedQuery).toContain("snapshot.id = $snapshot");
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

  it("returns an empty real subgraph instead of falling back to Tesla mock when no relations match", async () => {
    let callCount = 0;

    const session = {
      async run() {
        callCount += 1;
        if (callCount === 1) {
          return { records: [] };
        }

        return {
          records: [
            new FakeRecord({
              company: {
                id: "company:AMZN",
                ticker: "AMZN",
                name: "Amazon",
                companyType: "public_company",
                country: "US",
                isMag7: true,
                marketCapUsd: 2100000000000,
                description: "Amazon",
                aliases: ["Amazon.com, Inc."],
                active: true,
                importanceScore: 1,
                primaryRegion: "US",
                activeSnapshotId: "snapshot:2026-06-14.2",
                summary: "Amazon summary",
                lastUpdatedAt: "2026-06-14T00:00:00.000Z",
              },
            }),
          ],
        };
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
      companyId: "company:AMZN",
      depth: 2,
      snapshot: "published",
      includeEvidence: false,
    });

    expect(subgraph.relations).toHaveLength(0);
    expect(subgraph.nodes).toHaveLength(1);
    expect(subgraph.nodes[0].id).toBe("company:AMZN");
    expect(subgraph.snapshot.id).toBe("snapshot:2026-06-14.2");
  });

  it("prefers the latest relation snapshot fallback over the first relation when snapshot rows are absent", async () => {
    const records = [
      new FakeRecord({
        source: {
          properties: {
            id: "company:BROADCOM",
            ticker: "AVGO",
            name: "Broadcom",
            canonicalName: "Broadcom",
            displayName: "Broadcom",
            entityProfileJson: JSON.stringify({
              canonicalName: "Broadcom",
              displayName: "Broadcom",
              legalEntities: [],
              brands: [],
              aliases: [],
            }),
            companyType: "supplier",
            country: "US",
            isMag7: false,
            marketCapUsd: 850000000000,
            description: "Semiconductor supplier",
            aliases: ["Broadcom Inc."],
            active: true,
            importanceScore: 0.82,
            primaryRegion: "US",
            activeSnapshotId: "snapshot:2026-06-14.1",
            summary: "Broadcom summary",
            lastUpdatedAt: "2026-06-14T00:00:00.000Z",
          },
        },
        rel: {
          properties: {
            id: "rel:alphabet:broadcom",
            relationshipType: "component_supply",
            tier: 1,
            depthFromMag7: 1,
            confidence: "confirmed",
            confidenceScore: 0.95,
            summary: "Broadcom supports Alphabet TPU programs.",
            productScope: ["TPUs"],
            notes: null,
            evidenceIds: [],
            primaryEvidenceId: null,
            evidenceCount: 0,
            snapshotId: "snapshot:2026-06-14.1",
            status: "approved",
            sourceMethod: "supplier_disclosure",
            sourceCount: 1,
            lineageKey: "alphabet-broadcom",
            lastVerifiedAt: "2026-06-14T00:00:00.000Z",
            validFrom: "2026-04-06",
            validTo: null,
          },
        },
        target: {
          properties: {
            id: "company:GOOGL",
            ticker: "GOOGL",
            name: "Alphabet",
            canonicalName: "Alphabet",
            displayName: "Google",
            entityProfileJson: JSON.stringify({
              canonicalName: "Alphabet",
              displayName: "Google",
              legalEntities: [],
              brands: [],
              aliases: [],
            }),
            companyType: "public_company",
            country: "US",
            isMag7: true,
            marketCapUsd: 2200000000000,
            description: "Alphabet",
            aliases: ["Alphabet Inc.", "Google"],
            active: true,
            importanceScore: 1,
            primaryRegion: "US",
            activeSnapshotId: "snapshot:2026-06-14.3",
            summary: "Alphabet summary",
            lastUpdatedAt: "2026-06-14T03:05:00.000Z",
          },
        },
        evidence: [],
        snapshot: null,
      }),
      new FakeRecord({
        source: {
          properties: {
            id: "company:CISCO",
            ticker: "CSCO",
            name: "Cisco",
            canonicalName: "Cisco",
            displayName: "Cisco",
            entityProfileJson: JSON.stringify({
              canonicalName: "Cisco",
              displayName: "Cisco",
              legalEntities: [],
              brands: [],
              aliases: [],
            }),
            companyType: "service_provider",
            country: "US",
            isMag7: false,
            marketCapUsd: 250000000000,
            description: "Networking supplier",
            aliases: ["Cisco Systems, Inc."],
            active: true,
            importanceScore: 0.71,
            primaryRegion: "US",
            activeSnapshotId: "snapshot:2026-06-14.3",
            summary: "Cisco summary",
            lastUpdatedAt: "2026-06-14T03:05:00.000Z",
          },
        },
        rel: {
          properties: {
            id: "rel:alphabet:cisco",
            relationshipType: "cloud_service",
            tier: 1,
            depthFromMag7: 1,
            confidence: "strong_evidence",
            confidenceScore: 0.87,
            summary: "Cisco supports Google Cloud WAN integration.",
            productScope: ["Cloud WAN"],
            notes: null,
            evidenceIds: [],
            primaryEvidenceId: null,
            evidenceCount: 0,
            snapshotId: "snapshot:2026-06-14.3",
            status: "approved",
            sourceMethod: "partner_disclosure",
            sourceCount: 1,
            lineageKey: "alphabet-cisco",
            lastVerifiedAt: "2026-06-14T03:05:00.000Z",
            validFrom: "2026-06-01",
            validTo: null,
          },
        },
        target: {
          properties: {
            id: "company:GOOGL",
            ticker: "GOOGL",
            name: "Alphabet",
            canonicalName: "Alphabet",
            displayName: "Google",
            entityProfileJson: JSON.stringify({
              canonicalName: "Alphabet",
              displayName: "Google",
              legalEntities: [],
              brands: [],
              aliases: [],
            }),
            companyType: "public_company",
            country: "US",
            isMag7: true,
            marketCapUsd: 2200000000000,
            description: "Alphabet",
            aliases: ["Alphabet Inc.", "Google"],
            active: true,
            importanceScore: 1,
            primaryRegion: "US",
            activeSnapshotId: "snapshot:2026-06-14.3",
            summary: "Alphabet summary",
            lastUpdatedAt: "2026-06-14T03:05:00.000Z",
          },
        },
        evidence: [],
        snapshot: null,
      }),
    ];

    const session = {
      async run() {
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
      companyId: "company:GOOGL",
      depth: 3,
      snapshot: "published",
      includeEvidence: false,
    });

    expect(subgraph.snapshot.id).toBe("snapshot:2026-06-14.3");
    expect(subgraph.snapshot.version).toBe("2026.06.14.3");
  });

  it("counts overview metrics from published snapshot relations touching the company on either side", async () => {
    let capturedQuery = "";

    const session = {
      async run(query: string) {
        capturedQuery = query;
        return {
          records: [
            new FakeRecord({
              companyName: "NVIDIA",
              activeSnapshotId: "snapshot:2026-06-14.2",
              totalRelations: 3,
              tier1SupplierCount: 2,
              supplierCount: 2,
              highRiskRelationCount: 1,
              evidenceCount: 4,
              lastUpdatedAt: "2026-06-14T00:00:00.000Z",
            }),
          ],
        };
      },
      async close() {},
    };

    const driver = {
      session() {
        return session;
      },
    };

    const repository = new Neo4jGraphRepository(driver as never, "neo4j");
    const overview = await repository.getCompanyOverview("company:NVDA");

    expect(capturedQuery).toContain("(c)<-[:TARGET_OF|SOURCE_OF]-(rel:SupplyRelation)");
    expect(capturedQuery).toContain("snapshot.status = 'published'");
    expect(overview).toMatchObject({
      companyId: "company:NVDA",
      companyName: "NVIDIA",
      activeSnapshotId: "snapshot:2026-06-14.2",
      totalRelations: 3,
      tier1SupplierCount: 2,
      supplierCount: 2,
      highRiskRelationCount: 1,
      evidenceCount: 4,
      source: "neo4j",
    });
  });

  it("finds a path only from relations inside the requested snapshot scope", async () => {
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
            id: "rel:path:1",
            relationshipType: "manufacturing",
            relationshipSubtype: "wafer_foundry",
            tier: 1,
            depthFromMag7: 1,
            confidence: "confirmed",
            confidenceScore: 0.96,
            summary: "TSMC manufactures Apple silicon.",
            productScope: ["Apple silicon"],
            notes: null,
            evidenceIds: ["evidence:path:1"],
            primaryEvidenceId: "evidence:path:1",
            evidenceCount: 1,
            snapshotId: "snapshot:2026-06-14.1",
            status: "approved",
            sourceMethod: "direct_disclosure",
            sourceCount: 1,
            lineageKey: "path-1",
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
        evidence: [],
        snapshot: {
          properties: {
            id: "snapshot:2026-06-14.1",
            version: "2026.06.14.1",
            status: "published",
            publishedAt: "2026-06-14T00:00:00.000Z",
            scope: ["company:AAPL"],
            notes: "test snapshot",
          },
        },
      }),
      new FakeRecord({
        source: {
          properties: {
            id: "company:SK-HYNIX",
            ticker: "000660.KS",
            name: "SK hynix",
            companyType: "supplier",
            country: "KR",
            isMag7: false,
            marketCapUsd: null,
            description: "HBM supplier",
            aliases: [],
            active: true,
            importanceScore: 0.74,
            primaryRegion: "KR",
            activeSnapshotId: "snapshot:2026-06-14.1",
            summary: "HBM supplier",
            lastUpdatedAt: "2026-06-14T00:00:00.000Z",
          },
        },
        rel: {
          properties: {
            id: "rel:path:2",
            relationshipType: "component_supply",
            relationshipSubtype: "hbm",
            tier: 2,
            depthFromMag7: 2,
            confidence: "strong_evidence",
            confidenceScore: 0.82,
            summary: "SK hynix supplies HBM to TSMC packaging flow.",
            productScope: ["HBM"],
            notes: null,
            evidenceIds: ["evidence:path:2"],
            primaryEvidenceId: "evidence:path:2",
            evidenceCount: 1,
            snapshotId: "snapshot:2026-06-14.1",
            status: "approved",
            sourceMethod: "media_inference",
            sourceCount: 1,
            lineageKey: "path-2",
            lastVerifiedAt: "2026-06-14T00:00:00.000Z",
            validFrom: "2025-01-01",
            validTo: null,
          },
        },
        target: {
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
        evidence: [],
        snapshot: {
          properties: {
            id: "snapshot:2026-06-14.1",
            version: "2026.06.14.1",
            status: "published",
            publishedAt: "2026-06-14T00:00:00.000Z",
            scope: ["company:AAPL"],
            notes: "test snapshot",
          },
        },
      }),
    ];

    const session = {
      async run() {
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
    const path = await repository.getPath({
      sourceCompanyId: "company:SK-HYNIX",
      targetCompanyId: "company:AAPL",
      maxDepth: 3,
      snapshot: "published",
      includeEvidence: false,
    });

    expect(path.relations.map((relation) => relation.id)).toEqual(["rel:path:2", "rel:path:1"]);
    expect(path.nodes.map((node) => node.id)).toEqual(
      expect.arrayContaining(["company:SK-HYNIX", "company:TSMC", "company:AAPL"]),
    );
    expect(path.snapshot.id).toBe("snapshot:2026-06-14.1");
  });

  it("prefers the most recent snapshot in graph stats when mixed published snapshots touch the same company", async () => {
    const records = [
      new FakeRecord({
        source: {
          properties: {
            id: "company:BROADCOM",
            ticker: "AVGO",
            name: "Broadcom",
            companyType: "supplier",
            country: "US",
            isMag7: false,
            marketCapUsd: 850000000000,
            description: "Semiconductor supplier",
            aliases: ["Broadcom Inc."],
            active: true,
            importanceScore: 0.82,
            primaryRegion: "US",
            activeSnapshotId: "snapshot:2026-06-14.1",
            summary: "Broadcom summary",
            lastUpdatedAt: "2026-06-14T00:00:00.000Z",
          },
        },
        target: {
          properties: {
            id: "company:GOOGL",
            ticker: "GOOGL",
            name: "Alphabet",
            companyType: "public_company",
            country: "US",
            isMag7: true,
            marketCapUsd: 2200000000000,
            description: "Alphabet",
            aliases: ["Alphabet Inc.", "Google"],
            active: true,
            importanceScore: 1,
            primaryRegion: "US",
            activeSnapshotId: "snapshot:2026-06-14.3",
            summary: "Alphabet summary",
            lastUpdatedAt: "2026-06-14T03:05:00.000Z",
          },
        },
        rel: {
          properties: {
            id: "rel:alphabet:broadcom",
            relationshipType: "component_supply",
            tier: 1,
            depthFromMag7: 1,
            confidence: "confirmed",
            confidenceScore: 0.95,
            summary: "Broadcom supports Alphabet TPU programs.",
            productScope: ["TPUs"],
            notes: null,
            evidenceIds: ["evidence:alphabet:broadcom"],
            primaryEvidenceId: "evidence:alphabet:broadcom",
            evidenceCount: 1,
            snapshotId: "snapshot:2026-06-14.1",
            status: "approved",
            sourceMethod: "supplier_disclosure",
            sourceCount: 1,
            lineageKey: "alphabet-broadcom",
            lastVerifiedAt: "2026-06-14T00:00:00.000Z",
            validFrom: "2026-04-06",
            validTo: null,
          },
        },
        evidence: [],
        snapshot: {
          properties: {
            id: "snapshot:2026-06-14.1",
            version: "2026.06.14.1",
            status: "published",
            publishedAt: "2026-06-14T00:00:00.000Z",
            scope: ["company:GOOGL"],
            notes: "older snapshot",
          },
        },
      }),
      new FakeRecord({
        source: {
          properties: {
            id: "company:CISCO",
            ticker: "CSCO",
            name: "Cisco",
            companyType: "service_provider",
            country: "US",
            isMag7: false,
            marketCapUsd: 250000000000,
            description: "Networking supplier",
            aliases: ["Cisco Systems, Inc."],
            active: true,
            importanceScore: 0.71,
            primaryRegion: "US",
            activeSnapshotId: "snapshot:2026-06-14.3",
            summary: "Cisco summary",
            lastUpdatedAt: "2026-06-14T03:05:00.000Z",
          },
        },
        target: {
          properties: {
            id: "company:GOOGL",
            ticker: "GOOGL",
            name: "Alphabet",
            companyType: "public_company",
            country: "US",
            isMag7: true,
            marketCapUsd: 2200000000000,
            description: "Alphabet",
            aliases: ["Alphabet Inc.", "Google"],
            active: true,
            importanceScore: 1,
            primaryRegion: "US",
            activeSnapshotId: "snapshot:2026-06-14.3",
            summary: "Alphabet summary",
            lastUpdatedAt: "2026-06-14T03:05:00.000Z",
          },
        },
        rel: {
          properties: {
            id: "rel:alphabet:cisco",
            relationshipType: "cloud_service",
            tier: 1,
            depthFromMag7: 1,
            confidence: "strong_evidence",
            confidenceScore: 0.87,
            summary: "Cisco supports Google Cloud WAN integration.",
            productScope: ["Cloud WAN"],
            notes: null,
            evidenceIds: ["evidence:alphabet:cisco"],
            primaryEvidenceId: "evidence:alphabet:cisco",
            evidenceCount: 1,
            snapshotId: "snapshot:2026-06-14.3",
            status: "approved",
            sourceMethod: "partner_disclosure",
            sourceCount: 1,
            lineageKey: "alphabet-cisco",
            lastVerifiedAt: "2026-06-14T03:05:00.000Z",
            validFrom: "2026-06-01",
            validTo: null,
          },
        },
        evidence: [],
        snapshot: {
          properties: {
            id: "snapshot:2026-06-14.3",
            version: "2026.06.14.3",
            status: "published",
            publishedAt: "2026-06-14T03:05:00.000Z",
            scope: ["company:GOOGL"],
            notes: "latest snapshot",
          },
        },
      }),
    ];

    const session = {
      async run() {
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
    const stats = await repository.getGraphStats({
      snapshot: "published",
      companyId: "company:GOOGL",
    });

    expect(stats.snapshot).toMatchObject({
      id: "snapshot:2026-06-14.3",
      version: "2026.06.14.3",
    });
    expect(stats.relationCount).toBe(2);
  });

  it("returns canonical/display names and alias match explanations for company search", async () => {
    const session = {
      async run() {
        return {
          records: [
            new FakeRecord({
              company: {
                id: "company:GOOGL",
                ticker: "GOOGL",
                name: "Alphabet",
                canonicalName: "Alphabet",
                displayName: "Google",
                entityType: "Company",
                companyType: "public_company",
                country: "US",
                isMag7: true,
                marketCapUsd: 2200000000000,
                description: "Alphabet",
                aliases: ["Alphabet Inc.", "Google", "Google LLC"],
                entityProfileJson: JSON.stringify({
                  canonicalName: "Alphabet",
                  displayName: "Google",
                  legalEntities: [
                    {
                      id: "alias:alphabet:google-llc",
                      name: "Google LLC",
                      normalizedName: "googlellc",
                      aliasType: "legal_entity",
                      isPrimary: true,
                    },
                  ],
                  brands: [
                    {
                      id: "alias:alphabet:google-cloud",
                      name: "Google Cloud",
                      normalizedName: "googlecloud",
                      aliasType: "brand",
                      isPrimary: false,
                    },
                  ],
                  aliases: [
                    {
                      id: "alias:alphabet:google",
                      name: "Google",
                      normalizedName: "google",
                      aliasType: "short_name",
                      isPrimary: true,
                    },
                  ],
                }),
                active: true,
                importanceScore: 1,
                primaryRegion: "US",
                activeSnapshotId: "snapshot:2026-06-14.3",
                summary: "Alphabet summary",
                lastUpdatedAt: "2026-06-14T03:05:00.000Z",
                searchAliases: ["Google Cloud", "Google LLC"],
              },
            }),
          ],
        };
      },
      async close() {},
    };

    const driver = {
      session() {
        return session;
      },
    };

    const repository = new Neo4jGraphRepository(driver as never, "neo4j");
    const results = await repository.searchCompanies({
      q: "google cloud",
      limit: 5,
      isMag7: true,
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: "company:GOOGL",
      canonicalName: "Alphabet",
      displayName: "Google",
      match: {
        field: "alias",
        aliasType: "brand",
        value: "Google Cloud",
      },
    });
  });

  it("preserves canonical/display names and entity profiles in company list items", async () => {
    const session = {
      async run() {
        return {
          records: [
            new FakeRecord({
              company: {
                id: "company:GOOGL",
                ticker: "GOOGL",
                name: "Alphabet",
                canonicalName: "Alphabet",
                displayName: "Google",
                entityType: "Company",
                companyType: "public_company",
                country: "US",
                isMag7: true,
                marketCapUsd: 2200000000000,
                description: "Alphabet",
                aliases: ["Alphabet Inc.", "Google"],
                entityProfileJson: JSON.stringify({
                  canonicalName: "Alphabet",
                  displayName: "Google",
                  legalEntities: [],
                  brands: [],
                  aliases: [
                    {
                      id: "alias:alphabet:google",
                      name: "Google",
                      normalizedName: "google",
                      aliasType: "short_name",
                      isPrimary: true,
                    },
                  ],
                }),
                active: true,
                importanceScore: 1,
                primaryRegion: "US",
                activeSnapshotId: "snapshot:2026-06-14.3",
                summary: "Alphabet summary",
                lastUpdatedAt: "2026-06-14T03:05:00.000Z",
                searchAliases: ["Google"],
              },
            }),
          ],
        };
      },
      async close() {},
    };

    const driver = {
      session() {
        return session;
      },
    };

    const repository = new Neo4jGraphRepository(driver as never, "neo4j");
    const results = await repository.listCompanies({
      q: "google",
      page: 1,
      pageSize: 10,
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: "company:GOOGL",
      canonicalName: "Alphabet",
      displayName: "Google",
      entityProfile: {
        canonicalName: "Alphabet",
        displayName: "Google",
      },
    });
  });
});

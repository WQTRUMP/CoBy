MERGE (snapshot:Snapshot {id: "snapshot:local-dev"})
SET snapshot.version = "local-dev",
    snapshot.status = "draft",
    snapshot.createdAt = datetime(),
    snapshot.publishedAt = datetime();

MERGE (company:Company {id: "company:AAPL"})
SET company.ticker = "AAPL",
    company.name = "Apple",
    company.companyType = "public_company",
    company.country = "United States",
    company.marketCapUsd = 0.0,
    company.description = "Local development seed node for Mag7 supply-chain graph bootstrap.",
    company.isMag7 = true,
    company.aliases = ["Apple Inc."],
    company.active = true;

MERGE (product:Product {id: "product:iphone"})
SET product.name = "iPhone",
    product.category = "device",
    product.active = true;

MERGE (evidence:Evidence {id: "evidence:local-dev-seed"})
SET evidence.sourceType = "press_release",
    evidence.title = "Local development seed evidence",
    evidence.publisher = "wanman.devops",
    evidence.url = "https://example.invalid/local-dev-seed",
    evidence.publishedAt = datetime("2026-06-14T00:00:00Z"),
    evidence.retrievedAt = datetime(),
    evidence.excerpt = "Seed record used to validate local graph bootstrapping.",
    evidence.pageRef = "seed",
    evidence.language = "en",
    evidence.hash = "local-dev-seed";

MERGE (company)-[:BUILDS {snapshotId: "snapshot:local-dev"}]->(product)
MERGE (evidence)-[:SUPPORTS]->(product)
MERGE (snapshot)-[:INCLUDES]->(company)
MERGE (snapshot)-[:INCLUDES]->(product)
MERGE (snapshot)-[:INCLUDES]->(evidence);

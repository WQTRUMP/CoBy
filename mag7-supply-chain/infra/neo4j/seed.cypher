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

MERGE (supplier:Company {id: "company:TSMC"})
SET supplier.ticker = "TSM",
    supplier.name = "TSMC",
    supplier.companyType = "manufacturer",
    supplier.country = "Taiwan",
    supplier.marketCapUsd = 0.0,
    supplier.description = "Local development seed supplier node.",
    supplier.isMag7 = false,
    supplier.aliases = ["Taiwan Semiconductor Manufacturing Company"],
    supplier.active = true;

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
    evidence.hash = "local-dev-seed",
    evidence.sourceDomain = "example.invalid",
    evidence.citationText = "Seed record used to validate local graph bootstrapping.",
    evidence.reliabilityTier = 4,
    evidence.parserVersion = "seed-v1";

MERGE (relation:SupplyRelation {id: "rel:local-dev-tsmc-aapl"})
SET relation.relationshipType = "manufacturing",
    relation.tier = 1,
    relation.depthFromMag7 = 1,
    relation.confidence = "inferred",
    relation.confidenceScore = 0.6,
    relation.summary = "Local development relation linking TSMC manufacturing capacity to Apple products.",
    relation.productScope = "advanced silicon manufacturing",
    relation.notes = "Seed relation for backend bootstrap and query validation.",
    relation.evidenceCount = 1,
    relation.snapshotId = "snapshot:local-dev",
    relation.status = "draft",
    relation.lineageKey = "company:TSMC|company:AAPL|manufacturing|advanced-silicon",
    relation.sourceCompanyId = "company:TSMC",
    relation.targetCompanyId = "company:AAPL";

MERGE (company)-[:BUILDS {snapshotId: "snapshot:local-dev"}]->(product)
MERGE (supplier)-[:SOURCE_OF]->(relation)
MERGE (relation)-[:TARGET_OF]->(company)
MERGE (relation)-[:ABOUT_PRODUCT]->(product)
MERGE (relation)-[:SUPPORTED_BY]->(evidence)
MERGE (snapshot)-[:INCLUDES]->(company)
MERGE (snapshot)-[:INCLUDES]->(supplier)
MERGE (snapshot)-[:INCLUDES]->(product)
MERGE (snapshot)-[:INCLUDES]->(evidence);
MERGE (snapshot)-[:CONTAINS]->(relation);

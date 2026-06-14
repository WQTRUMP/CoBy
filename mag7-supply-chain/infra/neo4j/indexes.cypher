CREATE INDEX company_name IF NOT EXISTS
FOR (n:Company)
ON (n.name);

CREATE INDEX company_type IF NOT EXISTS
FOR (n:Company)
ON (n.companyType);

CREATE INDEX product_name IF NOT EXISTS
FOR (n:Product)
ON (n.name);

CREATE INDEX technology_name IF NOT EXISTS
FOR (n:Technology)
ON (n.name);

CREATE INDEX material_name IF NOT EXISTS
FOR (n:Material)
ON (n.name);

CREATE INDEX evidence_published_at IF NOT EXISTS
FOR (n:Evidence)
ON (n.publishedAt);

CREATE INDEX snapshot_version IF NOT EXISTS
FOR (n:Snapshot)
ON (n.version);

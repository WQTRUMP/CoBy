import { createNeo4jBundle } from "../lib/neo4j.js";
import {
  loadNormalizedImportPackage,
  prepareNormalizedImport,
} from "../lib/normalized-package.js";

function readFlag(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const relationFile = readFlag("--relations");
const evidenceFile = readFlag("--evidence");

if (!relationFile || !evidenceFile) {
  console.error(
    "Usage: npm run import:normalized -- --relations <relations.jsonl> --evidence <evidence.jsonl>",
  );
  process.exit(1);
}

const neo4j = createNeo4jBundle();

try {
  const pkg = await loadNormalizedImportPackage(relationFile, evidenceFile);
  const prepared = prepareNormalizedImport(pkg);
  const summary = await neo4j.repository.importNormalizedPackage(prepared);

  console.log(
    JSON.stringify(
      {
        source: neo4j.repository.source,
        relationFile,
        evidenceFile,
        ...summary,
      },
      null,
      2,
    ),
  );
} finally {
  await neo4j.close();
}


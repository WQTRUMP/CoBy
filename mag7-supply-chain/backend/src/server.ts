import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { createNeo4jBundle } from "./lib/neo4j.js";
import { createCacheClient } from "./lib/redis.js";

const neo4j = createNeo4jBundle();
const cacheClient = await createCacheClient();
const app = await buildApp({
  cacheClient,
  graphRepository: neo4j.repository,
  neo4jHealth: neo4j.health,
});

const shutdown = async () => {
  await app.close();
  await neo4j.close();
  await cacheClient.close();
};

process.on("SIGINT", async () => {
  await shutdown();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await shutdown();
  process.exit(0);
});

try {
  await app.listen({ host: env.HOST, port: env.PORT });
  console.log(`mag7-backend listening on http://${env.HOST}:${env.PORT}`);
} catch (error) {
  console.error(error);
  await shutdown();
  process.exit(1);
}

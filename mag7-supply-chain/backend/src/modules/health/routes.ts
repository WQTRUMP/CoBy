import type { FastifyInstance } from "fastify";

export async function registerHealthRoutes(app: FastifyInstance) {
  app.get("/api/v1/health", async () => {
    const [neo4j, redis] = await Promise.all([app.neo4jHealth(), app.cacheClient.health()]);
    const status = [neo4j.status, redis.status].every((item) => item === "up")
      ? "ok"
      : "degraded";

    return {
      status,
      service: "mag7-backend",
      time: new Date().toISOString(),
      repositoryMode: app.graphRepository.source,
      contracts: {
        importSchemaVersion: "mag7-supply-chain.import-relations.v2",
        mockGraphBoundary: app.graphRepository.source === "mock",
      },
      dependencies: {
        neo4j,
        redis,
      },
    };
  });
}

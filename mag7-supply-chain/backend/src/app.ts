import Fastify from "fastify";
import cors from "@fastify/cors";

import { env } from "./config/env.js";
import { registerCompanyRoutes } from "./modules/companies/routes.js";
import { registerGraphRoutes } from "./modules/graph/routes.js";
import { registerHealthRoutes } from "./modules/health/routes.js";
import { registerImportRoutes } from "./modules/imports/routes.js";
import type { GraphRepository, Neo4jHealth } from "./lib/neo4j.js";
import type { CacheClient } from "./lib/redis.js";

export interface AppOptions {
  cacheClient: CacheClient;
  graphRepository: GraphRepository;
  neo4jHealth: () => Promise<Neo4jHealth>;
}

export async function buildApp(options: AppOptions) {
  const app = Fastify({
    logger: false,
  });

  await app.register(cors, {
    origin: env.CORS_ORIGIN,
  });

  app.decorate("cacheClient", options.cacheClient);
  app.decorate("graphRepository", options.graphRepository);
  app.decorate("neo4jHealth", options.neo4jHealth);

  await registerHealthRoutes(app);
  await registerCompanyRoutes(app);
  await registerGraphRoutes(app);
  await registerImportRoutes(app);

  return app;
}

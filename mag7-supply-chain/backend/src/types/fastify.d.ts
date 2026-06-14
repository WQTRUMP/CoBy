import "fastify";

import type { GraphRepository, Neo4jHealth, RuntimeMode } from "../lib/neo4j.js";
import type { CacheClient } from "../lib/redis.js";

declare module "fastify" {
  interface FastifyInstance {
    cacheClient: CacheClient;
    graphRepository: GraphRepository;
    neo4jHealth: () => Promise<Neo4jHealth>;
    runtimeMode: RuntimeMode;
  }
}

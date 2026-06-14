import Fastify from "fastify";
import cors from "@fastify/cors";
import { ZodError } from "zod";

import { env } from "./config/env.js";
import { registerCompanyRoutes } from "./modules/companies/routes.js";
import { registerGraphRoutes } from "./modules/graph/routes.js";
import { registerHealthRoutes } from "./modules/health/routes.js";
import { registerImportRoutes } from "./modules/imports/routes.js";
import { registerSchemaRoutes } from "./modules/schema/routes.js";
import type { GraphRepository, Neo4jHealth } from "./lib/neo4j.js";
import type { CacheClient } from "./lib/redis.js";

export interface AppOptions {
  cacheClient: CacheClient;
  graphRepository: GraphRepository;
  neo4jHealth: () => Promise<Neo4jHealth>;
}

function formatValidationDetails(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join(".") || "request",
    code: issue.code,
    message: issue.message,
  }));
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

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: "bad_request",
        message: "Invalid request parameters.",
        details: formatValidationDetails(error),
      });
    }

    if (error.validation || (typeof error.statusCode === "number" && error.statusCode >= 400 && error.statusCode < 500)) {
      return reply.code(error.statusCode ?? 400).send({
        error: "bad_request",
        message: error.message || "Invalid request parameters.",
        details: error.validation ?? [],
      });
    }

    return reply.send(error);
  });

  await registerHealthRoutes(app);
  await registerCompanyRoutes(app);
  await registerGraphRoutes(app);
  await registerImportRoutes(app);
  await registerSchemaRoutes(app);

  return app;
}

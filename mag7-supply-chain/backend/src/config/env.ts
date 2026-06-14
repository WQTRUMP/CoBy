import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default("127.0.0.1"),
  CORS_ORIGIN: z.string().default("http://127.0.0.1:5174"),
  GRAPH_RUNTIME_MODE: z.enum(["live", "prototype"]).default("live"),
  NEO4J_URI: z.string().optional(),
  NEO4J_USERNAME: z.string().default("neo4j"),
  NEO4J_PASSWORD: z.string().default("neo4j"),
  NEO4J_DATABASE: z.string().default("neo4j"),
  REDIS_URL: z.string().optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);

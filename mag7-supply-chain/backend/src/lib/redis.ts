import { createClient } from "redis";

import { env } from "../config/env.js";
import type { DependencyStatus } from "./neo4j.js";

export interface RedisHealth {
  status: DependencyStatus;
  detail: string;
}

export interface CacheClient {
  enabled: boolean;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
  health(): Promise<RedisHealth>;
  close(): Promise<void>;
}

class NoopCacheClient implements CacheClient {
  enabled = false;

  async get() {
    return null;
  }

  async set() {}

  async del() {}

  async health() {
    return {
      status: "not_configured" as const,
      detail: "REDIS_URL is not configured; cache disabled",
    };
  }

  async close() {}
}

class RedisCacheClient implements CacheClient {
  enabled = true;

  constructor(private readonly client: ReturnType<typeof createClient>) {}

  async get(key: string) {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds: number) {
    await this.client.set(key, value, { EX: ttlSeconds });
  }

  async del(key: string) {
    await this.client.del(key);
  }

  async health() {
    try {
      await this.client.ping();
      return { status: "up" as const, detail: "Redis connection healthy" };
    } catch (error) {
      return {
        status: "down" as const,
        detail: error instanceof Error ? error.message : "Redis ping failed",
      };
    }
  }

  async close() {
    if (this.client.isOpen) {
      await this.client.quit();
    }
  }
}

export async function createCacheClient(): Promise<CacheClient> {
  if (!env.REDIS_URL) {
    return new NoopCacheClient();
  }

  const client = createClient({ url: env.REDIS_URL });
  client.on("error", () => undefined);

  try {
    await client.connect();
    return new RedisCacheClient(client);
  } catch {
    return new NoopCacheClient();
  }
}

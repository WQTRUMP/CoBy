import { createClient } from "redis";

import { env } from "../config/env.js";
import type { DependencyStatus } from "./neo4j.js";
import { toDependencyDetail } from "./dependency-failures.js";

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

export interface RedisClientLike {
  isOpen: boolean;
  on(event: string, listener: (...args: unknown[]) => void): unknown;
  connect(): Promise<void>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options: { EX: number }): Promise<unknown>;
  del(key: string): Promise<unknown>;
  ping(): Promise<string>;
  quit(): Promise<void>;
}

interface DisabledReason {
  status: DependencyStatus;
  detail: string;
}

export type RedisClientFactory = (options: { url: string }) => RedisClientLike;

class NoopCacheClient implements CacheClient {
  enabled = false;

  constructor(private readonly reason: DisabledReason = {
    status: "not_configured",
    detail: "REDIS_URL is not configured; cache disabled",
  }) {}

  async get() {
    return null;
  }

  async set() {}

  async del() {}

  async health() {
    return this.reason;
  }

  async close() {}
}

class RedisCacheClient implements CacheClient {
  private available = true;
  private detail = "Redis connection healthy";

  constructor(private readonly client: RedisClientLike) {}

  get enabled() {
    return this.available;
  }

  private async disable(reason: string) {
    this.available = false;
    this.detail = reason;

    if (this.client.isOpen) {
      try {
        await this.client.quit();
      } catch {
        // Ignore shutdown failures while entering degraded cache mode.
      }
    }
  }

  async get(key: string) {
    if (!this.available) {
      return null;
    }

    try {
      return await this.client.get(key);
    } catch (error) {
      await this.disable(`Redis unavailable; cache disabled: ${toDependencyDetail(error, "Redis get failed")}`);
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds: number) {
    if (!this.available) {
      return;
    }

    try {
      await this.client.set(key, value, { EX: ttlSeconds });
    } catch (error) {
      await this.disable(`Redis unavailable; cache disabled: ${toDependencyDetail(error, "Redis set failed")}`);
    }
  }

  async del(key: string) {
    if (!this.available) {
      return;
    }

    try {
      await this.client.del(key);
    } catch (error) {
      await this.disable(`Redis unavailable; cache disabled: ${toDependencyDetail(error, "Redis del failed")}`);
    }
  }

  async health() {
    if (!this.available) {
      return {
        status: "down" as const,
        detail: this.detail,
      };
    }

    try {
      await this.client.ping();
      return { status: "up" as const, detail: this.detail };
    } catch (error) {
      await this.disable(`Redis unavailable; cache disabled: ${toDependencyDetail(error, "Redis ping failed")}`);
      return {
        status: "down" as const,
        detail: this.detail,
      };
    }
  }

  async close() {
    if (this.client.isOpen) {
      await this.client.quit();
    }
  }
}

interface CreateCacheClientOptions {
  url?: string;
  createClient?: RedisClientFactory;
}

export async function createCacheClient(options: CreateCacheClientOptions = {}): Promise<CacheClient> {
  const url = options.url ?? env.REDIS_URL;

  if (!url) {
    return new NoopCacheClient();
  }

  const factory = options.createClient ?? ((clientOptions) => createClient(clientOptions) as RedisClientLike);
  const client = factory({ url });
  client.on("error", () => undefined);

  try {
    await client.connect();
    return new RedisCacheClient(client);
  } catch (error) {
    return new NoopCacheClient({
      status: "down",
      detail: `Redis unavailable; cache disabled: ${toDependencyDetail(error, "Redis connect failed")}`,
    });
  }
}

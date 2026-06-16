import { createClient } from "redis";

import { env } from "../config/env.js";
import type { RuntimeMode } from "./neo4j.js";
import type { DependencyStatus } from "./neo4j.js";
import { toDependencyDetail } from "./dependency-failures.js";

export interface RedisHealth {
  status: DependencyStatus;
  enabled: boolean;
  detail: string;
  required: boolean;
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
  connect(): Promise<unknown>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options: { EX: number }): Promise<unknown>;
  del(key: string): Promise<unknown>;
  ping(): Promise<string>;
  quit(): Promise<unknown>;
}

interface DisabledReason {
  status: DependencyStatus;
  detail: string;
}

export type RedisClientFactory = (options: { url: string }) => RedisClientLike;

const REDIS_CONNECT_TIMEOUT_MS = 1_000;
const REDIS_STARTUP_DETAIL = "Redis connection pending; cache disabled until ready";

class NoopCacheClient implements CacheClient {
  enabled = false;

  constructor(private readonly reason: DisabledReason = {
    status: "not_configured",
    detail: "REDIS_URL is not configured; cache disabled",
  }, private readonly required = false) {}

  async get() {
    return null;
  }

  async set() {}

  async del() {}

  async health() {
    return {
      ...this.reason,
      enabled: false,
      required: this.required,
    };
  }

  async close() {}
}

class RedisCacheClient implements CacheClient {
  private available = false;
  private detail = REDIS_STARTUP_DETAIL;
  private status: DependencyStatus = "down";

  constructor(private readonly client: RedisClientLike, private readonly required: boolean) {}

  get enabled() {
    return this.available;
  }

  private async disable(reason: string) {
    this.available = false;
    this.detail = reason;
    this.status = "down";

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
        status: this.status,
        enabled: false,
        detail: this.detail,
        required: this.required,
      };
    }

    try {
      await this.client.ping();
      return { status: "up" as const, enabled: true, detail: this.detail, required: this.required };
    } catch (error) {
      await this.disable(`Redis unavailable; cache disabled: ${toDependencyDetail(error, "Redis ping failed")}`);
      return {
        status: "down" as const,
        enabled: false,
        detail: this.detail,
        required: this.required,
      };
    }
  }

  async close() {
    if (this.client.isOpen) {
      await this.client.quit();
    }
  }

  markConnected() {
    this.available = true;
    this.status = "up";
    this.detail = "Redis connection healthy";
  }

  async markStartupFailure(error: unknown) {
    await this.disable(`Redis unavailable; cache disabled: ${toDependencyDetail(error, "Redis connect failed")}`);
  }
}

interface CreateCacheClientOptions {
  url?: string;
  mode?: RuntimeMode;
  createClient?: RedisClientFactory;
}

export async function createCacheClient(options: CreateCacheClientOptions = {}): Promise<CacheClient> {
  const mode = options.mode ?? env.GRAPH_RUNTIME_MODE;
  const url = options.url ?? env.REDIS_URL;
  const required = mode === "live";

  if (!url) {
    return new NoopCacheClient(
      {
        status: "not_configured",
        detail:
          mode === "prototype"
            ? "REDIS_URL is not configured; GRAPH_RUNTIME_MODE=prototype disables cache by default"
            : "REDIS_URL is not configured; GRAPH_RUNTIME_MODE=live requires Redis for acceptance",
      },
      required,
    );
  }

  const factory =
    options.createClient ??
    ((clientOptions) =>
      createClient({
        ...clientOptions,
        socket: {
          connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
          reconnectStrategy: false,
        },
      }) as RedisClientLike);
  const client = factory({ url });
  client.on("error", () => undefined);
  const cacheClient = new RedisCacheClient(client, required);
  const connectPromise = client.connect();
  connectPromise.catch(() => undefined);

  void Promise.race([
    connectPromise,
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Redis connect timeout after ${REDIS_CONNECT_TIMEOUT_MS}ms`));
      }, REDIS_CONNECT_TIMEOUT_MS + 100);
    }),
  ])
    .then(() => {
      cacheClient.markConnected();
    })
    .catch(async (error) => {
      await cacheClient.markStartupFailure(error);
    });

  return cacheClient;
}

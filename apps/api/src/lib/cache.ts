import { Redis } from 'ioredis';

export interface CacheDriver {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  delPrefix(prefix: string): Promise<void>;
  flush(): Promise<void>;
  getType(): 'redis' | 'memory';
  disconnect?(): Promise<void>;
}

/**
 * High-Speed In-Memory Cache Driver with TTL Support.
 * Used as default in development, unit testing, or when REDIS_URL is not configured.
 */
export class MemoryCacheDriver implements CacheDriver {
  private store = new Map<string, { value: any; expiresAt: number | null }>();

  getType(): 'memory' {
    return 'memory';
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const expiresAt = ttlSeconds && ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null;
    this.store.set(key, { value, expiresAt });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async delPrefix(prefix: string): Promise<void> {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  async flush(): Promise<void> {
    this.store.clear();
  }
}

/**
 * Enterprise Production Redis Cache Driver using ioredis.
 * Connected when REDIS_URL or UPSTASH_REDIS_URL environment variable is supplied.
 */
export class RedisCacheDriver implements CacheDriver {
  private redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 2,
      retryStrategy(times) {
        if (times > 3) return null; // stop retrying after 3 attempts
        return Math.min(times * 100, 1000);
      },
      lazyConnect: true
    });

    this.redis.on('error', (err) => {
      console.warn(`⚠️ [RedisCacheDriver] Redis connection warning: ${err.message}`);
    });
  }

  async init(): Promise<void> {
    try {
      await this.redis.connect();
    } catch (err: unknown) {
      console.warn(`⚠️ [RedisCacheDriver] Initial connect failed, will retry lazily: ${(err as Error).message}`);
    }
  }

  getType(): 'redis' {
    return 'redis';
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.redis.get(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds && ttlSeconds > 0) {
        await this.redis.set(key, serialized, 'EX', ttlSeconds);
      } else {
        await this.redis.set(key, serialized);
      }
    } catch (err: unknown) {
      console.warn(`⚠️ [RedisCacheDriver] set failed for key ${key}: ${(err as Error).message}`);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (err: unknown) {
      console.warn(`⚠️ [RedisCacheDriver] del failed for key ${key}: ${(err as Error).message}`);
    }
  }

  async delPrefix(prefix: string): Promise<void> {
    try {
      const stream = this.redis.scanStream({
        match: `${prefix}*`,
        count: 100
      });

      stream.on('data', async (keys: string[]) => {
        if (keys.length > 0) {
          const pipeline = this.redis.pipeline();
          keys.forEach((key) => pipeline.del(key));
          await pipeline.exec();
        }
      });
    } catch (err: unknown) {
      console.warn(`⚠️ [RedisCacheDriver] delPrefix failed for ${prefix}: ${(err as Error).message}`);
    }
  }

  async flush(): Promise<void> {
    try {
      await this.redis.flushdb();
    } catch (err: unknown) {
      console.warn(`⚠️ [RedisCacheDriver] flush failed: ${(err as Error).message}`);
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.redis.quit();
    } catch {
      // ignore
    }
  }
}

/**
 * Unified CacheService with Pluggable Drivers and Hit/Miss Statistics.
 */
export class CacheService {
  private driver: CacheDriver;
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0
  };

  constructor(customDriver?: CacheDriver) {
    if (customDriver) {
      this.driver = customDriver;
      return;
    }

    const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL;
    if (redisUrl) {
      console.log('⚡ [CacheService] Initializing Production RedisCacheDriver...');
      const redisDriver = new RedisCacheDriver(redisUrl);
      this.driver = redisDriver;
      // initiate async connection
      redisDriver.init().catch(() => {});
    } else {
      this.driver = new MemoryCacheDriver();
    }
  }

  getDriverType(): 'redis' | 'memory' {
    return this.driver.getType();
  }

  async get<T>(key: string): Promise<T | null> {
    const val = await this.driver.get<T>(key);
    if (val !== null) {
      this.stats.hits++;
    } else {
      this.stats.misses++;
    }
    return val;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    this.stats.sets++;
    await this.driver.set(key, value, ttlSeconds);
  }

  async del(key: string): Promise<void> {
    this.stats.deletes++;
    await this.driver.del(key);
  }

  async delPrefix(prefix: string): Promise<void> {
    this.stats.deletes++;
    await this.driver.delPrefix(prefix);
  }

  async flush(): Promise<void> {
    await this.driver.flush();
    this.stats = { hits: 0, misses: 0, sets: 0, deletes: 0 };
  }

  /**
   * Reads from cache or executes fetcher and populates cache atomically.
   */
  async getOrSet<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const fresh = await fetcher();
    if (fresh !== undefined && fresh !== null) {
      await this.set(key, fresh, ttlSeconds);
    }
    return fresh;
  }

  // ==========================================================================
  // Domain Specific Cache Key Builders
  // ==========================================================================
  static policyKey(merchantId: string): string {
    return `sauda:policy:merchant:${merchantId}`;
  }

  static catalogSlugKey(merchantSlug: string): string {
    return `sauda:catalog:slug:${merchantSlug}`;
  }

  static productKey(productId: string): string {
    return `sauda:catalog:product:${productId}`;
  }

  // ==========================================================================
  // Domain Specific Invalidation Triggers
  // ==========================================================================
  async invalidateMerchantPolicy(merchantId: string): Promise<void> {
    await this.del(CacheService.policyKey(merchantId));
  }

  async invalidateMerchantCatalog(merchantSlug?: string): Promise<void> {
    if (merchantSlug) {
      await this.del(CacheService.catalogSlugKey(merchantSlug));
    }
    await this.delPrefix('sauda:catalog:');
  }

  getStats() {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRatePercent = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;
    return {
      driver: this.driver.getType(),
      ...this.stats,
      totalRequests,
      hitRatePercent: Number(hitRatePercent.toFixed(2))
    };
  }
}

export const cacheService = new CacheService();

import { logger } from './logger.js';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class InMemoryCache {
  private store = new Map<string, CacheEntry<any>>();
  private defaultTtlSeconds: number;

  constructor(defaultTtlSeconds = 300) {
    this.defaultTtlSeconds = defaultTtlSeconds;

    // Periodic sweep every 60 seconds
    const interval = setInterval(() => {
      this.purgeExpired();
    }, 60000);

    if (interval.unref) {
      interval.unref();
    }
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    logger.debug(`Cache hit for key: ${key}`);
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlSeconds?: number): void {
    const ttl = ttlSeconds ?? this.defaultTtlSeconds;
    if (ttl <= 0) return;

    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttl * 1000,
    });
    logger.debug(`Cache set for key: ${key} (TTL: ${ttl}s)`);
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  private purgeExpired(): void {
    const now = Date.now();
    let purged = 0;
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        purged++;
      }
    }
    if (purged > 0) {
      logger.debug(`Purged ${purged} expired cache entries`);
    }
  }

  get size(): number {
    return this.store.size;
  }
}

export const globalCache = new InMemoryCache(
  parseInt(process.env.CACHE_DEFAULT_TTL || '300', 10)
);

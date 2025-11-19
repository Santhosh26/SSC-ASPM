/**
 * Cache Manager
 *
 * In-memory cache with TTL and LRU eviction.
 * Supports stale cache retrieval for resilience when SSC API fails.
 */

const cacheConfig = require('../config/cache-config');
const logger = require('./logger');

class CacheManager {
  constructor(config = cacheConfig) {
    this.cache = new Map();
    this.ttl = config.ttl;
    this.maxSize = config.maxSize;
    this.ttlByType = config.ttlByType;

    // Statistics
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0
    };

    logger.info('Cache manager initialized', {
      defaultTTL: this.ttl,
      maxSize: this.maxSize
    });
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @param {object} options - Options { ignoreExpiry: boolean }
   * @returns {object|null} - Cached data or null
   */
  get(key, options = {}) {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      logger.debug('Cache miss', { key });
      return null;
    }

    // Check expiry unless ignoreExpiry is true (for stale cache retrieval)
    if (!options.ignoreExpiry && this.isExpired(entry)) {
      logger.debug('Cache expired', { key, age: Date.now() - entry.timestamp });
      this.stats.misses++;
      return null;
    }

    // Update access time for LRU
    entry.lastAccessed = Date.now();
    this.cache.set(key, entry);

    this.stats.hits++;
    logger.debug('Cache hit', {
      key,
      stale: options.ignoreExpiry && this.isExpired(entry)
    });

    return {
      data: entry.data,
      timestamp: entry.timestamp,
      stale: options.ignoreExpiry && this.isExpired(entry)
    };
  }

  /**
   * Set value in cache
   * @param {string} key - Cache key
   * @param {*} data - Data to cache
   * @param {number} ttl - TTL in milliseconds (optional)
   */
  set(key, data, ttl = this.ttl) {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    const entry = {
      data,
      timestamp: Date.now(),
      lastAccessed: Date.now(),
      ttl
    };

    this.cache.set(key, entry);
    this.stats.sets++;

    logger.debug('Cache set', {
      key,
      ttl,
      size: this.cache.size
    });
  }

  /**
   * Delete value from cache
   * @param {string} key - Cache key
   */
  delete(key) {
    const deleted = this.cache.delete(key);
    if (deleted) {
      logger.debug('Cache delete', { key });
    }
    return deleted;
  }

  /**
   * Clear all cache entries
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    logger.info('Cache cleared', { entriesCleared: size });
  }

  /**
   * Check if cache entry is expired
   * @param {object} entry - Cache entry
   * @returns {boolean} - True if expired
   */
  isExpired(entry) {
    if (!entry) return true;
    const age = Date.now() - entry.timestamp;
    return age > entry.ttl;
  }

  /**
   * Evict least recently used entry
   */
  evictLRU() {
    let oldestKey = null;
    let oldestAccess = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestAccess) {
        oldestAccess = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
      logger.debug('LRU eviction', {
        key: oldestKey,
        age: Date.now() - oldestAccess
      });
    }
  }

  /**
   * Generate cache key from metric and filters
   * @param {string} metric - Metric name (e.g., 'program_kpis')
   * @param {object} filters - Filter object
   * @returns {string} - Cache key
   */
  generateKey(metric, filters = {}) {
    if (!filters || Object.keys(filters).length === 0) {
      return `${metric}_all`;
    }

    // Sort filter keys for consistent key generation
    const filterParts = Object.keys(filters)
      .sort()
      .map(key => `${key}:${filters[key]}`)
      .join('_');

    return `${metric}_${filterParts}`;
  }

  /**
   * Get cache statistics
   * @returns {object} - Cache stats
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? this.stats.hits / (this.stats.hits + this.stats.misses)
      : 0;

    // Find oldest entry
    let oldestTimestamp = Date.now();
    for (const entry of this.cache.values()) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
      }
    }

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.stats.hits,
      misses: this.stats.misses,
      sets: this.stats.sets,
      evictions: this.stats.evictions,
      hitRate: Math.round(hitRate * 100) / 100,
      oldestEntry: this.cache.size > 0 ? new Date(oldestTimestamp).toISOString() : null
    };
  }

  /**
   * Get all cache keys
   * @returns {Array<string>} - List of cache keys
   */
  getKeys() {
    return Array.from(this.cache.keys());
  }

  /**
   * Get TTL for a specific data type
   * @param {string} type - Data type (metadata, kpis, trends, expensive)
   * @returns {number} - TTL in milliseconds
   */
  getTTLForType(type) {
    return this.ttlByType[type] || this.ttl;
  }
}

// Export singleton instance
module.exports = new CacheManager();

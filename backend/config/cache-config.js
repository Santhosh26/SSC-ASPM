/**
 * Cache Configuration
 *
 * In-memory cache settings with TTL management.
 * Different data types have different TTLs based on update frequency.
 */

module.exports = {
  // Default TTL in milliseconds (15 minutes)
  ttl: parseInt(process.env.CACHE_TTL) || 900000,

  // Maximum number of cache entries (LRU eviction when exceeded)
  maxSize: parseInt(process.env.CACHE_MAX_SIZE) || 100,

  // TTL by data type (in milliseconds)
  ttlByType: {
    // Metadata (filter options, version lists) - changes infrequently
    metadata: 3600000,    // 1 hour

    // KPIs (counts, basic metrics) - moderate update frequency
    kpis: 900000,         // 15 minutes

    // Trends and time-series data
    trends: 1800000,      // 30 minutes

    // Expensive calculations (star ratings, aggregations)
    expensive: 1800000    // 30 minutes
  }
};

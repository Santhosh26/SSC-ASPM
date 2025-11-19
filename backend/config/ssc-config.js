/**
 * SSC API Configuration
 *
 * Configuration for Fortify Software Security Center API client.
 * Based on validated patterns from Phase 1.
 */

module.exports = {
  // Base URL for SSC API (includes /api/v1)
  baseUrl: process.env.SSC_URL,

  // FortifyToken for authentication (Unified auth token - more powerful)
  token: process.env.SSC_TOKEN,

  // Request timeout in milliseconds
  timeout: parseInt(process.env.SSC_TIMEOUT) || 30000,

  // Retry configuration for failed requests
  retries: 3,
  retryDelay: 1000,

  // Concurrency limiting for parallel requests
  // IMPORTANT: Reduced to 2 due to 504 Gateway Timeout errors at concurrency 5
  // SSC v25.2.2 staging instance cannot handle 5 concurrent /issues requests
  maxConcurrentRequests: 2,

  // Pagination defaults
  defaultPageSize: 200,
  maxPageSize: 1000,

  // SSC API version
  version: '25.2.2.0005'
};

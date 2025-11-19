/**
 * Data Aggregator
 *
 * Helper functions for common SSC data aggregation patterns.
 * Based on validated patterns from Phase 1.
 *
 * CRITICAL IMPLEMENTATIONS:
 * - Parallel version iteration (no global /issues endpoint)
 * - YoY delta approximation using creation dates
 * - Star rating calculation from severity
 */

const sscConfig = require('../config/ssc-config');
const logger = require('./logger');

/**
 * Execute multiple requests in parallel with concurrency limit
 * @param {Array<Function>} requests - Array of async functions returning promises
 * @param {number} concurrency - Max concurrent requests (default: 5)
 * @returns {Promise<Array>} - Results from all requests
 */
async function parallelFetch(requests, concurrency = sscConfig.maxConcurrentRequests) {
  const results = [];
  const chunks = chunkArray(requests, concurrency);

  for (const chunk of chunks) {
    const chunkResults = await Promise.all(chunk.map(fn => fn()));
    results.push(...chunkResults);
  }

  return results;
}

/**
 * Split array into chunks
 * @param {Array} array - Array to chunk
 * @param {number} size - Chunk size
 * @returns {Array<Array>} - Array of chunks
 */
function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Aggregate issues across all versions (CRITICAL IMPLEMENTATION)
 *
 * Since SSC v25.2 has NO global /issues endpoint, we must:
 * 1. Iterate through all project versions
 * 2. Fetch issues for each version
 * 3. Aggregate results in application code
 *
 * @param {object} sscClient - SSC API client instance
 * @param {Array} versions - List of project versions
 * @param {string} fields - Comma-separated fields to fetch
 * @returns {Promise<Array>} - All issues across all versions
 */
async function aggregateIssuesAcrossVersions(sscClient, versions, fields = 'severity,removed,scanStatus,foundDate') {
  logger.info('Aggregating issues across versions', {
    versionCount: versions.length,
    fields
  });

  const chunks = chunkArray(versions, sscConfig.maxConcurrentRequests);
  const allIssues = [];

  for (const chunk of chunks) {
    const promises = chunk.map(version =>
      sscClient.get(`/projectVersions/${version.id}/issues`, {
        limit: sscConfig.maxPageSize,
        fields
      }).catch(error => {
        logger.warn('Failed to fetch issues for version', {
          versionId: version.id,
          error: error.message
        });
        return { data: [] }; // Return empty array on error
      })
    );

    const results = await Promise.all(promises);
    const issues = results.flatMap(r => r.data || []);
    allIssues.push(...issues);
  }

  logger.info('Issue aggregation complete', {
    totalIssues: allIssues.length,
    versionsProcessed: versions.length
  });

  return allIssues;
}

/**
 * Build SSC query string from filter object
 * @param {object} filters - Filter object
 * @returns {string} - SSC query string
 */
function buildFilterQuery(filters) {
  if (!filters || Object.keys(filters).length === 0) {
    return '';
  }

  const queryParts = [];

  // Business Unit filter
  if (filters.businessUnit && filters.businessUnit.length > 0) {
    const values = Array.isArray(filters.businessUnit) ? filters.businessUnit : [filters.businessUnit];
    queryParts.push(`customAttributes.BusinessUnit:[${values.join(',')}]`);
  }

  // Business Criticality filter
  if (filters.criticality && filters.criticality.length > 0) {
    const values = Array.isArray(filters.criticality) ? filters.criticality : [filters.criticality];
    queryParts.push(`customAttributes.BusinessCriticality:[${values.join(',')}]`);
  }

  // Application Type filter
  if (filters.applicationType && filters.applicationType.length > 0) {
    const values = Array.isArray(filters.applicationType) ? filters.applicationType : [filters.applicationType];
    queryParts.push(`customAttributes.ApplicationType:[${values.join(',')}]`);
  }

  // SDLC Status filter
  if (filters.sdlcStatus && filters.sdlcStatus.length > 0) {
    const values = Array.isArray(filters.sdlcStatus) ? filters.sdlcStatus : [filters.sdlcStatus];
    queryParts.push(`customAttributes.SDLCStatus:[${values.join(',')}]`);
  }

  return queryParts.join('+');
}

/**
 * Calculate Year-over-Year delta using creation date approximation (CRITICAL IMPLEMENTATION)
 *
 * SSC doesn't store historical snapshots, so we approximate YoY growth by:
 * 1. Count all active items (current count)
 * 2. Count items created more than 12 months ago (baseline)
 * 3. Calculate delta = current - baseline
 *
 * LIMITATIONS:
 * - Shows growth only (assumes no deletions)
 * - Accurate for growing environments (typical case)
 *
 * @param {Array} items - Array of items with creation date
 * @param {string} dateField - Field name containing creation date (default: 'creationDate')
 * @returns {object} - YoY statistics
 */
function calculateYoYDelta(items, dateField = 'creationDate') {
  const current = items.length;

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const baseline = items.filter(item => {
    if (!item[dateField]) return false;
    return new Date(item[dateField]) < twelveMonthsAgo;
  }).length;

  const delta = current - baseline;
  const percentage = baseline > 0 ? ((delta / baseline) * 100) : 0;

  logger.debug('YoY delta calculated', {
    current,
    baseline,
    delta,
    percentage: Math.round(percentage * 10) / 10
  });

  return {
    current,
    baseline,
    delta,
    percentage: Math.round(percentage * 10) / 10
  };
}

/**
 * Calculate star rating from issue severity (CRITICAL IMPLEMENTATION)
 *
 * Star ratings are NOT stored in SSC - must calculate from issue severity.
 *
 * SSC Severity Scale:
 * - 1.0 = Critical
 * - 2.0 = High
 * - 3.0 = Medium
 * - 4.0 = Low
 * - 5.0 = Info/Best Practice
 *
 * Star Rating Logic:
 * - Find minimum severity across all issues
 * - min_severity <= 1.0 → 1★ (Has Critical)
 * - min_severity <= 2.0 → 2★ (Has High)
 * - min_severity <= 3.0 → 3★ (Has Medium)
 * - min_severity <= 4.0 → 4★ (Has Low)
 * - min_severity > 4.0 or no issues → 5★ (Clean)
 *
 * @param {Array} issues - Array of issues with severity field
 * @returns {number} - Star rating (1-5)
 */
function calculateStarRating(issues) {
  if (!issues || issues.length === 0) {
    return 5; // Clean - no issues
  }

  const minSeverity = Math.min(...issues.map(i => i.severity));

  if (minSeverity <= 1.0) return 1; // Has Critical
  if (minSeverity <= 2.0) return 2; // Has High
  if (minSeverity <= 3.0) return 3; // Has Medium
  if (minSeverity <= 4.0) return 4; // Has Low
  return 5; // Only Info/Best Practice
}

/**
 * Filter removed issues (CRITICAL - cannot use q=removed:false)
 * @param {Array} issues - Array of issues
 * @returns {Array} - Issues where removed=false
 */
function filterOpenIssues(issues) {
  return issues.filter(issue => issue.removed === false);
}

/**
 * Group issues by severity
 * @param {Array} issues - Array of issues
 * @returns {object} - Issues grouped by severity level
 */
function groupBySeverity(issues) {
  const groups = {
    critical: 0,  // severity 1.0
    high: 0,      // severity 2.0
    medium: 0,    // severity 3.0
    low: 0,       // severity 4.0
    info: 0       // severity 5.0
  };

  issues.forEach(issue => {
    const severity = issue.severity;
    if (severity === 1.0) groups.critical++;
    else if (severity === 2.0) groups.high++;
    else if (severity === 3.0) groups.medium++;
    else if (severity === 4.0) groups.low++;
    else if (severity === 5.0) groups.info++;
  });

  return groups;
}

/**
 * Calculate review status (using scanStatus field)
 * @param {Array} issues - Array of issues with scanStatus field
 * @returns {object} - Review statistics
 */
function calculateReviewStats(issues) {
  const reviewed = issues.filter(i => i.scanStatus !== 'UNREVIEWED').length;
  const unreviewed = issues.length - reviewed;
  const reviewRate = issues.length > 0 ? (reviewed / issues.length) * 100 : 0;

  return {
    reviewed,
    unreviewed,
    total: issues.length,
    reviewRate: Math.round(reviewRate * 10) / 10
  };
}

/**
 * Calculate Mean Time To Remediate (MTTR)
 * @param {Array} issues - Array of issues with foundDate and removedDate
 * @returns {object} - MTTR statistics
 */
function calculateMTTR(issues) {
  const remediatedIssues = issues.filter(i =>
    i.removed && i.foundDate && i.removedDate
  );

  if (remediatedIssues.length === 0) {
    return { avgDays: 0, count: 0 };
  }

  const totalDays = remediatedIssues.reduce((sum, issue) => {
    const found = new Date(issue.foundDate);
    const removed = new Date(issue.removedDate);
    const days = (removed - found) / (1000 * 60 * 60 * 24);
    return sum + days;
  }, 0);

  const avgDays = totalDays / remediatedIssues.length;

  return {
    avgDays: Math.round(avgDays * 10) / 10,
    count: remediatedIssues.length
  };
}

/**
 * Fetch all issues across all filtered versions (HIGH-LEVEL HELPER)
 *
 * This is the main function to use for fetching issues.
 * It handles version fetching + issue aggregation.
 *
 * @param {object} sscClient - SSC API client
 * @param {object} filters - Filter parameters
 * @param {string} fields - Comma-separated fields to fetch
 * @returns {Promise<Array>} - All issues
 */
async function fetchAllIssues(sscClient, filters, fields = 'severity,removed,scanStatus,foundDate,removedDate') {
  logger.info('Fetching all issues', { filters });

  // Build filter query
  const filterQuery = buildFilterQuery(filters);

  // Fetch all versions (with filters applied)
  const versions = await sscClient.getWithPagination('/projectVersions', {
    q: filterQuery
  });

  logger.info('Versions fetched, starting issue aggregation', {
    versionCount: versions.length
  });

  // Aggregate issues across all versions
  const allIssues = await aggregateIssuesAcrossVersions(sscClient, versions, fields);

  return allIssues;
}

module.exports = {
  parallelFetch,
  chunkArray,
  aggregateIssuesAcrossVersions,
  fetchAllIssues,
  buildFilterQuery,
  calculateYoYDelta,
  calculateStarRating,
  filterOpenIssues,
  groupBySeverity,
  calculateReviewStats,
  calculateMTTR
};

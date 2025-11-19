/**
 * Risk Exposure Dashboard Transformer
 *
 * Transforms SSC API data for Risk Dashboard endpoints.
 * Phase 3 implementation with real SSC data fetching.
 */

const { buildFilterQuery, fetchAllIssues, filterOpenIssues, groupBySeverity } = require('../services/data-aggregator');
const logger = require('../services/logger');

/**
 * Transform compliance data
 * @param {object} sscClient - SSC API client
 * @param {object} filters - Filter parameters
 * @returns {object} - Transformed compliance metrics
 */
exports.transformCompliance = async (sscClient, filters) => {
  try {
    logger.info('Fetching compliance data', { filters });

    const filterQuery = buildFilterQuery(filters);

    // Fetch all versions with performance indicators embedded
    const versions = await sscClient.getWithPagination('/projectVersions', {
      q: filterQuery,
      embed: 'performanceIndicators'
    });

    logger.info('Versions fetched for compliance', { versionCount: versions.length });

    // Count versions by FortifySecurityRating
    let pass = 0;
    let fail = 0;
    let unassessed = 0;

    versions.forEach(version => {
      // Find the FortifySecurityRating performance indicator
      const indicators = version._embed?.performanceIndicators || [];
      const securityRating = indicators.find(ind => ind.type === 'FortifySecurityRating');

      if (!securityRating || securityRating.value === null) {
        unassessed++;
      } else if (securityRating.value >= 4.0) {
        // 4.0-5.0 is Pass (4★ or 5★)
        pass++;
      } else {
        // 1.0-3.9 is Fail (1★, 2★, or 3★)
        fail++;
      }
    });

    logger.info('Compliance calculated', { pass, fail, unassessed });

    return {
      pass,
      fail,
      unassessed
    };
  } catch (error) {
    logger.error('Error transforming compliance', { error: error.message });
    throw error;
  }
};

/**
 * Transform star ratings data
 * @param {object} sscClient - SSC API client
 * @param {object} filters - Filter parameters
 * @returns {object} - Transformed star ratings distribution
 */
exports.transformStarRatings = async (sscClient, filters) => {
  try {
    logger.info('Fetching star ratings data', { filters });

    const { buildFilterQuery, calculateStarRating, filterOpenIssues, chunkArray } = require('../services/data-aggregator');
    const sscConfig = require('../config/ssc-config');

    const filterQuery = buildFilterQuery(filters);

    // Fetch all versions
    const versions = await sscClient.getWithPagination('/projectVersions', {
      q: filterQuery
    });

    logger.info('Versions fetched for star ratings', { versionCount: versions.length });

    // Process versions in parallel chunks (5 concurrent)
    const chunks = chunkArray(versions, sscConfig.maxConcurrentRequests);
    const starRatings = {
      oneStar: 0,
      twoStar: 0,
      threeStar: 0,
      fourStar: 0,
      fiveStar: 0
    };

    for (const chunk of chunks) {
      const promises = chunk.map(async (version) => {
        try {
          // Fetch issues for this version (only severity and removed fields)
          const response = await sscClient.get(`/projectVersions/${version.id}/issues`, {
            limit: sscConfig.maxPageSize,
            fields: 'severity,removed'
          });

          const issues = response.data || [];

          // Filter to open issues only
          const openIssues = filterOpenIssues(issues);

          // Calculate star rating for this version
          const rating = calculateStarRating(openIssues);

          return rating;
        } catch (error) {
          logger.warn('Failed to fetch issues for version (star rating)', {
            versionId: version.id,
            error: error.message
          });
          // Return 5 stars (clean) if we can't fetch issues
          return 5;
        }
      });

      // Wait for this chunk to complete
      const chunkRatings = await Promise.all(promises);

      // Aggregate ratings
      chunkRatings.forEach(rating => {
        if (rating === 1) starRatings.oneStar++;
        else if (rating === 2) starRatings.twoStar++;
        else if (rating === 3) starRatings.threeStar++;
        else if (rating === 4) starRatings.fourStar++;
        else if (rating === 5) starRatings.fiveStar++;
      });
    }

    logger.info('Star ratings calculated', starRatings);

    return starRatings;
  } catch (error) {
    logger.error('Error transforming star ratings', { error: error.message });
    throw error;
  }
};

/**
 * Transform open issues data
 * @param {object} sscClient - SSC API client
 * @param {object} filters - Filter parameters
 * @returns {object} - Transformed open issues by severity
 */
exports.transformOpenIssues = async (sscClient, filters) => {
  try {
    logger.info('Fetching open issues data', { filters });

    // Fetch all issues across all filtered versions
    const allIssues = await fetchAllIssues(sscClient, filters, 'severity,removed');

    // Filter to only open issues (removed=false)
    const openIssues = filterOpenIssues(allIssues);

    // Group by severity
    const grouped = groupBySeverity(openIssues);

    logger.info('Open issues calculated', {
      total: openIssues.length,
      critical: grouped.critical,
      high: grouped.high,
      medium: grouped.medium,
      low: grouped.low,
      info: grouped.info
    });

    return {
      ...grouped,
      total: openIssues.length
    };
  } catch (error) {
    logger.error('Error transforming open issues', { error: error.message });
    throw error;
  }
};

/**
 * Transform vulnerability density data
 * @param {object} data - Raw SSC data
 * @returns {object} - Transformed density metrics
 */
exports.transformDensity = (data) => {
  // STUB - Phase 3 will implement actual transformation
  return {
    issuesPerKLOC: 0,
    totalIssues: 0,
    totalKLOC: 0
  };
};

/**
 * Transform detection trend data
 * @param {object} sscClient - SSC API client
 * @param {object} filters - Filter parameters
 * @returns {object} - Transformed trend metrics
 */
exports.transformDetectionTrend = async (sscClient, filters) => {
  try {
    logger.info('Fetching detection trend data', { filters });

    // Fetch all issues with foundDate
    const allIssues = await fetchAllIssues(sscClient, filters, 'severity,removed,foundDate');

    // Filter to only open issues
    const openIssues = filterOpenIssues(allIssues);

    // Calculate time thresholds
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Count issues found in last week/month
    let newLastWeek = 0;
    let newLastMonth = 0;

    openIssues.forEach(issue => {
      if (!issue.foundDate) return;

      const foundDate = new Date(issue.foundDate);

      if (foundDate >= oneWeekAgo) {
        newLastWeek++;
      }

      if (foundDate >= oneMonthAgo) {
        newLastMonth++;
      }
    });

    // Determine trend (simple logic: compare week vs month average)
    const avgPerWeekFromMonth = newLastMonth / 4.3; // 30 days / 7 days
    let trend = 'stable';

    if (newLastWeek > avgPerWeekFromMonth * 1.2) {
      trend = 'increasing';
    } else if (newLastWeek < avgPerWeekFromMonth * 0.8) {
      trend = 'decreasing';
    }

    logger.info('Detection trend calculated', {
      newLastWeek,
      newLastMonth,
      trend
    });

    return {
      newLastWeek,
      newLastMonth,
      trend
    };
  } catch (error) {
    logger.error('Error transforming detection trend', { error: error.message });
    throw error;
  }
};

/**
 * Transform prevalent vulnerabilities data
 * @param {object} data - Raw SSC data
 * @returns {Array} - Top prevalent vulnerability types
 */
exports.transformPrevalent = (data) => {
  // STUB - Phase 3 will implement actual transformation
  return [];
};

/**
 * Transform aging matrix data
 * @param {object} data - Raw SSC data
 * @returns {object} - Transformed aging distribution
 */
exports.transformAgingMatrix = (data) => {
  // STUB - Phase 3 will implement actual transformation
  return {
    under30Days: 0,
    days30to90: 0,
    days90to180: 0,
    over180Days: 0
  };
};

/**
 * Transform open source security data
 * @param {object} data - Raw SSC data
 * @returns {object} - Transformed open source metrics
 */
exports.transformOpenSourceSecurity = (data) => {
  // STUB - Phase 3 will implement actual transformation
  return {
    components: 0,
    vulnerabilities: 0,
    critical: 0,
    high: 0
  };
};

/**
 * Transform open source license data
 * @param {object} data - Raw SSC data
 * @returns {object} - Transformed license distribution
 */
exports.transformOpenSourceLicenses = (data) => {
  // STUB - Phase 3 will implement actual transformation
  return {
    permissive: 0,
    copyleft: 0,
    proprietary: 0,
    unknown: 0
  };
};

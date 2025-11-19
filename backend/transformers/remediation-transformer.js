/**
 * Remediation Dashboard Transformer
 *
 * Transforms SSC API data for Remediation Dashboard endpoints.
 * Phase 3 implementation with real SSC data fetching.
 */

const { fetchAllIssues, calculateMTTR } = require('../services/data-aggregator');
const logger = require('../services/logger');

/**
 * Transform remediation rates data
 * @param {object} sscClient - SSC API client
 * @param {object} filters - Filter parameters
 * @returns {object} - Transformed remediation metrics
 */
exports.transformRemediationRates = async (sscClient, filters) => {
  try {
    logger.info('Fetching remediation rates data', { filters });

    // Fetch all issues with removal dates
    const allIssues = await fetchAllIssues(sscClient, filters, 'severity,removed,removedDate');

    // Calculate time thresholds
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    // Count remediated issues in each period
    let lastWeek = 0;
    let lastMonth = 0;
    let lastQuarter = 0;

    allIssues.forEach(issue => {
      if (issue.removed && issue.removedDate) {
        const removedDate = new Date(issue.removedDate);

        if (removedDate >= oneWeekAgo) {
          lastWeek++;
        }

        if (removedDate >= oneMonthAgo) {
          lastMonth++;
        }

        if (removedDate >= threeMonthsAgo) {
          lastQuarter++;
        }
      }
    });

    // Calculate overall rate (percentage of issues remediated)
    const totalRemoved = allIssues.filter(i => i.removed).length;
    const rate = allIssues.length > 0 ? Math.round((totalRemoved / allIssues.length) * 100) : 0;

    logger.info('Remediation rates calculated', {
      lastWeek,
      lastMonth,
      lastQuarter,
      rate: `${rate}%`
    });

    return {
      lastWeek,
      lastMonth,
      lastQuarter,
      rate
    };
  } catch (error) {
    logger.error('Error transforming remediation rates', { error: error.message });
    throw error;
  }
};

/**
 * Transform MTTR data
 * @param {object} sscClient - SSC API client
 * @param {object} filters - Filter parameters
 * @returns {object} - Transformed MTTR metrics
 */
exports.transformMTTR = async (sscClient, filters) => {
  try {
    logger.info('Fetching MTTR data', { filters });

    // Fetch all issues with foundDate and removedDate
    const allIssues = await fetchAllIssues(sscClient, filters, 'severity,removed,foundDate,removedDate');

    // Calculate overall MTTR
    const overallMTTR = calculateMTTR(allIssues);

    // Calculate MTTR by severity
    const critical = allIssues.filter(i => i.severity === 1.0);
    const high = allIssues.filter(i => i.severity === 2.0);
    const medium = allIssues.filter(i => i.severity === 3.0);
    const low = allIssues.filter(i => i.severity === 4.0);

    const bySeverity = {
      critical: calculateMTTR(critical).avgDays,
      high: calculateMTTR(high).avgDays,
      medium: calculateMTTR(medium).avgDays,
      low: calculateMTTR(low).avgDays
    };

    logger.info('MTTR calculated', {
      avgDays: overallMTTR.avgDays,
      remediatedCount: overallMTTR.count,
      bySeverity
    });

    return {
      avgDays: overallMTTR.avgDays,
      bySeverity
    };
  } catch (error) {
    logger.error('Error transforming MTTR', { error: error.message });
    throw error;
  }
};

/**
 * Transform remediation trend data
 * @param {object} sscClient - SSC API client
 * @param {object} filters - Filter parameters
 * @returns {object} - Transformed trend metrics
 */
exports.transformRemediationTrend = async (sscClient, filters) => {
  try {
    logger.info('Fetching remediation trend data', { filters });

    // Fetch all issues with removal dates
    const allIssues = await fetchAllIssues(sscClient, filters, 'severity,removed,removedDate');

    // Calculate time thresholds for current and last month
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Count remediations in current and last month
    let thisMonth = 0;
    let lastMonth = 0;

    allIssues.forEach(issue => {
      if (issue.removed && issue.removedDate) {
        const removedDate = new Date(issue.removedDate);

        if (removedDate >= thisMonthStart) {
          thisMonth++;
        } else if (removedDate >= lastMonthStart && removedDate <= lastMonthEnd) {
          lastMonth++;
        }
      }
    });

    // Determine trend
    let trend = 'stable';
    if (thisMonth > lastMonth * 1.1) {
      trend = 'increasing';
    } else if (thisMonth < lastMonth * 0.9) {
      trend = 'decreasing';
    }

    logger.info('Remediation trend calculated', {
      thisMonth,
      lastMonth,
      trend
    });

    return {
      thisMonth,
      lastMonth,
      trend
    };
  } catch (error) {
    logger.error('Error transforming remediation trend', { error: error.message });
    throw error;
  }
};

/**
 * Transform review metrics data
 * @param {object} sscClient - SSC API client
 * @param {object} filters - Filter parameters
 * @returns {object} - Transformed review metrics
 */
exports.transformReviewMetrics = async (sscClient, filters) => {
  try {
    logger.info('Fetching review metrics data', { filters });

    const { calculateReviewStats, filterOpenIssues } = require('../services/data-aggregator');

    // Fetch all issues with scanStatus field
    const allIssues = await fetchAllIssues(sscClient, filters, 'severity,removed,scanStatus,foundDate,reviewedDate');

    // Filter to open issues only
    const openIssues = filterOpenIssues(allIssues);

    // Calculate review statistics
    const reviewStats = calculateReviewStats(openIssues);

    // Calculate mean time to review (for reviewed issues with both dates)
    const reviewedWithDates = openIssues.filter(i =>
      i.scanStatus !== 'UNREVIEWED' && i.foundDate && i.reviewedDate
    );

    let meanTimeToReview = 0;
    if (reviewedWithDates.length > 0) {
      const totalDays = reviewedWithDates.reduce((sum, issue) => {
        const found = new Date(issue.foundDate);
        const reviewed = new Date(issue.reviewedDate);
        const days = (reviewed - found) / (1000 * 60 * 60 * 24);
        return sum + (days > 0 ? days : 0);
      }, 0);

      meanTimeToReview = Math.round((totalDays / reviewedWithDates.length) * 10) / 10;
    }

    logger.info('Review metrics calculated', {
      reviewed: reviewStats.reviewed,
      unreviewed: reviewStats.unreviewed,
      reviewRate: reviewStats.reviewRate,
      meanTimeToReview
    });

    return {
      reviewed: reviewStats.reviewed,
      unreviewed: reviewStats.unreviewed,
      reviewRate: reviewStats.reviewRate,
      meanTimeToReview
    };
  } catch (error) {
    logger.error('Error transforming review metrics', { error: error.message });
    throw error;
  }
};

/**
 * Transform recurrence data
 * @param {object} sscClient - SSC API client
 * @param {object} filters - Filter parameters
 * @returns {Promise<object>} - Transformed recurrence metrics
 */
exports.transformRecurrence = async (sscClient, filters) => {
  try {
    logger.info('Fetching recurrence data', { filters });

    // Fetch all issues with hasCorrelatedIssues field (Phase 1 validated field)
    const { fetchAllIssues, filterOpenIssues } = require('../services/data-aggregator');

    const allIssues = await fetchAllIssues(sscClient, filters, 'severity,removed,hasCorrelatedIssues');
    const openIssues = filterOpenIssues(allIssues);

    // Count issues with recurrence (hasCorrelatedIssues = true)
    const recurrentIssues = openIssues.filter(issue => issue.hasCorrelatedIssues === true);

    const recurrenceRate = openIssues.length > 0
      ? Math.round((recurrentIssues.length / openIssues.length) * 1000) / 10
      : 0;

    logger.info('Recurrence calculated', {
      totalRecurrences: recurrentIssues.length,
      totalIssues: openIssues.length,
      recurrenceRate
    });

    return {
      recurrenceRate,
      totalRecurrences: recurrentIssues.length
    };
  } catch (error) {
    logger.error('Error transforming recurrence', { error: error.message });
    throw error;
  }
};

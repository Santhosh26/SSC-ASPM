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
 * @param {object} sscClient - SSC API client
 * @param {object} filters - Filter parameters
 * @returns {Promise<object>} - Transformed density metrics
 */
exports.transformDensity = async (sscClient, filters) => {
  try {
    logger.info('Fetching density data', { filters });

    // Fetch all open issues for total count
    const allIssues = await fetchAllIssues(sscClient, filters, 'severity,removed');
    const openIssues = filterOpenIssues(allIssues);

    // Fetch LOC from artifacts (same as scan metrics)
    const { buildFilterQuery, chunkArray } = require('../services/data-aggregator');
    const sscConfig = require('../config/ssc-config');

    const filterQuery = buildFilterQuery(filters);
    const versions = await sscClient.getWithPagination('/projectVersions', {
      q: filterQuery
    });

    let totalLOC = 0;
    const chunks = chunkArray(versions, sscConfig.maxConcurrentRequests);

    for (const chunk of chunks) {
      const promises = chunk.map(async (version) => {
        try {
          const response = await sscClient.get(`/projectVersions/${version.id}/artifacts`, {
            limit: 1000
          });
          const artifacts = response.data || [];

          artifacts.forEach(artifact => {
            if (artifact.linesOfCode) {
              totalLOC += artifact.linesOfCode;
            }
          });
        } catch (error) {
          logger.warn('Failed to fetch artifacts for version', {
            versionId: version.id,
            error: error.message
          });
        }
      });

      await Promise.all(promises);
    }

    const totalKLOC = totalLOC / 1000;
    const issuesPerKLOC = totalKLOC > 0
      ? Math.round((openIssues.length / totalKLOC) * 10) / 10
      : 0;

    logger.info('Density calculated', {
      totalIssues: openIssues.length,
      totalLOC,
      totalKLOC: Math.round(totalKLOC * 10) / 10,
      issuesPerKLOC
    });

    return {
      issuesPerKLOC,
      totalIssues: openIssues.length,
      totalKLOC: Math.round(totalKLOC * 10) / 10
    };
  } catch (error) {
    logger.error('Error transforming density', { error: error.message });
    throw error;
  }
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
 * @param {object} sscClient - SSC API client
 * @param {object} filters - Filter parameters
 * @returns {Promise<Array>} - Top prevalent vulnerability types
 */
exports.transformPrevalent = async (sscClient, filters) => {
  try {
    logger.info('Fetching prevalent vulnerabilities', { filters });

    // Fetch all open issues with issueName field
    const allIssues = await fetchAllIssues(sscClient, filters, 'severity,removed,issueName,friority');
    const openIssues = filterOpenIssues(allIssues);

    // Group by issue name and count occurrences
    const issueGroups = {};

    openIssues.forEach(issue => {
      const name = issue.issueName || issue.friority || 'Unknown';

      if (!issueGroups[name]) {
        issueGroups[name] = {
          name,
          count: 0,
          severity: issue.severity || 5.0
        };
      }

      issueGroups[name].count++;

      // Use highest severity (lowest number) for this issue type
      if (issue.severity && issue.severity < issueGroups[name].severity) {
        issueGroups[name].severity = issue.severity;
      }
    });

    // Convert to array, sort by count, and take top 10
    const sortedIssues = Object.values(issueGroups)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(issue => ({
        name: issue.name,
        count: issue.count,
        severity: issue.severity,
        percentage: Math.round((issue.count / openIssues.length) * 1000) / 10
      }));

    logger.info('Prevalent vulnerabilities calculated', {
      totalIssueTypes: Object.keys(issueGroups).length,
      topIssues: sortedIssues.length
    });

    return sortedIssues;
  } catch (error) {
    logger.error('Error transforming prevalent vulnerabilities', { error: error.message });
    throw error;
  }
};

/**
 * Transform aging matrix data
 * @param {object} sscClient - SSC API client
 * @param {object} filters - Filter parameters
 * @returns {Promise<object>} - Transformed aging distribution
 */
exports.transformAgingMatrix = async (sscClient, filters) => {
  try {
    logger.info('Fetching aging matrix data', { filters });

    // Fetch all open issues with foundDate
    const allIssues = await fetchAllIssues(sscClient, filters, 'severity,removed,foundDate');
    const openIssues = filterOpenIssues(allIssues);

    // Calculate age distribution
    const now = new Date();
    const aging = {
      under30Days: 0,
      days30to90: 0,
      days90to180: 0,
      over180Days: 0
    };

    openIssues.forEach(issue => {
      if (!issue.foundDate) return;

      const foundDate = new Date(issue.foundDate);
      const ageInDays = (now - foundDate) / (1000 * 60 * 60 * 24);

      if (ageInDays < 30) {
        aging.under30Days++;
      } else if (ageInDays < 90) {
        aging.days30to90++;
      } else if (ageInDays < 180) {
        aging.days90to180++;
      } else {
        aging.over180Days++;
      }
    });

    logger.info('Aging matrix calculated', {
      totalIssues: openIssues.length,
      distribution: aging
    });

    return aging;
  } catch (error) {
    logger.error('Error transforming aging matrix', { error: error.message });
    throw error;
  }
};

/**
 * Transform open source security data
 * @param {object} sscClient - SSC API client
 * @param {object} filters - Filter parameters
 * @returns {Promise<object>} - Transformed open source metrics
 */
exports.transformOpenSourceSecurity = async (sscClient, filters) => {
  try {
    logger.info('Fetching open source security data', { filters });

    // Fetch dependency scan issues using correct Phase 1 endpoint
    // /api/v1/projectVersions/{id}/dependencyScanIssues?engineType=SONATYPE
    const { buildFilterQuery, chunkArray } = require('../services/data-aggregator');
    const sscConfig = require('../config/ssc-config');

    const filterQuery = buildFilterQuery(filters);
    const versions = await sscClient.getWithPagination('/projectVersions', {
      q: filterQuery
    });

    let allDependencyIssues = [];
    const chunks = chunkArray(versions, sscConfig.maxConcurrentRequests);

    for (const chunk of chunks) {
      const promises = chunk.map(async (version) => {
        try {
          const response = await sscClient.get(
            `/projectVersions/${version.id}/dependencyScanIssues`,
            { engineType: 'SONATYPE', limit: 1000 }
          );
          return response.data || [];
        } catch (error) {
          logger.warn('Failed to fetch dependency issues for version', {
            versionId: version.id,
            error: error.message
          });
          return [];
        }
      });

      const results = await Promise.all(promises);
      allDependencyIssues.push(...results.flat());
    }

    // Count unique components and vulnerabilities
    const componentSet = new Set();
    let critical = 0, high = 0;

    allDependencyIssues.forEach(issue => {
      if (issue.componentName) {
        componentSet.add(issue.componentName);
      }

      const severity = issue.severity || 5.0;
      if (severity <= 1.0) critical++;
      else if (severity <= 2.0) high++;
    });

    logger.info('Open source security calculated', {
      components: componentSet.size,
      vulnerabilities: allDependencyIssues.length,
      critical,
      high
    });

    return {
      components: componentSet.size,
      vulnerabilities: allDependencyIssues.length,
      critical,
      high
    };
  } catch (error) {
    logger.error('Error transforming open source security', { error: error.message });
    throw error;
  }
};

/**
 * Transform open source license data
 * @param {object} sscClient - SSC API client
 * @param {object} filters - Filter parameters
 * @returns {Promise<object>} - Transformed license distribution
 */
exports.transformOpenSourceLicenses = async (sscClient, filters) => {
  try {
    logger.info('Fetching open source license data', { filters });

    // Fetch dependency scan issues with license info
    const { buildFilterQuery, chunkArray } = require('../services/data-aggregator');
    const sscConfig = require('../config/ssc-config');

    const filterQuery = buildFilterQuery(filters);
    const versions = await sscClient.getWithPagination('/projectVersions', {
      q: filterQuery
    });

    let allDependencyIssues = [];
    const chunks = chunkArray(versions, sscConfig.maxConcurrentRequests);

    for (const chunk of chunks) {
      const promises = chunk.map(async (version) => {
        try {
          const response = await sscClient.get(
            `/projectVersions/${version.id}/dependencyScanIssues`,
            { engineType: 'SONATYPE', limit: 1000 }
          );
          return response.data || [];
        } catch (error) {
          logger.warn('Failed to fetch dependency issues for version', {
            versionId: version.id,
            error: error.message
          });
          return [];
        }
      });

      const results = await Promise.all(promises);
      allDependencyIssues.push(...results.flat());
    }

    // Classify licenses (simple classification based on common licenses)
    const licenses = {
      permissive: 0,    // MIT, Apache, BSD
      copyleft: 0,      // GPL, LGPL, AGPL
      proprietary: 0,   // Proprietary, Commercial
      unknown: 0        // Unknown or no license
    };

    allDependencyIssues.forEach(issue => {
      const license = (issue.license || '').toLowerCase();

      if (!license || license === 'unknown') {
        licenses.unknown++;
      } else if (license.includes('mit') || license.includes('apache') || license.includes('bsd')) {
        licenses.permissive++;
      } else if (license.includes('gpl') || license.includes('lgpl') || license.includes('agpl')) {
        licenses.copyleft++;
      } else if (license.includes('proprietary') || license.includes('commercial')) {
        licenses.proprietary++;
      } else {
        licenses.unknown++;
      }
    });

    logger.info('Open source licenses calculated', { licenses });

    return licenses;
  } catch (error) {
    logger.error('Error transforming open source licenses', { error: error.message });
    throw error;
  }
};

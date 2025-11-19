/**
 * Program Dashboard Transformer
 *
 * Transforms SSC API data for Program Dashboard endpoints.
 * Phase 3 implementation with real SSC data fetching.
 */

const { buildFilterQuery, calculateYoYDelta } = require('../services/data-aggregator');
const logger = require('../services/logger');

/**
 * Transform KPIs data
 * @param {object} sscClient - SSC API client
 * @param {object} filters - Filter parameters
 * @returns {object} - Transformed KPIs with YoY deltas
 */
exports.transformKPIs = async (sscClient, filters) => {
  try {
    logger.info('Fetching KPIs data', { filters });

    const filterQuery = buildFilterQuery(filters);

    // Fetch all data in parallel
    const [projects, versions, users] = await Promise.all([
      sscClient.getWithPagination('/projects', { q: filterQuery }),
      sscClient.getWithPagination('/projectVersions', { q: filterQuery }),
      sscClient.getWithPagination('/localUsers')
    ]);

    logger.info('KPIs data fetched', {
      projectsCount: projects.length,
      versionsCount: versions.length,
      usersCount: users.length
    });

    // Calculate YoY deltas
    const projectsYoY = calculateYoYDelta(projects, 'createdDate');
    const versionsYoY = calculateYoYDelta(versions, 'creationDate');

    // Check if users have createdDate field (may not exist)
    const usersYoY = users.length > 0 && users[0].createdDate
      ? calculateYoYDelta(users, 'createdDate')
      : null;

    return {
      applications: {
        count: projectsYoY.current,
        yoyDelta: projectsYoY.delta,
        yoyPercentage: Math.round(projectsYoY.percentage * 10) / 10 // Round to 1 decimal
      },
      versions: {
        count: versionsYoY.current,
        yoyDelta: versionsYoY.delta,
        yoyPercentage: Math.round(versionsYoY.percentage * 10) / 10
      },
      users: {
        count: users.length,
        yoyDelta: usersYoY ? usersYoY.delta : null,
        yoyPercentage: usersYoY ? Math.round(usersYoY.percentage * 10) / 10 : null
      }
    };
  } catch (error) {
    logger.error('Error transforming KPIs', { error: error.message });
    throw error;
  }
};

/**
 * Transform scan metrics data
 * @param {object} sscClient - SSC API client
 * @param {object} filters - Filter parameters
 * @returns {object} - Transformed scan metrics
 */
exports.transformScanMetrics = async (sscClient, filters) => {
  try {
    logger.info('Fetching scan metrics data', { filters });

    const { buildFilterQuery, chunkArray } = require('../services/data-aggregator');
    const sscConfig = require('../config/ssc-config');

    const filterQuery = buildFilterQuery(filters);

    // Fetch all versions
    const versions = await sscClient.getWithPagination('/projectVersions', {
      q: filterQuery
    });

    logger.info('Versions fetched for scan metrics', { versionCount: versions.length });

    let totalLOC = 0;
    let totalFiles = 0;
    let versionsWithData = 0;

    // Process versions in parallel chunks (5 concurrent)
    const chunks = chunkArray(versions, sscConfig.maxConcurrentRequests);

    for (const chunk of chunks) {
      const promises = chunk.map(async (version) => {
        try {
          // Fetch artifacts to get scan metrics
          const response = await sscClient.get(`/projectVersions/${version.id}/artifacts`, {
            limit: sscConfig.maxPageSize,
            fields: 'id,status,linesOfCode,filesScanned'
          });

          const artifacts = response.data || [];

          // Sum up metrics from artifacts
          artifacts.forEach(artifact => {
            if (artifact.linesOfCode) {
              totalLOC += artifact.linesOfCode;
              versionsWithData++;
            }
            if (artifact.filesScanned) {
              totalFiles += artifact.filesScanned;
            }
          });

          return { versionId: version.id, artifactCount: artifacts.length };
        } catch (error) {
          logger.warn('Failed to fetch artifacts for version (scan metrics)', {
            versionId: version.id,
            error: error.message
          });
          return { versionId: version.id, artifactCount: 0 };
        }
      });

      await Promise.all(promises);
    }

    logger.info('Scan metrics calculated', {
      linesOfCode: totalLOC,
      filesScanned: totalFiles,
      versionsWithData
    });

    return {
      linesOfCode: totalLOC,
      filesScanned: totalFiles
    };
  } catch (error) {
    logger.error('Error transforming scan metrics', { error: error.message });
    throw error;
  }
};

/**
 * Transform coverage data
 * @param {object} sscClient - SSC API client
 * @param {object} filters - Filter parameters
 * @returns {object} - Transformed coverage percentages
 */
exports.transformCoverage = async (sscClient, filters) => {
  try {
    logger.info('Fetching coverage data', { filters });

    const { buildFilterQuery, chunkArray } = require('../services/data-aggregator');
    const sscConfig = require('../config/ssc-config');

    const filterQuery = buildFilterQuery(filters);

    // Fetch all versions
    const versions = await sscClient.getWithPagination('/projectVersions', {
      q: filterQuery
    });

    logger.info('Versions fetched for coverage', { versionCount: versions.length });

    // Track which versions have which scan types
    const coverage = {
      sast: new Set(),
      dast: new Set(),
      sca: new Set()
    };

    // Process versions in parallel chunks (5 concurrent)
    const chunks = chunkArray(versions, sscConfig.maxConcurrentRequests);

    for (const chunk of chunks) {
      const promises = chunk.map(async (version) => {
        try {
          // Fetch artifacts for this version to determine scan types
          const response = await sscClient.get(`/projectVersions/${version.id}/artifacts`, {
            limit: sscConfig.maxPageSize
          });

          const artifacts = response.data || [];

          // Check for scan types based on artifact data
          artifacts.forEach(artifact => {
            // SAST: SCA artifacts typically have scanType or are FPR files
            if (artifact.artifactType === 'FPR' || artifact.scanType === 'SCA') {
              coverage.sast.add(version.id);
            }

            // DAST: WebInspect artifacts
            if (artifact.artifactType === 'WEBINSPECT' || artifact.scanType === 'DAST') {
              coverage.dast.add(version.id);
            }

            // SCA: Dependency scan artifacts (SonaType, etc.)
            if (artifact.artifactType === 'DEPENDENCY' || artifact.engineType === 'SONATYPE') {
              coverage.sca.add(version.id);
            }
          });

          return { versionId: version.id, artifactCount: artifacts.length };
        } catch (error) {
          logger.warn('Failed to fetch artifacts for version (coverage)', {
            versionId: version.id,
            error: error.message
          });
          return { versionId: version.id, artifactCount: 0 };
        }
      });

      await Promise.all(promises);
    }

    // Calculate percentages
    const totalVersions = versions.length || 1; // Avoid division by zero
    const sastPercentage = Math.round((coverage.sast.size / totalVersions) * 100);
    const dastPercentage = Math.round((coverage.dast.size / totalVersions) * 100);
    const scaPercentage = Math.round((coverage.sca.size / totalVersions) * 100);

    logger.info('Coverage calculated', {
      sast: `${coverage.sast.size}/${totalVersions} (${sastPercentage}%)`,
      dast: `${coverage.dast.size}/${totalVersions} (${dastPercentage}%)`,
      sca: `${coverage.sca.size}/${totalVersions} (${scaPercentage}%)`
    });

    return {
      sast: sastPercentage,
      dast: dastPercentage,
      sca: scaPercentage
    };
  } catch (error) {
    logger.error('Error transforming coverage', { error: error.message });
    throw error;
  }
};

/**
 * Transform scan activity data
 * @param {object} sscClient - SSC API client
 * @param {object} filters - Filter parameters
 * @returns {object} - Transformed scan activity
 */
exports.transformScanActivity = async (sscClient, filters) => {
  try {
    logger.info('Fetching scan activity data', { filters });

    const { buildFilterQuery, chunkArray } = require('../services/data-aggregator');
    const sscConfig = require('../config/ssc-config');

    const filterQuery = buildFilterQuery(filters);

    // Fetch all versions
    const versions = await sscClient.getWithPagination('/projectVersions', {
      q: filterQuery
    });

    logger.info('Versions fetched for scan activity', { versionCount: versions.length });

    // Calculate time thresholds
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let lastDay = 0;
    let lastWeek = 0;
    let lastMonth = 0;

    // Process versions in parallel chunks (5 concurrent)
    const chunks = chunkArray(versions, sscConfig.maxConcurrentRequests);

    for (const chunk of chunks) {
      const promises = chunk.map(async (version) => {
        try {
          // Fetch artifacts to check upload dates
          const response = await sscClient.get(`/projectVersions/${version.id}/artifacts`, {
            limit: sscConfig.maxPageSize,
            fields: 'id,uploadDate,status'
          });

          const artifacts = response.data || [];

          // Count artifacts uploaded in each time period
          artifacts.forEach(artifact => {
            if (!artifact.uploadDate) return;

            const uploadDate = new Date(artifact.uploadDate);

            if (uploadDate >= oneDayAgo) {
              lastDay++;
            }

            if (uploadDate >= oneWeekAgo) {
              lastWeek++;
            }

            if (uploadDate >= oneMonthAgo) {
              lastMonth++;
            }
          });

          return { versionId: version.id, artifactCount: artifacts.length };
        } catch (error) {
          logger.warn('Failed to fetch artifacts for version (scan activity)', {
            versionId: version.id,
            error: error.message
          });
          return { versionId: version.id, artifactCount: 0 };
        }
      });

      await Promise.all(promises);
    }

    logger.info('Scan activity calculated', {
      lastDay,
      lastWeek,
      lastMonth
    });

    return {
      lastDay,
      lastWeek,
      lastMonth
    };
  } catch (error) {
    logger.error('Error transforming scan activity', { error: error.message });
    throw error;
  }
};

/**
 * Transform technology stack data
 * @param {object} sscClient - SSC API client
 * @param {object} filters - Filter parameters
 * @returns {Array} - Technology distribution
 */
exports.transformTechnologyStack = async (sscClient, filters) => {
  try {
    logger.info('Fetching technology stack data', { filters });

    const { buildFilterQuery } = require('../services/data-aggregator');

    const filterQuery = buildFilterQuery(filters);

    // Fetch all project versions with development phase and attributes
    const versions = await sscClient.getWithPagination('/projectVersions', {
      q: filterQuery,
      fields: 'id,name,project,developmentPhase,customTagValues'
    });

    logger.info('Versions fetched for technology stack', { versionCount: versions.length });

    // Track technology distribution
    const techCount = {};

    versions.forEach(version => {
      // Try to determine technology from development phase or custom tags
      let technology = 'Unknown';

      // Check development phase (may contain language info)
      if (version.developmentPhase) {
        const phase = version.developmentPhase.toLowerCase();

        // Common language patterns in development phase
        if (phase.includes('java')) technology = 'Java';
        else if (phase.includes('python')) technology = 'Python';
        else if (phase.includes('javascript') || phase.includes('node')) technology = 'JavaScript';
        else if (phase.includes('c#') || phase.includes('csharp') || phase.includes('.net')) technology = 'C#';
        else if (phase.includes('c++') || phase.includes('cpp')) technology = 'C++';
        else if (phase.includes('ruby')) technology = 'Ruby';
        else if (phase.includes('go') || phase.includes('golang')) technology = 'Go';
        else if (phase.includes('php')) technology = 'PHP';
      }

      // Increment count
      techCount[technology] = (techCount[technology] || 0) + 1;
    });

    // Convert to array format and sort by count (descending)
    const techArray = Object.entries(techCount)
      .map(([technology, count]) => ({
        technology,
        count,
        percentage: Math.round((count / versions.length) * 100)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 technologies

    logger.info('Technology stack calculated', {
      totalVersions: versions.length,
      uniqueTechnologies: Object.keys(techCount).length,
      topTechnology: techArray[0]?.technology || 'None'
    });

    return techArray;
  } catch (error) {
    logger.error('Error transforming technology stack', { error: error.message });
    throw error;
  }
};

/**
 * Transform ScanCentral data
 * @param {object} sscClient - SSC API client
 * @param {object} filters - Filter parameters
 * @returns {object} - Transformed ScanCentral metrics
 */
exports.transformScanCentral = async (sscClient, filters) => {
  try {
    logger.info('Fetching ScanCentral data');

    // Fetch cloud pools
    const pools = await sscClient.getWithPagination('/cloudpools');

    // Fetch workers for all pools in parallel
    const workerPromises = pools.map(pool =>
      sscClient.getWithPagination(`/cloudpools/${pool.uuid}/workers`)
        .catch(err => {
          logger.warn('Error fetching workers for pool', { poolUuid: pool.uuid, error: err.message });
          return []; // Return empty array if pool has no workers or error
        })
    );

    const workerArrays = await Promise.all(workerPromises);
    const allWorkers = workerArrays.flat();

    // Calculate utilization (workers with state 'PROCESSING')
    const activeWorkers = allWorkers.filter(w => w.state === 'PROCESSING').length;
    const utilization = allWorkers.length > 0
      ? Math.round((activeWorkers / allWorkers.length) * 100)
      : 0;

    logger.info('ScanCentral data fetched', {
      poolsCount: pools.length,
      workersCount: allWorkers.length,
      activeWorkers,
      utilization
    });

    return {
      pools: pools.length,
      workers: allWorkers.length,
      utilization
    };
  } catch (error) {
    logger.error('Error transforming ScanCentral', { error: error.message });
    // Return zeros if ScanCentral is not available
    return {
      pools: 0,
      workers: 0,
      utilization: 0
    };
  }
};

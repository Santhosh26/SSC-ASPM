/**
 * Program Dashboard Routes
 *
 * 6 endpoints for Program Dashboard metrics.
 * Phase 3 implementation with real SSC data fetching.
 */

const express = require('express');
const router = express.Router();
const cache = require('../services/cache-manager');
const transformer = require('../transformers/program-transformer');
const sscClient = require('../services/ssc-client');

/**
 * GET /api/program/kpis
 * Returns: Applications, Versions, Users counts with YoY deltas
 */
router.get('/kpis', async (req, res, next) => {
  try {
    const cacheKey = cache.generateKey('program_kpis', req.query);
    const cached = cache.get(cacheKey);

    if (cached) {
      return res.json({
        data: cached.data,
        stale: false,
        lastUpdated: new Date(cached.timestamp).toISOString(),
        cacheHit: true,
        filters: req.query
      });
    }

    // Fetch real data from SSC
    const data = await transformer.transformKPIs(sscClient, req.query);

    cache.set(cacheKey, data, cache.getTTLForType('kpis'));

    res.json({
      data,
      stale: false,
      lastUpdated: new Date().toISOString(),
      cacheHit: false,
      filters: req.query
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/program/scan-metrics
 * Returns: Lines of code, files scanned
 */
router.get('/scan-metrics', async (req, res, next) => {
  try {
    const cacheKey = cache.generateKey('program_scan_metrics', req.query);
    const cached = cache.get(cacheKey);

    if (cached) {
      return res.json({
        data: cached.data,
        stale: false,
        lastUpdated: new Date(cached.timestamp).toISOString(),
        cacheHit: true,
        filters: req.query
      });
    }

    // Fetch real data from SSC (expensive operation - 278 versions)
    const data = await transformer.transformScanMetrics(sscClient, req.query);

    cache.set(cacheKey, data, cache.getTTLForType('kpis'));

    res.json({
      data,
      stale: false,
      lastUpdated: new Date().toISOString(),
      cacheHit: false,
      filters: req.query
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/program/coverage
 * Returns: SAST/DAST/SCA coverage percentages
 */
router.get('/coverage', async (req, res, next) => {
  try {
    const cacheKey = cache.generateKey('program_coverage', req.query);
    const cached = cache.get(cacheKey);

    if (cached) {
      return res.json({
        data: cached.data,
        stale: false,
        lastUpdated: new Date(cached.timestamp).toISOString(),
        cacheHit: true,
        filters: req.query
      });
    }

    // Fetch real data from SSC (expensive operation - 278 versions)
    const data = await transformer.transformCoverage(sscClient, req.query);

    cache.set(cacheKey, data, cache.getTTLForType('expensive'));

    res.json({
      data,
      stale: false,
      lastUpdated: new Date().toISOString(),
      cacheHit: false,
      filters: req.query
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/program/scan-activity
 * Returns: Scan activity (last day/week/month)
 */
router.get('/scan-activity', async (req, res, next) => {
  try {
    const cacheKey = cache.generateKey('program_scan_activity', req.query);
    const cached = cache.get(cacheKey);

    if (cached) {
      return res.json({
        data: cached.data,
        stale: false,
        lastUpdated: new Date(cached.timestamp).toISOString(),
        cacheHit: true,
        filters: req.query
      });
    }

    // Fetch real data from SSC (expensive operation - 278 versions)
    const data = await transformer.transformScanActivity(sscClient, req.query);

    cache.set(cacheKey, data, cache.getTTLForType('trends'));

    res.json({
      data,
      stale: false,
      lastUpdated: new Date().toISOString(),
      cacheHit: false,
      filters: req.query
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/program/technology-stack
 * Returns: Application distribution by language
 */
router.get('/technology-stack', async (req, res, next) => {
  try {
    const cacheKey = cache.generateKey('program_tech_stack', req.query);
    const cached = cache.get(cacheKey);

    if (cached) {
      return res.json({
        data: cached.data,
        stale: false,
        lastUpdated: new Date(cached.timestamp).toISOString(),
        cacheHit: true,
        filters: req.query
      });
    }

    // Fetch real data from SSC
    const data = await transformer.transformTechnologyStack(sscClient, req.query);

    cache.set(cacheKey, data, cache.getTTLForType('expensive'));

    res.json({
      data,
      stale: false,
      lastUpdated: new Date().toISOString(),
      cacheHit: false,
      filters: req.query
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/program/scancentral
 * Returns: ScanCentral pools, workers, utilization
 */
router.get('/scancentral', async (req, res, next) => {
  try {
    const cacheKey = cache.generateKey('program_scancentral', req.query);
    const cached = cache.get(cacheKey);

    if (cached) {
      return res.json({
        data: cached.data,
        stale: false,
        lastUpdated: new Date(cached.timestamp).toISOString(),
        cacheHit: true,
        filters: req.query
      });
    }

    // Fetch real data from SSC
    const data = await transformer.transformScanCentral(sscClient, req.query);

    cache.set(cacheKey, data, cache.getTTLForType('kpis'));

    res.json({
      data,
      stale: false,
      lastUpdated: new Date().toISOString(),
      cacheHit: false,
      filters: req.query
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

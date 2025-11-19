/**
 * Risk Exposure Dashboard Routes
 *
 * 9 endpoints for Risk Dashboard metrics.
 * Phase 3 implementation with real SSC data fetching.
 */

const express = require('express');
const router = express.Router();
const cache = require('../services/cache-manager');
const transformer = require('../transformers/risk-transformer');
const sscClient = require('../services/ssc-client');

/**
 * GET /api/risk/compliance
 * Returns: Policy compliance (Pass/Fail/Unassessed)
 */
router.get('/compliance', async (req, res, next) => {
  try {
    const cacheKey = cache.generateKey('risk_compliance', req.query);
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
    const data = await transformer.transformCompliance(sscClient, req.query);
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
 * GET /api/risk/star-ratings
 * Returns: Star ratings distribution (1-5 stars)
 */
router.get('/star-ratings', async (req, res, next) => {
  try {
    const cacheKey = cache.generateKey('risk_star_ratings', req.query);
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
    const data = await transformer.transformStarRatings(sscClient, req.query);
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
 * GET /api/risk/open-issues
 * Returns: Open issues by severity
 */
router.get('/open-issues', async (req, res, next) => {
  try {
    const cacheKey = cache.generateKey('risk_open_issues', req.query);
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
    const data = await transformer.transformOpenIssues(sscClient, req.query);
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
 * GET /api/risk/density
 * Returns: Vulnerability density (issues per KLOC)
 */
router.get('/density', async (req, res, next) => {
  try {
    const cacheKey = cache.generateKey('risk_density', req.query);
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

    // Fetch real data from SSC (expensive operation - 279 versions)
    const data = await transformer.transformDensity(sscClient, req.query);
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
 * GET /api/risk/detection-trend
 * Returns: Issue detection trend
 */
router.get('/detection-trend', async (req, res, next) => {
  try {
    const cacheKey = cache.generateKey('risk_detection_trend', req.query);
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
    const data = await transformer.transformDetectionTrend(sscClient, req.query);
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
 * GET /api/risk/prevalent
 * Returns: Most prevalent vulnerability types
 */
router.get('/prevalent', async (req, res, next) => {
  try {
    const cacheKey = cache.generateKey('risk_prevalent', req.query);
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

    // Fetch real data from SSC (expensive operation - 279 versions)
    const data = await transformer.transformPrevalent(sscClient, req.query);
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
 * GET /api/risk/aging-matrix
 * Returns: Issue aging distribution
 */
router.get('/aging-matrix', async (req, res, next) => {
  try {
    const cacheKey = cache.generateKey('risk_aging_matrix', req.query);
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

    // Fetch real data from SSC (expensive operation - 279 versions)
    const data = await transformer.transformAgingMatrix(sscClient, req.query);
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
 * GET /api/risk/opensource-security
 * Returns: Open source component security metrics
 */
router.get('/opensource-security', async (req, res, next) => {
  try {
    const cacheKey = cache.generateKey('risk_opensource_security', req.query);
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

    // Fetch real data from SSC (expensive operation - 279 versions)
    const data = await transformer.transformOpenSourceSecurity(sscClient, req.query);
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
 * GET /api/risk/opensource-licenses
 * Returns: Open source license distribution
 */
router.get('/opensource-licenses', async (req, res, next) => {
  try {
    const cacheKey = cache.generateKey('risk_opensource_licenses', req.query);
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

    // Fetch real data from SSC (expensive operation - 279 versions)
    const data = await transformer.transformOpenSourceLicenses(sscClient, req.query);
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

module.exports = router;

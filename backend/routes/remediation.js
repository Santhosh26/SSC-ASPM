/**
 * Remediation Dashboard Routes
 *
 * 6 endpoints for Remediation Dashboard metrics (5 remaining after removing SAST Aviator).
 * STUB IMPLEMENTATIONS - Will be filled in Phase 3.
 */

const express = require('express');
const router = express.Router();
const cache = require('../services/cache-manager');
const transformer = require('../transformers/remediation-transformer');
const sscClient = require('../services/ssc-client');

/**
 * GET /api/remediation/rates
 * Returns: Remediation rates (last week/month/quarter)
 */
router.get('/rates', async (req, res, next) => {
  try {
    const cacheKey = cache.generateKey('remediation_rates', req.query);
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
    const data = await transformer.transformRemediationRates(sscClient, req.query);
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
 * GET /api/remediation/mttr
 * Returns: Mean Time To Remediate by severity
 */
router.get('/mttr', async (req, res, next) => {
  try {
    const cacheKey = cache.generateKey('remediation_mttr', req.query);
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
    const data = await transformer.transformMTTR(sscClient, req.query);
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
 * GET /api/remediation/trend
 * Returns: Remediation trend (this month vs last month)
 */
router.get('/trend', async (req, res, next) => {
  try {
    const cacheKey = cache.generateKey('remediation_trend', req.query);
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
    const data = await transformer.transformRemediationTrend(sscClient, req.query);
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
 * GET /api/remediation/review-metrics
 * Returns: Review metrics (reviewed/unreviewed, mean time to review)
 */
router.get('/review-metrics', async (req, res, next) => {
  try {
    const cacheKey = cache.generateKey('remediation_review_metrics', req.query);
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
    const data = await transformer.transformReviewMetrics(sscClient, req.query);
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
 * GET /api/remediation/recurrence
 * Returns: Issue recurrence metrics
 */
router.get('/recurrence', async (req, res, next) => {
  try {
    const cacheKey = cache.generateKey('remediation_recurrence', req.query);
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
    const data = await transformer.transformRecurrence(sscClient, req.query);
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

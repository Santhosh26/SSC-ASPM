/**
 * Filter Metadata Routes
 *
 * 1 endpoint for filter options.
 * STUB IMPLEMENTATION - Will be filled in Phase 3.
 */

const express = require('express');
const router = express.Router();
const cache = require('../services/cache-manager');
const sscClient = require('../services/ssc-client');
const logger = require('../services/logger');

/**
 * GET /api/filters/metadata
 * Returns: Available filter options from SSC custom attributes
 */
router.get('/metadata', async (req, res, next) => {
  try {
    const cacheKey = 'filters_metadata';
    const cached = cache.get(cacheKey);

    if (cached) {
      return res.json({
        data: cached.data,
        stale: false,
        lastUpdated: new Date(cached.timestamp).toISOString(),
        cacheHit: true
      });
    }

    // STUB - Phase 3 will implement actual SSC custom attribute fetching
    // Should fetch from: GET /api/v1/attributeDefinitions
    const data = {
      businessUnit: [
        'Content',
        'ITOM',
        'Cybersecurity',
        'ADM',
        'Business Networks',
        'Portfolio'
      ],
      businessCriticality: [
        'High',
        'Medium',
        'Low'
      ],
      applicationType: [
        'Mobile',
        'Web',
        'API',
        'Thick Client'
      ],
      sdlcStatus: [
        'Development',
        'QA/Test',
        'Production'
      ]
    };

    // Cache metadata for 1 hour (changes infrequently)
    cache.set(cacheKey, data, cache.getTTLForType('metadata'));

    res.json({
      data,
      stale: false,
      lastUpdated: new Date().toISOString(),
      cacheHit: false
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

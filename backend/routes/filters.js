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

    logger.info('Fetching filter metadata from SSC');

    // Fetch attribute definitions from SSC
    const attributeDefinitions = await sscClient.getWithPagination('/attributeDefinitions');

    // Find custom attributes we need
    const businessUnitAttr = attributeDefinitions.find(attr => attr.name === 'Business Unit');
    const criticalityAttr = attributeDefinitions.find(attr => attr.name === 'Business Criticality');
    const appTypeAttr = attributeDefinitions.find(attr => attr.name === 'Application Type');
    const sdlcAttr = attributeDefinitions.find(attr => attr.name === 'SDLC Status');

    // Extract options (values) from each attribute
    const data = {
      businessUnit: businessUnitAttr?.options?.map(opt => opt.name) || [
        'Content', 'ITOM', 'Cybersecurity', 'ADM', 'Business Networks', 'Portfolio'
      ],
      businessCriticality: criticalityAttr?.options?.map(opt => opt.name) || [
        'High', 'Medium', 'Low'
      ],
      applicationType: appTypeAttr?.options?.map(opt => opt.name) || [
        'Mobile', 'Web', 'API', 'Thick Client'
      ],
      sdlcStatus: sdlcAttr?.options?.map(opt => opt.name) || [
        'Development', 'QA/Test', 'Production'
      ]
    };

    logger.info('Filter metadata fetched', {
      businessUnitOptions: data.businessUnit.length,
      criticalityOptions: data.businessCriticality.length,
      appTypeOptions: data.applicationType.length,
      sdlcOptions: data.sdlcStatus.length
    });

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

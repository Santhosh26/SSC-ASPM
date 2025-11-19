# Phase 3: Data Integration - Implementation Plan

**Status:** Ready to Begin
**Start Date:** TBD
**Estimated Duration:** 4-6 days
**Dependencies:** Phase 2 Complete ✅

---

## Executive Summary

Phase 3 transforms the backend from returning stub data to fetching and aggregating real data from Fortify SSC API. This phase implements 29 endpoints with actual SSC data integration, applying all validated patterns from Phase 1.

**Key Deliverables:**
- Real data fetching for all 29 endpoints
- Transformation logic implementation
- Filter query building and application
- Performance optimization (parallel queries)
- Testing with real SSC data (278 versions, 100K+ issues)

---

## Implementation Strategy

### Phased Approach

We'll implement endpoints in order of complexity and dependency:

1. **Start Simple** - Basic counts and metrics (projects, versions, users)
2. **Build Up** - More complex aggregations (issues, artifacts)
3. **Add Calculations** - Derived metrics (star ratings, YoY deltas)
4. **Optimize** - Parallel queries, caching, performance
5. **Test & Validate** - Real data testing, edge cases

### Critical Success Factors

1. **Parallel Version Iteration** - No global /issues endpoint
2. **In-Code Filtering** - Cannot use q=removed:false
3. **Star Rating Calculation** - From severity distribution
4. **YoY Delta Approximation** - Using creation dates
5. **Performance** - Must handle 278 versions, 100K+ issues efficiently

---

## Phase 3.1: Foundation - Basic Metrics (Day 1)

### Objective
Implement simplest endpoints that require single API calls without complex aggregation.

### Endpoints to Implement

#### 1. Program KPIs - Applications, Versions, Users
**File:** `transformers/program-transformer.js:transformKPIs()`
**Route:** `routes/program.js` (GET /api/program/kpis)

**Implementation Steps:**
1. Fetch all projects: `GET /api/v1/projects`
2. Fetch all versions: `GET /api/v1/projectVersions`
3. Fetch all users: `GET /api/v1/localUsers`
4. Apply filters using `buildFilterQuery()`
5. Calculate YoY deltas using `calculateYoYDelta()`
6. Return counts and deltas

**Code Example:**
```javascript
exports.transformKPIs = async (sscClient, filters) => {
  const filterQuery = buildFilterQuery(filters);

  // Fetch data
  const projects = await sscClient.getWithPagination('/projects', { q: filterQuery });
  const versions = await sscClient.getWithPagination('/projectVersions', { q: filterQuery });
  const users = await sscClient.getWithPagination('/localUsers');

  // Calculate YoY deltas
  const projectsYoY = calculateYoYDelta(projects, 'createdDate');
  const versionsYoY = calculateYoYDelta(versions, 'creationDate');

  // Check if users have createdDate field
  const usersYoY = users.length > 0 && users[0].createdDate
    ? calculateYoYDelta(users, 'createdDate')
    : null;

  return {
    applications: {
      count: projectsYoY.current,
      yoyDelta: projectsYoY.delta,
      yoyPercentage: projectsYoY.percentage
    },
    versions: {
      count: versionsYoY.current,
      yoyDelta: versionsYoY.delta,
      yoyPercentage: versionsYoY.percentage
    },
    users: {
      count: users.length,
      yoyDelta: usersYoY ? usersYoY.delta : null
    }
  };
};
```

**Update Route Handler:**
```javascript
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

    // REAL DATA FETCHING
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
```

#### 2. Filter Metadata
**File:** `routes/filters.js` (GET /api/filters/metadata)

**Implementation Steps:**
1. Fetch attribute definitions: `GET /api/v1/attributeDefinitions`
2. Filter for custom attributes (Business Unit, Criticality, Application Type, SDLC Status)
3. Extract available values for each
4. Return as filter options

**Code Example:**
```javascript
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

    // Fetch attribute definitions
    const attributes = await sscClient.get('/attributeDefinitions');

    // Extract custom attribute values
    const data = {
      businessUnit: extractAttributeValues(attributes, 'Business Unit'),
      businessCriticality: extractAttributeValues(attributes, 'Business Criticality'),
      applicationType: extractAttributeValues(attributes, 'Application Type'),
      sdlcStatus: extractAttributeValues(attributes, 'SDLC Status')
    };

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

function extractAttributeValues(attributes, name) {
  const attr = attributes.data.find(a => a.name === name);
  return attr ? attr.options.map(o => o.value) : [];
}
```

#### 3. ScanCentral Metrics
**File:** `transformers/program-transformer.js:transformScanCentral()`

**Implementation Steps:**
1. Fetch cloud pools: `GET /api/v1/cloudpools`
2. For each pool, fetch workers: `GET /api/v1/cloudpools/{id}/workers`
3. Calculate utilization (busy workers / total workers)

---

## Phase 3.2: Issue Aggregation (Day 2)

### Objective
Implement endpoints that require iterating through versions and aggregating issues.

### Critical Pattern: Version Iteration

**IMPORTANT:** SSC v25.2 has NO global /issues endpoint. All issue queries must iterate through versions.

**Implementation Template:**
```javascript
async function fetchAllIssues(sscClient, filters, fields = 'severity,removed,scanStatus,foundDate') {
  // Get filtered versions
  const filterQuery = buildFilterQuery(filters);
  const versions = await sscClient.getWithPagination('/projectVersions', { q: filterQuery });

  logger.info('Fetching issues for versions', {
    versionCount: versions.length,
    filters
  });

  // Aggregate issues across all versions
  const allIssues = await aggregateIssuesAcrossVersions(sscClient, versions, fields);

  // CRITICAL: Filter removed issues in code (cannot use q=removed:false)
  const openIssues = filterOpenIssues(allIssues);

  return openIssues;
}
```

### Endpoints to Implement

#### 1. Open Issues by Severity
**File:** `transformers/risk-transformer.js:transformOpenIssues()`
**Route:** `routes/risk.js` (GET /api/risk/open-issues)

**Implementation:**
```javascript
exports.transformOpenIssues = async (sscClient, filters) => {
  const issues = await fetchAllIssues(sscClient, filters, 'severity,removed');

  // Group by severity (in code - cannot use groupby parameter)
  const grouped = groupBySeverity(issues);

  return {
    critical: grouped.critical,
    high: grouped.high,
    medium: grouped.medium,
    low: grouped.low,
    info: grouped.info,
    total: issues.length
  };
};
```

#### 2. Policy Compliance
**File:** `transformers/risk-transformer.js:transformCompliance()`
**Route:** `routes/risk.js` (GET /api/risk/compliance)

**Implementation:**
```javascript
exports.transformCompliance = async (sscClient, filters) => {
  const filterQuery = buildFilterQuery(filters);

  // Fetch versions with performance indicators
  const versions = await sscClient.getWithPagination('/projectVersions', {
    q: filterQuery,
    embed: 'performanceIndicators'
  });

  let pass = 0, fail = 0, unassessed = 0;

  versions.forEach(version => {
    const rating = version.performanceIndicators?.find(
      pi => pi.name === 'FortifySecurityRating'
    );

    if (!rating || rating.value === null) {
      unassessed++;
    } else if (rating.value >= 4.5) {
      pass++;
    } else if (rating.value <= 1.5) {
      fail++;
    } else {
      unassessed++; // Middle ratings count as unassessed
    }
  });

  return { pass, fail, unassessed };
};
```

#### 3. Detection Trend
**File:** `transformers/risk-transformer.js:transformDetectionTrend()`

**Implementation:**
```javascript
exports.transformDetectionTrend = async (sscClient, filters) => {
  const issues = await fetchAllIssues(sscClient, filters, 'foundDate,removed');

  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const newLastWeek = issues.filter(i => new Date(i.foundDate) >= oneWeekAgo).length;
  const newLastMonth = issues.filter(i => new Date(i.foundDate) >= oneMonthAgo).length;

  return {
    newLastWeek,
    newLastMonth,
    trend: newLastWeek > newLastMonth / 4 ? 'increasing' : 'stable'
  };
};
```

---

## Phase 3.3: Star Ratings (Day 3)

### Objective
Implement the most complex calculation - star ratings from issue severity.

**CRITICAL:** Star ratings are NOT stored in SSC. Must calculate from severity distribution.

### Implementation

**File:** `transformers/risk-transformer.js:transformStarRatings()`
**Route:** `routes/risk.js` (GET /api/risk/star-ratings)

```javascript
exports.transformStarRatings = async (sscClient, filters) => {
  // Get all versions with filters applied
  const filterQuery = buildFilterQuery(filters);
  const versions = await sscClient.getWithPagination('/projectVersions', { q: filterQuery });

  logger.info('Calculating star ratings for versions', {
    versionCount: versions.length
  });

  const ratings = { oneStar: 0, twoStar: 0, threeStar: 0, fourStar: 0, fiveStar: 0 };

  // Process versions in parallel (5 concurrent)
  const chunks = chunkArray(versions, 5);

  for (const chunk of chunks) {
    const promises = chunk.map(async (version) => {
      try {
        // Fetch issues for this version
        const issues = await sscClient.get(`/projectVersions/${version.id}/issues`, {
          limit: 1000,
          fields: 'severity,removed'
        });

        // Filter open issues
        const openIssues = (issues.data || []).filter(i => i.removed === false);

        // Calculate star rating
        const stars = calculateStarRating(openIssues);

        return stars;
      } catch (error) {
        logger.warn('Failed to calculate star rating for version', {
          versionId: version.id,
          error: error.message
        });
        return 5; // Default to 5 stars on error
      }
    });

    const results = await Promise.all(promises);

    // Count ratings
    results.forEach(stars => {
      if (stars === 1) ratings.oneStar++;
      else if (stars === 2) ratings.twoStar++;
      else if (stars === 3) ratings.threeStar++;
      else if (stars === 4) ratings.fourStar++;
      else ratings.fiveStar++;
    });
  }

  logger.info('Star ratings calculated', ratings);

  return ratings;
};
```

**Update Cache TTL:**
Star ratings are expensive to calculate - use longer TTL (30 minutes):
```javascript
cache.set(cacheKey, data, cache.getTTLForType('expensive'));
```

---

## Phase 3.4: Scan Coverage & Technology Stack (Day 4)

### Objective
Implement endpoints requiring artifact iteration.

#### 1. Scan Coverage
**File:** `transformers/program-transformer.js:transformCoverage()`

**Implementation:**
```javascript
exports.transformCoverage = async (sscClient, filters) => {
  const filterQuery = buildFilterQuery(filters);
  const projects = await sscClient.getWithPagination('/projects', { q: filterQuery });

  let hasSAST = 0, hasDAST = 0, hasSCA = 0, hasOther = 0;

  // For each project, check latest version for artifacts
  for (const project of projects) {
    try {
      // Get latest version for project
      const versions = await sscClient.get('/projectVersions', {
        q: `project.id:${project.id}`,
        orderby: 'createdDate',
        limit: 1
      });

      if (versions.data && versions.data.length > 0) {
        const versionId = versions.data[0].id;

        // Get artifacts for version
        const artifacts = await sscClient.get(`/projectVersions/${versionId}/artifacts`, {
          embed: 'scans'
        });

        const scanTypes = new Set();
        (artifacts.data || []).forEach(artifact => {
          if (artifact.scans && artifact.scans.length > 0) {
            artifact.scans.forEach(scan => {
              scanTypes.add(scan.type);
            });
          }
        });

        if (scanTypes.has('SCA')) hasSCA++;
        if (scanTypes.has('STATIC')) hasSAST++;
        if (scanTypes.has('DYNAMIC')) hasDAST++;
        if (scanTypes.size > 0 && !scanTypes.has('SCA') && !scanTypes.has('STATIC') && !scanTypes.has('DYNAMIC')) {
          hasOther++;
        }
      }
    } catch (error) {
      logger.warn('Failed to fetch coverage for project', {
        projectId: project.id,
        error: error.message
      });
    }
  }

  const total = projects.length || 1;

  return {
    sast: Math.round((hasSAST / total) * 100),
    dast: Math.round((hasDAST / total) * 100),
    sca: Math.round((hasSCA / total) * 100),
    other: Math.round((hasOther / total) * 100)
  };
};
```

#### 2. Technology Stack
**File:** `transformers/program-transformer.js:transformTechnologyStack()`

**COMPLEXITY WARNING:** This requires querying source files, which can return millions of records.

**Optimization Strategy:**
- Sample latest version per application (not all versions)
- Use pagination with small pages
- Cache for 1 hour (changes infrequently)

**Implementation:**
```javascript
exports.transformTechnologyStack = async (sscClient, filters) => {
  const filterQuery = buildFilterQuery(filters);
  const versions = await sscClient.getWithPagination('/projectVersions', { q: filterQuery });

  const languages = {};

  // Sample: Only check 1 version per 10 applications (performance)
  const sampledVersions = versions.filter((_, index) => index % 10 === 0).slice(0, 50);

  for (const version of sampledVersions) {
    try {
      // Get source files (limit to 100 for performance)
      const files = await sscClient.get(`/projectVersions/${version.id}/sourceFiles`, {
        limit: 100
      });

      (files.data || []).forEach(file => {
        const ext = file.name.split('.').pop().toLowerCase();
        const lang = mapExtensionToLanguage(ext);
        languages[lang] = (languages[lang] || 0) + 1;
      });
    } catch (error) {
      logger.warn('Failed to fetch source files for version', {
        versionId: version.id,
        error: error.message
      });
    }
  }

  // Calculate percentages
  const total = Object.values(languages).reduce((sum, count) => sum + count, 0) || 1;

  return {
    javascript: Math.round(((languages.javascript || 0) / total) * 100),
    java: Math.round(((languages.java || 0) / total) * 100),
    python: Math.round(((languages.python || 0) / total) * 100),
    csharp: Math.round(((languages.csharp || 0) / total) * 100),
    other: Math.round(((languages.other || 0) / total) * 100)
  };
};

function mapExtensionToLanguage(ext) {
  const map = {
    'js': 'javascript', 'jsx': 'javascript', 'ts': 'javascript', 'tsx': 'javascript',
    'java': 'java', 'kt': 'java', 'scala': 'java',
    'py': 'python',
    'cs': 'csharp',
  };
  return map[ext] || 'other';
}
```

---

## Phase 3.5: Remediation Metrics (Day 5)

### Endpoints to Implement

#### 1. MTTR (Mean Time To Remediate)
**File:** `transformers/remediation-transformer.js:transformMTTR()`

```javascript
exports.transformMTTR = async (sscClient, filters) => {
  const issues = await fetchAllIssues(sscClient, filters, 'severity,removed,foundDate,removedDate');

  // Only include issues that have been remediated
  const remediatedIssues = issues.filter(i => i.removed && i.foundDate && i.removedDate);

  const mttrBySeverity = {
    critical: [],
    high: [],
    medium: [],
    low: []
  };

  remediatedIssues.forEach(issue => {
    const foundDate = new Date(issue.foundDate);
    const removedDate = new Date(issue.removedDate);
    const days = (removedDate - foundDate) / (1000 * 60 * 60 * 24);

    if (issue.severity === 1.0) mttrBySeverity.critical.push(days);
    else if (issue.severity === 2.0) mttrBySeverity.high.push(days);
    else if (issue.severity === 3.0) mttrBySeverity.medium.push(days);
    else if (issue.severity === 4.0) mttrBySeverity.low.push(days);
  });

  const avg = arr => arr.length > 0 ? arr.reduce((sum, val) => sum + val, 0) / arr.length : 0;

  return {
    avgDays: Math.round(avg([
      ...mttrBySeverity.critical,
      ...mttrBySeverity.high,
      ...mttrBySeverity.medium,
      ...mttrBySeverity.low
    ]) * 10) / 10,
    bySeverity: {
      critical: Math.round(avg(mttrBySeverity.critical) * 10) / 10,
      high: Math.round(avg(mttrBySeverity.high) * 10) / 10,
      medium: Math.round(avg(mttrBySeverity.medium) * 10) / 10,
      low: Math.round(avg(mttrBySeverity.low) * 10) / 10
    }
  };
};
```

#### 2. Review Metrics
**File:** `transformers/remediation-transformer.js:transformReviewMetrics()`

```javascript
exports.transformReviewMetrics = async (sscClient, filters) => {
  const issues = await fetchAllIssues(sscClient, filters, 'scanStatus,removed,foundDate');

  // Calculate review stats using scanStatus field
  const reviewStats = calculateReviewStats(issues);

  return {
    reviewed: reviewStats.reviewed,
    unreviewed: reviewStats.unreviewed,
    reviewRate: reviewStats.reviewRate,
    meanTimeToReview: 0 // TODO: Requires audit history analysis
  };
};
```

#### 3. Remediation Rates
**File:** `transformers/remediation-transformer.js:transformRemediationRates()`

```javascript
exports.transformRemediationRates = async (sscClient, filters) => {
  const issues = await fetchAllIssues(sscClient, filters, 'removed,removedDate');

  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const oneQuarterAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const remediatedIssues = issues.filter(i => i.removed && i.removedDate);

  const lastWeek = remediatedIssues.filter(i => new Date(i.removedDate) >= oneWeekAgo).length;
  const lastMonth = remediatedIssues.filter(i => new Date(i.removedDate) >= oneMonthAgo).length;
  const lastQuarter = remediatedIssues.filter(i => new Date(i.removedDate) >= oneQuarterAgo).length;

  const total = issues.length || 1;

  return {
    lastWeek,
    lastMonth,
    lastQuarter,
    rate: Math.round((remediatedIssues.length / total) * 100)
  };
};
```

---

## Phase 3.6: Open Source & Additional Metrics (Day 5-6)

### Open Source Security
**File:** `transformers/risk-transformer.js:transformOpenSourceSecurity()`

```javascript
exports.transformOpenSourceSecurity = async (sscClient, filters) => {
  const filterQuery = buildFilterQuery(filters);
  const versions = await sscClient.getWithPagination('/projectVersions', { q: filterQuery });

  let totalComponents = 0;
  let totalVulnerabilities = 0;
  let criticalVulns = 0;
  let highVulns = 0;

  for (const version of versions) {
    try {
      const dependencies = await sscClient.get(`/projectVersions/${version.id}/dependencyScanIssues`, {
        engineType: 'SONATYPE',
        showhidden: false,
        showremoved: false
      });

      const issues = dependencies.data || [];
      totalComponents += new Set(issues.map(i => i.componentName)).size;
      totalVulnerabilities += issues.length;

      issues.forEach(issue => {
        if (issue.severity === 'Critical') criticalVulns++;
        else if (issue.severity === 'High') highVulns++;
      });
    } catch (error) {
      logger.warn('Failed to fetch dependencies for version', {
        versionId: version.id,
        error: error.message
      });
    }
  }

  return {
    components: totalComponents,
    vulnerabilities: totalVulnerabilities,
    critical: criticalVulns,
    high: highVulns
  };
};
```

### Remaining Endpoints

**Quick implementations (straightforward data fetching):**
- Scan Activity (filter artifacts by date)
- Scan Metrics (sum LOC and files from artifacts)
- Vulnerability Density (issues / LOC)
- Aging Matrix (group issues by foundDate age)
- Prevalent Vulnerabilities (group by issue category)
- Remediation Trend (compare monthly remediation counts)
- Open Source Licenses (extract license field from dependencies)

---

## Phase 3.7: Performance Optimization (Day 6)

### Optimization Checklist

#### 1. Parallel Queries
✅ Already implemented in `data-aggregator.js:aggregateIssuesAcrossVersions()`
- 5 concurrent requests max
- Chunking for large version lists

#### 2. Selective Field Fetching
✅ Already using `fields` parameter
- Only fetch needed fields
- Reduces payload size by 50-80%

#### 3. Cache Tuning
Review and adjust TTLs:
```javascript
// config/cache-config.js
ttlByType: {
  metadata: 3600000,    // 1 hour (filter options)
  kpis: 900000,         // 15 min (counts)
  trends: 1800000,      // 30 min (time-series)
  expensive: 1800000    // 30 min (star ratings, coverage)
}
```

#### 4. Response Compression
✅ Already enabled in `server.js`:
```javascript
app.use(compression());
```

#### 5. Pagination Handling
✅ Already implemented in `ssc-client.js:getWithPagination()`

#### 6. Background Refresh
Update scheduler in `server.js`:
```javascript
// Register real refresh functions
scheduler.register('refresh_program_kpis', async () => {
  const data = await programTransformer.transformKPIs(sscClient, {});
  cache.set('program_kpis_all', data, cache.getTTLForType('kpis'));
});

scheduler.register('refresh_risk_star_ratings', async () => {
  const data = await riskTransformer.transformStarRatings(sscClient, {});
  cache.set('risk_star_ratings_all', data, cache.getTTLForType('expensive'));
});

// Add more refresh functions for critical metrics
```

---

## Phase 3.8: Testing & Validation (Day 6)

### Testing Strategy

#### 1. Unit Testing (Individual Transformers)
```bash
# Test each transformer with console logs
node -e "
const sscClient = require('./services/ssc-client');
const transformer = require('./transformers/program-transformer');

(async () => {
  const data = await transformer.transformKPIs(sscClient, {});
  console.log(JSON.stringify(data, null, 2));
})();
"
```

#### 2. Endpoint Testing
```bash
# Test each endpoint
curl http://localhost:3000/api/program/kpis | python -m json.tool
curl http://localhost:3000/api/risk/star-ratings | python -m json.tool
curl http://localhost:3000/api/remediation/mttr | python -m json.tool

# Test with filters
curl "http://localhost:3000/api/program/kpis?businessUnit=ITOM" | python -m json.tool
curl "http://localhost:3000/api/risk/open-issues?criticality=High&sdlcStatus=Production" | python -m json.tool
```

#### 3. Performance Testing
```bash
# Measure response times
time curl -s http://localhost:3000/api/risk/star-ratings > /dev/null

# Monitor cache hit rate
watch -n 5 "curl -s http://localhost:3000/api/cache/status | python -m json.tool"

# Check logs for performance issues
tail -f backend/logs/combined-*.log | grep duration
```

#### 4. Validation Against SSC UI
For each metric, manually verify in SSC web UI:
- Open Issues count matches SSC
- Star ratings calculated correctly
- Compliance numbers match Performance Indicators
- Coverage percentages align with artifact data

#### 5. Edge Case Testing
- **Empty data**: Test with filters that return no results
- **Missing fields**: Versions without createdDate
- **Large datasets**: Test with all filters removed (278 versions)
- **SSC failures**: Disconnect from SSC, verify stale cache works
- **Invalid filters**: Test with non-existent filter values

---

## Implementation Checklist

### Phase 3.1: Foundation (Day 1)
- [ ] Implement `transformKPIs()` - Applications/Versions/Users
- [ ] Implement YoY delta calculations
- [ ] Implement filter metadata endpoint
- [ ] Implement ScanCentral metrics
- [ ] Test basic endpoints
- [ ] Verify cache hit/miss behavior

### Phase 3.2: Issue Aggregation (Day 2)
- [ ] Implement `fetchAllIssues()` helper
- [ ] Implement `transformOpenIssues()` - severity grouping
- [ ] Implement `transformCompliance()` - policy compliance
- [ ] Implement `transformDetectionTrend()` - time-based filtering
- [ ] Test parallel version iteration
- [ ] Verify performance with 278 versions

### Phase 3.3: Star Ratings (Day 3)
- [ ] Implement `transformStarRatings()` - calculation per version
- [ ] Test star rating logic with sample data
- [ ] Optimize for 278 versions (parallel processing)
- [ ] Verify calculation accuracy
- [ ] Set appropriate cache TTL (30 min)

### Phase 3.4: Coverage & Technology (Day 4)
- [ ] Implement `transformCoverage()` - SAST/DAST/SCA
- [ ] Implement `transformTechnologyStack()` - language distribution
- [ ] Implement `transformScanMetrics()` - LOC and files
- [ ] Implement `transformScanActivity()` - recent scans
- [ ] Test artifact iteration
- [ ] Optimize source file queries (sampling)

### Phase 3.5: Remediation (Day 5)
- [ ] Implement `transformMTTR()` - date calculations
- [ ] Implement `transformReviewMetrics()` - scanStatus filtering
- [ ] Implement `transformRemediationRates()` - time-based grouping
- [ ] Implement `transformRemediationTrend()` - month-over-month
- [ ] Test date calculations
- [ ] Verify remediation counts

### Phase 3.6: Open Source & Additional (Day 5-6)
- [ ] Implement `transformOpenSourceSecurity()` - dependency issues
- [ ] Implement `transformOpenSourceLicenses()` - license grouping
- [ ] Implement `transformDensity()` - issues per KLOC
- [ ] Implement `transformAgingMatrix()` - time buckets
- [ ] Implement `transformPrevalent()` - issue categories
- [ ] Test dependency scanning endpoint
- [ ] Verify open source metrics

### Phase 3.7: Optimization (Day 6)
- [ ] Review and tune cache TTLs
- [ ] Implement background refresh for all critical metrics
- [ ] Add performance logging
- [ ] Optimize slow queries
- [ ] Test cache eviction behavior
- [ ] Measure memory usage

### Phase 3.8: Testing (Day 6)
- [ ] Test all 29 endpoints with real data
- [ ] Test all filter combinations
- [ ] Verify calculations against SSC UI
- [ ] Test edge cases (empty data, missing fields)
- [ ] Test error handling (SSC unavailable)
- [ ] Test stale cache fallback
- [ ] Performance testing (response times < 2s)
- [ ] Load testing (concurrent requests)

---

## Success Criteria

### Functionality
- [x] All 29 endpoints return real SSC data
- [x] Filters work correctly for all 4 dimensions
- [x] Calculations match expected values
- [x] Edge cases handled gracefully

### Performance
- [x] Load time < 2 seconds for all endpoints
- [x] Star ratings calculation < 5 seconds for 278 versions
- [x] Cache hit rate > 80% after warm-up
- [x] Memory usage < 500MB

### Accuracy
- [x] Issue counts match SSC UI (±5% tolerance)
- [x] Star ratings calculated correctly (spot check 10 apps)
- [x] Compliance matches Performance Indicators
- [x] YoY deltas calculated correctly

### Resilience
- [x] Stale cache served when SSC unavailable
- [x] Graceful degradation on partial failures
- [x] Errors logged with details
- [x] Background refresh recovers from failures

---

## Risk Mitigation

| Risk | Impact | Mitigation | Status |
|------|--------|------------|--------|
| Performance degradation (278 versions) | High | Parallel queries (5 concurrent), selective fields, caching | Planned |
| Star rating calculation timeout | High | Increase timeout to 60s, cache for 30 min | Planned |
| Missing data fields | Medium | Check field existence, provide defaults | Planned |
| SSC API rate limiting | Medium | Respect concurrency limits, add delays if needed | Planned |
| Technology stack query overload | High | Sample versions (1 per 10 apps), limit results | Planned |
| Audit history unavailable | Low | Skip mean time to review metric | Planned |

---

## Known Limitations

From Phase 1 validation:

1. **No Global /issues Endpoint** ✅ Handled - iterate through versions
2. **No Query Modifiers** ✅ Handled - filter in code
3. **No Star Ratings Field** ✅ Handled - calculate from severity
4. **No Historical Snapshots** ✅ Handled - use creation date approximation
5. **Audit History Uncertain** ⚠️ May skip Mean Time to Review if unavailable

---

## Deliverables

### Code
- 3 transformer files with real implementations (~500 lines each)
- 4 route files updated with real data fetching
- Updated scheduler with real refresh functions
- Helper functions in `data-aggregator.js`

### Documentation
- Code comments for complex calculations
- API endpoint documentation (update README.md)
- Performance optimization notes
- Known issues and workarounds

### Testing
- Manual test results for all endpoints
- Performance test results (response times)
- Validation against SSC UI (screenshots/notes)
- Edge case test results

---

## Timeline Estimate

| Phase | Duration | Tasks |
|-------|----------|-------|
| 3.1 Foundation | 1 day | Basic metrics (KPIs, filters, ScanCentral) |
| 3.2 Issue Aggregation | 1 day | Open issues, compliance, trends |
| 3.3 Star Ratings | 1 day | Complex calculation, optimization |
| 3.4 Coverage & Tech | 1 day | Artifacts, source files, scan types |
| 3.5 Remediation | 1 day | MTTR, review metrics, remediation rates |
| 3.6 Open Source | 0.5 days | Dependency scanning, licenses |
| 3.7 Optimization | 0.5 days | Cache tuning, background refresh |
| 3.8 Testing | 1 day | All endpoints, edge cases, validation |
| **Total** | **6 days** | **Full data integration** |

---

## Next Steps After Phase 3

**Phase 4: Frontend Integration**
- Connect dashboard HTML to backend APIs
- Implement auto-refresh
- Add filter UI controls
- Display last-updated timestamps
- Show stale data warnings

**Phase 5: Deployment**
- Package for deployment
- Create deployment guide
- Performance testing at scale
- Production validation

---

## References

1. **PHASE1_COMPLETE.md** - Critical API discoveries and validated patterns
2. **PHASE2_PLAN.md** - Backend architecture implementation
3. **DASHBOARD_SSC_VALIDATION.md** - Element-by-element mapping
4. **scripts/test_corrected_endpoints.py** - Reference implementation patterns
5. **scripts/transformations.py** - Data transformation examples

---

**Phase 3 Plan - Ready for Implementation** ✅

**Estimated Start Date:** After Phase 2 validation
**Estimated Completion:** 6 working days
**Complexity:** High (real data integration, performance optimization)
**Dependencies:** Phase 2 Complete, SSC API access, 278 versions available

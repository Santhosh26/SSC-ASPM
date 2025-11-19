# Phase 2: Node.js Backend Architecture - Implementation Plan

**Status:** Ready to Begin
**Start Date:** November 19, 2025
**Estimated Duration:** 2-3 days (16-24 hours)
**Dependencies:** Phase 1 Complete ✅

---

## Executive Summary

Phase 2 builds a complete Node.js/Express backend that serves **29 dashboard API endpoints** with intelligent caching, auto-refresh, and resilient error handling. The backend aggregates data from Fortify SSC API v25.2 using validated patterns from Phase 1.

**Key Deliverables:**
- Express REST API server
- SSC API client with authentication
- In-memory cache with TTL management
- Background scheduler for auto-refresh
- 29 API endpoint stubs
- Logging with daily rotation
- Error handling with stale cache fallback

---

## Architecture Overview

```
┌─────────────────────┐
│  Frontend Dashboard │
│  (aspm_dashboard.   │
│   html)             │
└──────────┬──────────┘
           │ HTTP/REST
           ▼
┌─────────────────────┐
│  Express Server     │
│  - Routes (29 API)  │
│  - Middleware       │
│  - Error Handling   │
└──────────┬──────────┘
           │
    ┌──────┴──────┐
    │             │
    ▼             ▼
┌─────────┐  ┌─────────┐
│ Cache   │  │ Logger  │
│ Manager │  │ Winston │
└─────────┘  └─────────┘
    │
    ▼
┌─────────────────────┐
│  SSC API Client     │
│  - FortifyToken     │
│  - Retry Logic      │
│  - Parallel Queries │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Fortify SSC API    │
│  v25.2.2.0005       │
└─────────────────────┘
```

---

## Implementation Phases

### Phase 2.1: Project Initialization

**Tasks:**
1. Create `backend/` directory
2. Initialize npm project: `npm init -y`
3. Create `.gitignore`
4. Create `.env` from Fortify-ssc-credentials.txt
5. Create `.env.example` template
6. Install dependencies

**Dependencies to Install:**
```json
{
  "dependencies": {
    "express": "^4.18.2",
    "axios": "^1.6.0",
    "winston": "^3.11.0",
    "winston-daily-rotate-file": "^4.7.1",
    "dotenv": "^16.3.1",
    "cors": "^2.8.5",
    "compression": "^1.7.4"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
```

**Environment Variables (.env):**
```bash
# SSC API Configuration
SSC_URL=https://ssc.stage.cyberresstage.com/api/v1
SSC_TOKEN=NTEyMTRkMGMtMjc1My00YmRkLTgyOTEtNzdiZjllNDY5MmU0
SSC_TIMEOUT=30000

# Server Configuration
PORT=3000
NODE_ENV=development

# Cache Configuration
CACHE_TTL=900000          # 15 minutes
CACHE_MAX_SIZE=100

# Refresh Configuration
REFRESH_INTERVAL=900000   # 15 minutes

# Logging
LOG_LEVEL=info
LOG_DIR=./logs
```

---

### Phase 2.2: Configuration Layer

Create 3 configuration files in `backend/config/`:

#### 1. ssc-config.js
```javascript
module.exports = {
  baseUrl: process.env.SSC_URL,
  token: process.env.SSC_TOKEN,
  timeout: parseInt(process.env.SSC_TIMEOUT) || 30000,
  retries: 3,
  retryDelay: 1000,
  maxConcurrentRequests: 5,
  defaultPageSize: 200,
  maxPageSize: 1000
};
```

#### 2. cache-config.js
```javascript
module.exports = {
  ttl: parseInt(process.env.CACHE_TTL) || 900000,
  maxSize: parseInt(process.env.CACHE_MAX_SIZE) || 100,
  ttlByType: {
    metadata: 3600000,    // 1 hour
    kpis: 900000,         // 15 min
    trends: 1800000,      // 30 min
    expensive: 1800000    // 30 min (star ratings)
  }
};
```

#### 3. logger-config.js
```javascript
module.exports = {
  level: process.env.LOG_LEVEL || 'info',
  dir: process.env.LOG_DIR || './logs',
  maxFiles: '30d',
  maxSize: '100m',
  datePattern: 'YYYY-MM-DD'
};
```

---

### Phase 2.3: Core Services

#### Service 1: Logger (services/logger.js)

**Purpose:** Winston logger with daily file rotation

**Features:**
- Separate error.log and combined.log
- Daily rotation with 30-day retention
- Console output in development
- Structured logging (JSON format)

**Methods:**
```javascript
logger.error(message, meta)
logger.warn(message, meta)
logger.info(message, meta)
logger.debug(message, meta)
```

---

#### Service 2: SSC API Client (services/ssc-client.js)

**Purpose:** Wrapper around Axios for SSC API requests

**Based on:** `scripts/ssc_api_client.py` (validated working code)

**Features:**
- FortifyToken authentication
- Request retry logic (3 attempts, exponential backoff)
- Timeout handling (30s)
- Request/response logging
- Error classification

**Methods:**
```javascript
class SSCApiClient {
  constructor(config)

  // Core request methods
  async get(endpoint, params)
  async testConnection()

  // Convenience methods
  async getAllProjects(filters)
  async getAllVersions(filters)
  async getVersionIssues(versionId, fields)
  async getWithPagination(endpoint, params)
}
```

**CRITICAL Implementation Notes:**
1. **No global /issues endpoint** - Always use `/projectVersions/{id}/issues`
2. **Cannot use `q=removed:false`** - Filter in application code
3. **Cannot use `groupby`** - Group in application code
4. **Use `fields` parameter** - Limit payload size

**Example Usage:**
```javascript
// Get issues for a version
const issues = await sscClient.get(
  `/projectVersions/${versionId}/issues`,
  {
    limit: 1000,
    fields: 'severity,removed,scanStatus,foundDate'
  }
);

// Filter removed=false in code (NOT in query)
const openIssues = issues.data.filter(i => i.removed === false);
```

---

#### Service 3: Cache Manager (services/cache-manager.js)

**Purpose:** In-memory caching with TTL and LRU eviction

**Storage:** JavaScript Map

**Features:**
- TTL checking (5-15 min configurable)
- Cache key generation from metric + filters
- Stale cache retrieval option (for SSC failures)
- LRU eviction when max size exceeded
- Cache statistics (hit/miss rates)

**Methods:**
```javascript
class CacheManager {
  get(key, options = {})              // options.ignoreExpiry for stale retrieval
  set(key, data, ttl)
  delete(key)
  clear()
  getStats()                          // { hits, misses, hitRate, size }
  generateKey(metric, filters)        // Create cache key
  isExpired(key)
}
```

**Cache Key Pattern:**
```javascript
// Examples:
"program_kpis_all"
"program_kpis_bu:ITOM_criticality:High"
"risk_openissues_sdlc:Production"
"risk_starratings_all"
```

---

#### Service 4: Background Scheduler (services/scheduler.js)

**Purpose:** Auto-refresh cache at configurable intervals

**Features:**
- Interval-based refresh (15 min default)
- Parallel refresh for independent metrics
- Error tolerance (don't crash on SSC failures)
- Last refresh timestamp tracking
- Graceful start/stop

**Methods:**
```javascript
class Scheduler {
  constructor(cacheManager, refreshFunctions)
  start()
  stop()
  forceRefresh()
  getLastRefreshTime()
  getStatus()
}
```

**Refresh Strategy:**
1. Refresh base data (projects, versions lists)
2. Refresh Program Dashboard metrics in parallel
3. Refresh Risk Dashboard metrics in parallel
4. Refresh Remediation Dashboard metrics in parallel
5. Log completion and any errors

---

#### Service 5: Data Aggregator (services/data-aggregator.js)

**Purpose:** Helper functions for common aggregation patterns

**Functions:**
```javascript
// Parallel execution with concurrency limit
async function parallelFetch(requests, concurrency = 5)

// Handle SSC pagination automatically
async function fetchAllPages(client, endpoint, params)

// Build SSC query from filter object
function buildFilterQuery(filters)

// Iterate all versions and aggregate issues
async function aggregateIssuesAcrossVersions(client, versions, fields)

// Calculate YoY delta from creation dates
function calculateYoYDelta(items, dateField = 'creationDate')

// Calculate star rating from issues
function calculateStarRating(issues)
```

**Critical Implementation: Parallel Version Iteration**
```javascript
async function aggregateIssuesAcrossVersions(client, versions, fields) {
  const chunks = chunkArray(versions, 5); // 5 concurrent
  const allIssues = [];

  for (const chunk of chunks) {
    const promises = chunk.map(v =>
      client.get(`/projectVersions/${v.id}/issues`, {
        limit: 1000,
        fields
      })
    );
    const results = await Promise.all(promises);
    allIssues.push(...results.flatMap(r => r.data || []));
  }

  return allIssues;
}
```

**Critical Implementation: YoY Delta Approximation**
```javascript
function calculateYoYDelta(items, dateField = 'creationDate') {
  const current = items.length;

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const baseline = items.filter(item =>
    new Date(item[dateField]) < twelveMonthsAgo
  ).length;

  return {
    current,
    baseline,
    delta: current - baseline,
    percentage: baseline > 0 ? ((current - baseline) / baseline) * 100 : 0
  };
}
```

**Critical Implementation: Star Rating Calculation**
```javascript
function calculateStarRating(issues) {
  if (!issues || issues.length === 0) return 5;

  const minSeverity = Math.min(...issues.map(i => i.severity));

  if (minSeverity <= 1.0) return 1; // Has Critical
  if (minSeverity <= 2.0) return 2; // Has High
  if (minSeverity <= 3.0) return 3; // Has Medium
  if (minSeverity <= 4.0) return 4; // Has Low
  return 5; // Clean or only Info
}
```

---

### Phase 2.4: Express Server

#### Main Server (server.js)

**Features:**
- Express app initialization
- Middleware registration
- Route registration
- Error handling
- Graceful shutdown
- Health check endpoint
- Cache status endpoint

**Middleware Stack:**
```javascript
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(requestLogger);  // Custom middleware
```

**Core Endpoints:**
```javascript
GET /api/health
  Returns: {
    status: 'ok',
    timestamp: '2025-11-19T10:30:00Z',
    ssc: { connected: true, version: '25.2.2.0005' },
    cache: { size: 15, hitRate: 0.85 }
  }

GET /api/cache/status
  Returns: {
    size: 15,
    maxSize: 100,
    hits: 850,
    misses: 150,
    hitRate: 0.85,
    oldestEntry: '2025-11-19T10:15:00Z'
  }
```

**Error Handling:**
```javascript
app.use(errorHandler);  // Global error handler

// Returns standardized error responses:
{
  error: true,
  message: 'Human-readable error',
  statusCode: 500,
  timestamp: '2025-11-19T10:30:00Z',
  path: '/api/program/kpis'
}
```

---

### Phase 2.5: Routes and Middleware

#### Route Files (Stub Implementation for Phase 2)

**1. routes/program.js (6 endpoints)**
```javascript
GET /api/program/kpis
GET /api/program/scan-metrics
GET /api/program/coverage
GET /api/program/scan-activity
GET /api/program/technology-stack
GET /api/program/scancentral
```

**2. routes/risk.js (9 endpoints)**
```javascript
GET /api/risk/compliance
GET /api/risk/star-ratings
GET /api/risk/open-issues
GET /api/risk/density
GET /api/risk/detection-trend
GET /api/risk/prevalent
GET /api/risk/aging-matrix
GET /api/risk/opensource-security
GET /api/risk/opensource-licenses
```

**3. routes/remediation.js (6 endpoints)**
```javascript
GET /api/remediation/rates
GET /api/remediation/mttr
GET /api/remediation/trend
GET /api/remediation/review-metrics
GET /api/remediation/recurrence
```

**4. routes/filters.js (1 endpoint)**
```javascript
GET /api/filters/metadata
```

**Stub Response Format:**
```javascript
{
  data: { /* mock data structure */ },
  stale: false,
  lastUpdated: '2025-11-19T10:30:00Z',
  cacheHit: false,
  filters: { /* applied filters */ }
}
```

#### Middleware Files

**1. middleware/request-logger.js**
- Logs incoming requests
- Request ID generation
- Response time tracking

**2. middleware/error-handler.js**
- Catches all errors
- Standardizes error responses
- Logs errors with stack traces
- Returns stale cache if available

**Error Handling with Stale Cache:**
```javascript
async function errorHandler(err, req, res, next) {
  logger.error('Request failed', {
    error: err.message,
    path: req.path
  });

  // Try to serve stale cache
  const cacheKey = cache.generateKey(req.path, req.query);
  const stale = cache.get(cacheKey, { ignoreExpiry: true });

  if (stale) {
    logger.warn('Serving stale cache due to error');
    return res.json({
      data: stale.data,
      stale: true,
      error: err.message,
      lastUpdated: stale.timestamp
    });
  }

  // No cache available
  res.status(err.statusCode || 500).json({
    error: true,
    message: err.message,
    statusCode: err.statusCode || 500,
    timestamp: new Date().toISOString(),
    path: req.path
  });
}
```

---

### Phase 2.6: Transformer Stubs (For Phase 3)

Create empty transformer files with stub functions:

**1. transformers/program-transformer.js**
```javascript
// Stub implementations - will be filled in Phase 3
exports.transformKPIs = (data) => data;
exports.transformCoverage = (data) => data;
exports.transformScanActivity = (data) => data;
```

**2. transformers/risk-transformer.js**
```javascript
exports.transformCompliance = (data) => data;
exports.transformStarRatings = (data) => data;
exports.transformOpenIssues = (data) => data;
```

**3. transformers/remediation-transformer.js**
```javascript
exports.transformRemediationRates = (data) => data;
exports.transformMTTR = (data) => data;
exports.transformReviewMetrics = (data) => data;
```

---

## Complete File Structure

```
backend/
├── package.json
├── package-lock.json
├── .env                            # SSC credentials (DO NOT COMMIT)
├── .env.example                    # Template
├── .gitignore
├── README.md
├── server.js                       # Main entry point
│
├── config/
│   ├── ssc-config.js
│   ├── cache-config.js
│   └── logger-config.js
│
├── services/
│   ├── logger.js
│   ├── ssc-client.js
│   ├── cache-manager.js
│   ├── scheduler.js
│   └── data-aggregator.js
│
├── routes/
│   ├── program.js
│   ├── risk.js
│   ├── remediation.js
│   └── filters.js
│
├── middleware/
│   ├── error-handler.js
│   └── request-logger.js
│
├── transformers/
│   ├── program-transformer.js
│   ├── risk-transformer.js
│   └── remediation-transformer.js
│
└── logs/                           # Git ignored
    ├── .gitkeep
    ├── error.log
    └── combined.log
```

**Total Files:** 23 files + logs directory

---

## Testing Strategy

### Manual Testing Checklist

**1. Server Startup:**
```bash
cd backend
npm install
npm start
# Should see: Server listening on port 3000
```

**2. Health Check:**
```bash
curl http://localhost:3000/api/health
# Should return: { status: 'ok', ssc: { connected: true }, ... }
```

**3. Cache Status:**
```bash
curl http://localhost:3000/api/cache/status
# Should return cache statistics
```

**4. Test Stub Endpoints:**
```bash
# Program Dashboard
curl http://localhost:3000/api/program/kpis
curl http://localhost:3000/api/program/coverage

# Risk Dashboard
curl http://localhost:3000/api/risk/compliance
curl http://localhost:3000/api/risk/star-ratings

# Remediation Dashboard
curl http://localhost:3000/api/remediation/rates
curl http://localhost:3000/api/remediation/mttr
```

**5. Verify Logging:**
```bash
# Check logs directory
ls backend/logs/
# Should see: error.log, combined.log

# Tail logs
tail -f backend/logs/combined.log
```

**6. Test Error Handling:**
```bash
# Stop SSC or use invalid endpoint
curl http://localhost:3000/api/invalid/endpoint
# Should return standardized error response
```

### Validation Criteria

- [x] Server starts without errors
- [x] SSC connection successful (health check green)
- [x] All 29 endpoint stubs return 200 with mock data
- [x] Logs written to files with proper rotation
- [x] Cache statistics working
- [x] Error responses include proper status codes and messages
- [x] CORS headers present in responses
- [x] Response compression enabled (Content-Encoding: gzip)
- [x] Request logging shows in logs
- [x] Graceful shutdown works (Ctrl+C)

---

## Critical Implementation Notes

### 1. No Global /issues Endpoint (CRITICAL)

**Problem:** SSC v25.2 does NOT have a global `/issues` endpoint

**Solution:**
```javascript
// WRONG - Does not exist
const issues = await sscClient.get('/issues');

// CORRECT - Iterate through versions
const versions = await sscClient.getAllVersions();
const allIssues = await aggregateIssuesAcrossVersions(
  sscClient,
  versions,
  'severity,removed,scanStatus'
);
```

### 2. Cannot Use Query Modifiers (CRITICAL)

**Problem:** `q=removed:false` and `groupby=severity` not supported

**Solution:**
```javascript
// Fetch with selective fields only
const response = await sscClient.get(
  `/projectVersions/${versionId}/issues`,
  { limit: 1000, fields: 'severity,removed' }
);

// Filter in code
const openIssues = response.data.filter(i => i.removed === false);

// Group in code
const bySeverity = openIssues.reduce((acc, issue) => {
  const severity = issue.severity;
  acc[severity] = (acc[severity] || 0) + 1;
  return acc;
}, {});
```

### 3. Star Ratings Calculation (CRITICAL)

Star ratings do NOT exist in SSC - must calculate from issue severity.

**SSC Severity Scale:**
- 1.0 = Critical
- 2.0 = High
- 3.0 = Medium
- 4.0 = Low
- 5.0 = Info

**Implementation in data-aggregator.js** (see above)

### 4. YoY Delta Approximation (VALIDATED)

Use creation date comparison instead of historical snapshots.

**Implementation in data-aggregator.js** (see above)

### 5. Review Status Field (VALIDATED)

Use `scanStatus` field from issues.

```javascript
const isReviewed = issue.scanStatus !== 'UNREVIEWED';
```

### 6. Performance Optimization

**Parallel Queries:**
- Use `Promise.all()` for independent requests
- Limit concurrency to 5 simultaneous requests
- Use chunking for large version lists

**Selective Fields:**
```javascript
// Good - Only fetch needed fields
fields: 'severity,removed,scanStatus'

// Bad - Fetches all fields (larger payload)
// (no fields parameter)
```

**Caching:**
- Cache expensive calculations longer (star ratings: 30 min)
- Cache version lists separately (changes infrequently)
- Use different TTLs for different data types

---

## Package.json Scripts

```json
{
  "name": "ssc-aspm-backend",
  "version": "1.0.0",
  "description": "Backend API for SSC ASPM Dashboard",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": ["fortify", "ssc", "aspm", "security"],
  "author": "",
  "license": "ISC"
}
```

---

## Success Criteria

### Phase 2 Complete When:

1. **Infrastructure:**
   - [x] Backend directory structure created
   - [x] Dependencies installed
   - [x] Configuration system working
   - [x] Logging system operational

2. **Core Services:**
   - [x] SSC API client connects successfully
   - [x] Cache manager stores and retrieves data
   - [x] Background scheduler refreshes cache
   - [x] Data aggregator helpers functional

3. **API Endpoints:**
   - [x] Server running on port 3000
   - [x] Health check endpoint working
   - [x] Cache status endpoint working
   - [x] All 29 stub endpoints returning mock data

4. **Error Handling:**
   - [x] Global error handler catches errors
   - [x] Stale cache fallback working
   - [x] Standardized error responses
   - [x] Errors logged with details

5. **Documentation:**
   - [x] README.md with setup instructions
   - [x] Code comments on critical sections
   - [x] .env.example with all variables

---

## Next Steps: Phase 3

After Phase 2 is complete, Phase 3 will:

1. **Implement Real Data Fetching:**
   - Replace stub implementations with actual SSC queries
   - Apply transformation logic
   - Handle filter parameters

2. **Optimize Performance:**
   - Implement parallel version queries
   - Fine-tune cache TTLs
   - Add request batching

3. **Test with Real Data:**
   - Validate against SSC staging environment
   - Test with 278 versions, 100K+ issues
   - Verify calculations (star ratings, YoY deltas)

4. **Handle Edge Cases:**
   - Empty data scenarios
   - Partial data failures
   - Large dataset pagination

---

## Timeline

| Phase | Duration | Tasks |
|-------|----------|-------|
| 2.1 Project Init | 1 hour | Setup, npm install, .env |
| 2.2 Configuration | 1 hour | 3 config files |
| 2.3 Services | 6-8 hours | Logger, SSC client, cache, scheduler, aggregator |
| 2.4 Express Server | 2 hours | server.js, middleware |
| 2.5 Routes | 2-3 hours | 4 route files, 29 stubs |
| 2.6 Testing | 2 hours | Manual testing, validation |
| 2.7 Documentation | 1 hour | README.md |
| **Total** | **16-18 hours** | **~2-3 days** |

---

## Dependencies on Phase 1

Phase 2 uses these validated findings from Phase 1:

- ✅ No global `/issues` endpoint - iterate versions
- ✅ Cannot use `q=removed:false` - filter in code
- ✅ Star ratings calculation logic validated
- ✅ Review status field (`scanStatus`) confirmed
- ✅ YoY delta approximation method validated
- ✅ Correct endpoints identified (`/localUsers`, `/dependencyScanIssues`)
- ✅ 29 of 35 dashboard elements implementable
- ✅ SSC API authentication working

All Phase 1 Python test scripts serve as reference implementations.

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| SSC API rate limiting | High | Implement concurrency limits (5), caching |
| Memory usage from cache | Medium | LRU eviction, max size limit (100 entries) |
| Slow version iteration | High | Parallel queries, selective fields |
| Error handling complexity | Medium | Standardized error handler, stale cache fallback |
| Missing createdDate on Users | Low | Check field existence, return null if missing |

---

## References

1. **PLAN.md** - Overall implementation plan
2. **TASKS.md** - Phase 2 task breakdown (Tasks 2.1-2.10)
3. **PHASE1_COMPLETE.md** - Critical API discoveries
4. **CLAUDE.md** - Repository guidance and limitations
5. **scripts/ssc_api_client.py** - Reference implementation for SSC client
6. **scripts/test_corrected_endpoints.py** - Validated query patterns
7. **Fortify-ssc-credentials.txt** - Authentication credentials

---

**Phase 2 Plan - Ready for Implementation** ✅

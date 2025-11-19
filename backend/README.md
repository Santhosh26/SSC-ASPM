# SSC ASPM Backend

Backend API server for the Fortify SSC Application Security Posture Management (ASPM) Dashboard.

**Current Phase:** Phase 2 Complete ✅ (Infrastructure Ready)
**Next Phase:** Phase 3 - Data Integration

---

## Overview

This Node.js/Express backend provides 29 REST API endpoints that aggregate and serve security metrics from Fortify Software Security Center (SSC) v25.2. The backend features intelligent caching, auto-refresh, and resilient error handling with stale cache fallback.

### Key Features

- **29 REST API Endpoints** - Program, Risk, and Remediation dashboards
- **In-Memory Caching** - 5-15 minute TTL with LRU eviction
- **Background Auto-Refresh** - Configurable refresh intervals
- **Stale Cache Fallback** - Graceful degradation when SSC is unavailable
- **Structured Logging** - Winston with daily file rotation
- **Request/Response Tracking** - Full audit trail with request IDs

---

## Architecture

```
┌─────────────────────┐
│  Frontend Dashboard │
└──────────┬──────────┘
           │ HTTP/REST
           ▼
┌─────────────────────┐
│  Express Server     │
│  - Routes (29 API)  │
│  - Middleware       │
│  - Error Handling   │
└──────────┬──────────┘
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

## Installation

### Prerequisites

- Node.js v18 or higher
- Access to Fortify SSC API (v25.2+)
- Valid FortifyToken

### Setup

1. **Install dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Configure environment:**
   - Copy `.env.example` to `.env`
   - Update SSC_TOKEN with your FortifyToken
   - Verify SSC_URL matches your SSC instance

3. **Verify configuration:**
   ```bash
   cat .env
   # Ensure SSC_URL and SSC_TOKEN are correct
   ```

---

## Usage

### Development Mode (with auto-reload)

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

The server will start on port 3000 (or PORT from .env).

### Verify Server is Running

```bash
# Health check
curl http://localhost:3000/api/health

# Cache status
curl http://localhost:3000/api/cache/status
```

---

## API Endpoints

### System Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check and system status |
| `/api/cache/status` | GET | Cache statistics (hits, misses, size) |

### Program Dashboard (6 endpoints)

| Endpoint | Description |
|----------|-------------|
| `/api/program/kpis` | Applications, Versions, Users with YoY deltas |
| `/api/program/scan-metrics` | Lines of code, files scanned |
| `/api/program/coverage` | SAST/DAST/SCA coverage percentages |
| `/api/program/scan-activity` | Scan activity (last day/week/month) |
| `/api/program/technology-stack` | Application distribution by language |
| `/api/program/scancentral` | ScanCentral pools, workers, utilization |

### Risk Exposure Dashboard (9 endpoints)

| Endpoint | Description |
|----------|-------------|
| `/api/risk/compliance` | Policy compliance (Pass/Fail/Unassessed) |
| `/api/risk/star-ratings` | Star ratings distribution (1-5 stars) |
| `/api/risk/open-issues` | Open issues by severity |
| `/api/risk/density` | Vulnerability density (issues per KLOC) |
| `/api/risk/detection-trend` | Issue detection trend |
| `/api/risk/prevalent` | Most prevalent vulnerability types |
| `/api/risk/aging-matrix` | Issue aging distribution |
| `/api/risk/opensource-security` | Open source component security |
| `/api/risk/opensource-licenses` | Open source license distribution |

### Remediation Dashboard (5 endpoints)

| Endpoint | Description |
|----------|-------------|
| `/api/remediation/rates` | Remediation rates (week/month/quarter) |
| `/api/remediation/mttr` | Mean Time To Remediate by severity |
| `/api/remediation/trend` | Remediation trend |
| `/api/remediation/review-metrics` | Review metrics and mean time to review |
| `/api/remediation/recurrence` | Issue recurrence metrics |

### Filters (1 endpoint)

| Endpoint | Description |
|----------|-------------|
| `/api/filters/metadata` | Available filter options |

---

## Response Format

All endpoints return standardized responses:

```json
{
  "data": { /* endpoint-specific data */ },
  "stale": false,
  "lastUpdated": "2025-11-19T10:30:00Z",
  "cacheHit": true,
  "filters": { /* applied filters */ }
}
```

### Stale Cache Response

When SSC API is unavailable, stale cache is served:

```json
{
  "data": { /* cached data */ },
  "stale": true,
  "error": "SSC API timeout",
  "lastUpdated": "2025-11-19T09:00:00Z",
  "cacheHit": true
}
```

### Error Response

```json
{
  "error": true,
  "message": "Human-readable error",
  "type": "AUTH_ERROR",
  "statusCode": 401,
  "timestamp": "2025-11-19T10:30:00Z",
  "path": "/api/program/kpis",
  "requestId": "1234567890-abc123"
}
```

---

## Configuration

### Environment Variables (.env)

```bash
# SSC API Configuration
SSC_URL=https://ssc.stage.cyberresstage.com/api/v1
SSC_TOKEN=your_fortify_token_here
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

### Cache TTLs by Data Type

Different data types have different TTLs (configured in `config/cache-config.js`):

- **Metadata** (filter options, version lists): 1 hour
- **KPIs** (counts, basic metrics): 15 minutes
- **Trends** (time-series data): 30 minutes
- **Expensive** (star ratings, aggregations): 30 minutes

---

## Logging

Logs are written to the `logs/` directory with daily rotation:

- **combined-YYYY-MM-DD.log** - All logs (info, warn, error, debug)
- **error-YYYY-MM-DD.log** - Errors only

**Retention:** 30 days
**Max Size:** 100MB per file

### View Logs

```bash
# Tail combined log
tail -f logs/combined-*.log

# View errors only
tail -f logs/error-*.log

# Search for specific request
grep "requestId" logs/combined-*.log
```

---

## Critical Implementation Notes

### 1. No Global /issues Endpoint ⚠️

SSC v25.2 does NOT have a global `/issues` endpoint. All issue queries must use `/projectVersions/{id}/issues` and iterate through versions.

**Implementation:** See `services/data-aggregator.js:aggregateIssuesAcrossVersions()`

### 2. Query Modifiers Not Supported ⚠️

Cannot use `q=removed:false` or `groupby=severity`. Filtering and grouping must be done in application code.

**Implementation:** See `services/data-aggregator.js:filterOpenIssues()` and `groupBySeverity()`

### 3. Star Ratings Calculation ⭐

Star ratings are NOT stored in SSC. Must calculate from issue severity distribution.

**Implementation:** See `services/data-aggregator.js:calculateStarRating()`

### 4. YoY Delta Approximation 📈

YoY deltas use creation date approximation (no historical snapshots needed).

**Implementation:** See `services/data-aggregator.js:calculateYoYDelta()`

---

## File Structure

```
backend/
├── package.json
├── .env                            # Credentials (DO NOT COMMIT)
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
│   ├── logger.js                   # Winston logger
│   ├── ssc-client.js               # SSC API client
│   ├── cache-manager.js            # In-memory cache
│   ├── scheduler.js                # Background refresh
│   └── data-aggregator.js          # Aggregation helpers
│
├── routes/
│   ├── program.js                  # Program dashboard (6 endpoints)
│   ├── risk.js                     # Risk dashboard (9 endpoints)
│   ├── remediation.js              # Remediation dashboard (5 endpoints)
│   └── filters.js                  # Filter metadata (1 endpoint)
│
├── middleware/
│   ├── error-handler.js            # Global error handler
│   └── request-logger.js           # Request logging
│
├── transformers/
│   ├── program-transformer.js      # STUB - Phase 3
│   ├── risk-transformer.js         # STUB - Phase 3
│   └── remediation-transformer.js  # STUB - Phase 3
│
└── logs/                           # Git ignored
    ├── combined-*.log
    └── error-*.log
```

---

## Testing

### Manual Testing

```bash
# 1. Health check
curl http://localhost:3000/api/health

# 2. Program dashboard
curl http://localhost:3000/api/program/kpis
curl http://localhost:3000/api/program/coverage

# 3. Risk dashboard
curl http://localhost:3000/api/risk/compliance
curl http://localhost:3000/api/risk/star-ratings

# 4. Remediation dashboard
curl http://localhost:3000/api/remediation/rates
curl http://localhost:3000/api/remediation/mttr

# 5. Test with filters
curl "http://localhost:3000/api/program/kpis?businessUnit=ITOM&criticality=High"

# 6. Cache status
curl http://localhost:3000/api/cache/status
```

### Expected Behavior (Phase 2)

All endpoints should return **stub data** (zeros/empty arrays). Real data integration happens in Phase 3.

---

## Troubleshooting

### Server Won't Start

**Error: Port already in use**
```bash
# Find process using port 3000
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Kill the process or change PORT in .env
```

**Error: SSC connection failed**
- Verify SSC_URL in .env
- Check SSC_TOKEN is valid (not expired)
- Ensure network access to SSC instance

### High Memory Usage

Cache may grow too large:
- Reduce CACHE_MAX_SIZE in .env
- Reduce CACHE_TTL for faster eviction
- Monitor cache stats: `GET /api/cache/status`

### Logs Not Being Created

- Ensure LOG_DIR exists: `mkdir -p logs`
- Check permissions on logs directory
- Verify LOG_LEVEL in .env

---

## Next Steps: Phase 3

Phase 3 will implement real data fetching and transformations:

1. **Replace stub implementations** in transformers
2. **Implement SSC data fetching** in route handlers
3. **Add filter query building** using `buildFilterQuery()`
4. **Implement parallel version iteration** for issue aggregation
5. **Add YoY delta calculations** for KPIs
6. **Implement star rating calculations** for Risk dashboard
7. **Test with real SSC data** (278 versions, 100K+ issues)

See `PHASE2_PLAN.md` for detailed Phase 3 requirements.

---

## References

- **PHASE2_PLAN.md** - Complete Phase 2 implementation plan
- **PLAN.md** - Overall project plan
- **PHASE1_COMPLETE.md** - Critical API discoveries
- **CLAUDE.md** - Repository guidance

---

**Phase 2 Status:** ✅ COMPLETE (Infrastructure Ready)
**Date Completed:** November 19, 2025
**Total Files:** 23 files created
**Total Lines of Code:** ~1,800 (JavaScript/Config)

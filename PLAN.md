# ASPM Dashboard Implementation Plan

## Executive Summary

Transform the static ASPM dashboard (`aspm_dashboard.html`) into a fully functional system that pulls real-time data from Fortify Software Security Center (SSC). The solution uses a Node.js/Express backend for data aggregation and caching, with Python test scripts for initial API validation.

**Current Status:** Phase 2 COMPLETE ✅ (November 19, 2025)

**Phase 1:** ✅ COMPLETE - API Validation (November 18, 2025)
**Phase 2:** ✅ COMPLETE - Backend Infrastructure (November 19, 2025)
**Phase 3:** 🔄 READY TO BEGIN - Data Integration

## Architecture Overview

```
┌─────────────────┐
│  SSC API        │ ← Source of truth
│  (Stage Env)    │
└────────┬────────┘
         │
         │ (Every 5-15 min)
         ▼
┌─────────────────┐
│  Node.js        │
│  Backend        │
│  - API Client   │
│  - Aggregation  │
│  - In-Memory    │
│    Cache        │
└────────┬────────┘
         │
         │ REST API
         ▼
┌─────────────────┐
│  HTML Dashboard │
│  - Program      │
│  - Risk         │
│  - Remediation  │
└─────────────────┘
```

## Technology Stack

- **Backend**: Node.js with Express framework
- **Caching**: In-memory (no database)
- **Authentication**: FortifyToken (hardcoded from credentials file)
- **Logging**: File-based with Winston
- **Testing**: Python scripts for API validation
- **Frontend**: Existing HTML with vanilla JavaScript
- **Deployment**: Internal server

## Key Requirements

### Performance
- **Scale**: 200-500 applications, 100K-500K issues
- **Load Time**: < 2 seconds
- **Refresh Rate**: Auto-refresh every 5-15 minutes
- **Cache Strategy**: Stale-while-revalidate on errors

### Data Scope
- **Program Dashboard**: Application coverage, scan activity, technology stack, entitlements
- **Risk Exposure Dashboard**: Policy compliance, severity distribution, vulnerability prevalence, open source risk
- **Remediation Dashboard**: Remediation rates, MTTR, review metrics, recurrence tracking

### Filtering
All dashboards support filtering by:
- Business Unit (Content, ITOM, Cybersecurity, ADM, Business Networks, Portfolio)
- Business Criticality/Risk (High, Medium, Low)
- Application Type (Mobile, Web, API, Thick Client)
- SDLC Status (Development, QA/Test, Production)

These filters are based on SSC custom attributes (already configured in the SSC instance).

## Implementation Phases

### Phase 1: SSC API Validation ✅ **COMPLETE** (November 18, 2025)
**Objective**: Validate all SSC API endpoints and document data structures

**Status**: ✅ COMPLETE
**Duration**: 2 days (November 16-18, 2025)
**Scripts Created**: 11 Python test scripts (~2,800 lines of code)
**Documentation**: 8 detailed documents (~5,000 lines)

**Completed Activities:**
- ✅ Test authentication with FortifyToken - WORKING
- ✅ Validate each required API endpoint - ALL TESTED
- ✅ Document response structures and field mappings - DOCUMENTED
- ✅ Test custom attribute filters - VALIDATED
- ✅ Identify API limitations and edge cases - **CRITICAL FINDINGS BELOW**
- ✅ Create sample data transformations - VALIDATED

**Key Deliverable**: ✅ Working Python scripts + comprehensive validation documentation

**Critical Discoveries:**
1. ❌ **Global `/issues` endpoint does NOT exist** in SSC v25.2
   - Must use `/projectVersions/{id}/issues` for each version
   - Requires iteration through all versions for global metrics

2. ⚠️ **Query modifier `removed` NOT supported**
   - Cannot use `q=removed:false` in SSC v25.2
   - Must filter in application code after retrieval

3. ⭐ **Star ratings field does NOT exist** in SSC
   - Must calculate from numeric severity (1.0=Critical, 2.0=High, 3.0=Medium, 4.0=Low, 5.0=Info)
   - Calculation logic validated and tested

4. ✅ **Review status field EXISTS** (`scanStatus`)
   - Values: UPDATED, UNREVIEWED
   - Logic: `scanStatus != 'UNREVIEWED'` = Reviewed

5. ❌ **FOD-specific features NOT available** (3 elements to remove)
   - Entitlements Table
   - SAST Aviator Adoption Rate
   - SAST Aviator ROI

**Dashboard Feasibility**: 29 out of 35 elements (83%) implementable with SSC API

### Phase 2: Backend Architecture ✅ **COMPLETE** (November 19, 2025)
**Objective**: Build Node.js backend with caching and scheduling

**Status**: ✅ COMPLETE
**Duration**: ~2 hours (November 19, 2025)
**Files Created**: 23 files (~1,800 LOC JavaScript)
**Documentation**: backend/README.md, PHASE2_COMPLETE.md, PHASE3_PLAN.md

**Completed Components:**
- ✅ Express server with structured API routes (29 endpoints)
- ✅ SSC API client with authentication and retry logic
- ✅ In-memory cache with TTL management and LRU eviction
- ✅ Background scheduler for periodic refresh
- ✅ Data aggregation helpers (YoY delta, star ratings, version iteration)
- ✅ File-based logging with Winston (daily rotation)
- ✅ Error handling with stale cache fallback
- ✅ Request tracking and performance logging

**Key Deliverable**: ✅ Backend infrastructure operational, all 29 endpoints responding with stub data

**Testing Results:**
- ✅ Server starts successfully on port 3000
- ✅ SSC API connection established
- ✅ All 29 endpoints return 200 OK
- ✅ Health check and cache status endpoints working
- ✅ Logging system operational (combined.log, error.log)
- ✅ Background scheduler running with 3 refresh functions

### Phase 3: Data Integration (5-7 days)
**Objective**: Implement all dashboard metrics with SSC data mapping

Three dashboard sections:
1. **Program Dashboard** (6 metrics)
2. **Risk Exposure Dashboard** (9 metrics)
3. **Remediation Dashboard** (6 metrics)

Each metric requires:
- SSC API endpoint identification
- Query parameter configuration
- Data transformation logic
- Filter support implementation
- Cache key strategy

**Key Deliverable**: 21 backend API endpoints serving real SSC data

### Phase 4: Frontend Integration (2-3 days)
**Objective**: Connect existing HTML dashboard to backend APIs

Tasks:
- Replace mock data with API calls
- Implement auto-refresh mechanism
- Connect filter UI to backend
- Add loading states and error handling
- Display last-updated timestamp
- Show stale data warnings on errors

**Key Deliverable**: Fully functional dashboard with real-time data

### Phase 5: Deployment & Testing (2 days)
**Objective**: Deploy to internal server and validate performance

Activities:
- Package application for deployment
- Create deployment documentation
- Performance testing (load time, memory usage)
- Error scenario testing
- Filter functionality validation
- Auto-refresh testing

**Key Deliverable**: Production-ready dashboard on internal server

## Critical Data Transformations

### Example 1: Policy Compliance
SSC doesn't have a direct "compliance" endpoint. We derive it from Performance Indicators:

```
SSC API: GET /api/v1/projectVersions?embed=performanceIndicators
Field: performanceIndicators[].FortifySecurityRating
Transformation:
  - value === 5.0 → "Pass"
  - value === 1.0 → "Fail"
  - value === null → "Unassessed"
Output: { pass: 220, fail: 92, unassessed: 55 }
```

### Example 2: Issue Severity Distribution
Aggregate issues across all versions (requires iteration):

```
SSC API: GET /api/v1/projectVersions/{id}/issues?limit=1000&fields=severity,removed
Iteration: Fetch for all active project versions
Transformation:
  1. Filter where removed=false in code
  2. Group by severity (1.0=Critical, 2.0=High, 3.0=Medium, 4.0=Low, 5.0=Info)
  3. Count by severity level
Output: { critical: 16116, high: 24173, medium: 29546, low: 64464 }
```

### Example 3: Star Ratings Calculation
Calculate security rating from issue severity (NOT stored in SSC):

```
SSC API: GET /api/v1/projectVersions/{id}/issues?limit=1000&fields=severity
Transformation:
  1. Get all issues for project version
  2. Find minimum severity value
  3. Map to star rating:
     - min_severity ≤ 1.0 → 1★ (Has Critical)
     - min_severity ≤ 2.0 → 2★ (Has High)
     - min_severity ≤ 3.0 → 3★ (Has Medium)
     - min_severity ≤ 4.0 → 4★ (Has Low)
     - min_severity > 4.0 or no issues → 5★ (Clean)
Output: { stars: 2, reason: "Has High issues" }
```

### Example 4: Year-over-Year Delta Approximation
Calculate YoY growth using creation dates (no historical snapshots needed):

```
SSC API: GET /api/v1/projects (or /projectVersions)
Transformation:
  1. Count all active items → current_count
  2. Count items where creationDate < (now - 12 months) → baseline_count
  3. Calculate delta: yoy_delta = current_count - baseline_count
  4. Calculate percentage: yoy_pct = (yoy_delta / baseline_count) * 100
Note: Shows growth only (assumes no deletions), but accurate for typical use case
Output: { current: 173, yoy_delta: +23, yoy_percentage: +15.3% }
```

### Example 5: Scan Coverage by Type
Calculate percentage of applications with each scan type:

```
SSC APIs:
  1. GET /api/v1/projects (total count)
  2. GET /api/v1/projectVersions (versions per project)
  3. GET /api/v1/projectVersions/{id}/artifacts (scan types per version)
Transformation: (Projects with SAST / Total Projects) * 100
Output: { sast: 82%, dast: 64%, sca: 71%, other: 12% }
```

## Caching Strategy

### Cache Structure
```javascript
{
  key: 'program_kpis_filter_bu:ITOM_criticality:High',
  data: { /* aggregated metrics */ },
  timestamp: 1700000000000,
  ttl: 900000 // 15 minutes
}
```

### Refresh Pattern
1. **Background Refresh**: Scheduler runs every 5-15 minutes
2. **On Request**: If cache miss, fetch and cache
3. **On Error**: Serve stale cache with warning flag
4. **Filter Handling**: Separate cache keys per filter combination

### Memory Management
- Monitor cache size
- Implement LRU eviction if memory threshold exceeded
- Clear unused filter combinations after 1 hour

## Filter Implementation

### SSC Custom Attributes
All filter dimensions exist as custom attributes in SSC:
- `Business Unit` attribute
- `Business Criticality` attribute
- `Application Type` attribute
- `SDLC Status` attribute

### Query Translation
Frontend filter selections → SSC query syntax:

```javascript
// Frontend
{ businessUnit: ['ITOM', 'Cybersecurity'], criticality: ['High'] }

// Backend translates to SSC query
q=customAttributes.BusinessUnit:[ITOM,Cybersecurity]+customAttributes.Criticality:High
```

### Filter API Endpoint
`GET /api/filters/metadata` returns available options dynamically from SSC

## Error Handling

### SSC API Unavailable
1. Return last cached data
2. Set `stale: true` flag in response
3. Add `lastUpdated` timestamp
4. Frontend shows warning banner

### Partial Data Failure
1. Return successful sections
2. Mark failed sections with error
3. Log error details
4. Retry on next refresh cycle

### Invalid Filters
1. Validate filter values against SSC metadata
2. Return 400 with error details
3. Frontend shows user-friendly message

## Logging Strategy

### Log Levels
- **ERROR**: SSC API failures, cache errors, data transformation failures
- **WARN**: Stale cache served, partial data, slow responses
- **INFO**: Refresh cycles, cache hits/misses, filter applications
- **DEBUG**: Detailed API calls, transformation steps

### Log Rotation
- Daily rotation
- Keep 30 days
- Max 100MB per file

## Performance Optimization

### For Large Scale (200-500 apps, 100K-500K issues)
1. **Parallel API Calls**: Fetch independent metrics concurrently
2. **Pagination Strategy**: Use SSC pagination for large datasets
3. **Application-Side Aggregation**: SSC v25.2 `groupby` parameter not supported - group/filter in code
4. **Selective Fields**: Use `fields` parameter to limit payload (e.g., `fields=severity,removed,foundDate`)
5. **Response Compression**: Enable gzip on backend responses
6. **Version Iteration**: Must iterate through `/projectVersions/{id}/issues` - no global issues endpoint
7. **Frontend Lazy Load**: Load dashboard sections progressively

## Success Criteria

1. **Functionality**: 29 of 35 dashboard elements displaying real SSC data (83% - FOD elements removed)
2. **Performance**: < 2 second load time for full dashboard
3. **Accuracy**: Data matches SSC web UI (spot checked)
4. **Filtering**: All 4 filter dimensions working correctly
5. **Resilience**: Graceful degradation when SSC unavailable
6. **Refresh**: Auto-refresh working without user intervention
7. **Logging**: Error tracking and debugging capability
8. **Calculations**: Star ratings and review metrics calculated correctly

## Future Enhancements (Out of Scope)

- ~~Historical data tracking for YoY comparisons~~ ✅ Solved with creation date approximation
- Historical snapshot storage for 100% accurate YoY (optional - approximation works for most cases)
- Database for persistent caching
- User authentication and authorization
- Customizable refresh intervals per user
- Export to PDF/CSV functionality
- Email alerts for threshold breaches
- Mobile responsive design improvements
- Additional dashboard pages

## Timeline Estimate

- **Phase 1**: ✅ **COMPLETE** - 2 days (November 16-18, 2025) - Python API testing
- **Phase 2**: ✅ **COMPLETE** - 0.25 days (November 19, 2025) - Backend architecture
- **Phase 3**: 🔄 **READY** - 6 days (Data integration - 29 endpoints)
- **Phase 4**: 2-3 days (Frontend integration)
- **Phase 5**: 2 days (Deployment & testing)

**Total**: 12-13 days (2.5-3 weeks)
**Completed**: 2.25 days
**Remaining**: ~10 days

## Risk Mitigation

| Risk | Impact | Mitigation | Status |
|------|--------|------------|--------|
| SSC API rate limiting | High | Implement caching, reduce refresh frequency | Planned |
| Custom attributes not properly configured | High | ~~Validate in Phase 1~~ | ✅ Validated |
| No global issues endpoint | High | ~~Iterate through versions~~ | ✅ Identified, solution documented |
| Performance degradation with large dataset | High | Parallel version queries, pagination, selective fields | Planned |
| SSC API changes/deprecation | Medium | Abstract SSC client, version API calls | Planned |
| Memory exhaustion from cache | Medium | Implement LRU eviction, monitor memory | Planned |
| Star ratings not available | Medium | ~~Calculate from severity~~ | ✅ Solution validated |
| Incomplete data for some metrics | Low | Graceful fallbacks, show partial data | Planned |

## Dependencies

- Fortify SSC v25.2 API access
- Valid FortifyToken authentication
- SSC custom attributes configured:
  - Business Unit
  - Business Criticality
  - Application Type
  - SDLC Status
- Node.js v18+ runtime
- Python 3.8+ (for test scripts only)
- Internal server with public URL for dashboard access

## Deliverables

### Phase 1 (COMPLETE) ✅
- ✅ Python test scripts (11 scripts, ~2,800 lines)
- ✅ SSC API validation results
- ✅ PLAN.md - High-level implementation plan
- ✅ TASKS.md - Detailed task breakdown
- ✅ DASHBOARD_SSC_VALIDATION.md - Element-by-element validation
- ✅ PHASE1_COMPLETE.md - Phase 1 summary
- ✅ PHASE1_CHECKLIST.md - Completion checklist
- ✅ scripts/TEST_RESULTS.md - Test results documentation
- ✅ scripts/README.md - Test scripts usage guide
- ✅ Sample JSON responses from SSC API

### Phase 2 (COMPLETE) ✅
- ✅ Node.js backend application (23 files, ~1,800 LOC)
- ✅ Express server with 29 REST API endpoints
- ✅ SSC API client with authentication
- ✅ In-memory cache with TTL management
- ✅ Background scheduler for auto-refresh
- ✅ Winston logger with daily rotation
- ✅ Error handler with stale cache fallback
- ✅ Data aggregation helpers (YoY, star ratings, version iteration)
- ✅ backend/README.md - Complete setup guide
- ✅ PHASE2_PLAN.md - Phase 2 implementation plan
- ✅ PHASE2_COMPLETE.md - Phase 2 completion summary
- ✅ PHASE3_PLAN.md - Phase 3 implementation plan

### Phase 3-5 (Pending)
- Real data integration for 29 endpoints
- Transformation logic implementation
- Filter query building
- Performance optimization
- Modified frontend HTML/JavaScript
- Frontend-to-backend integration
- Deployment guide
- Configuration guide
- Troubleshooting guide
- Performance test reports

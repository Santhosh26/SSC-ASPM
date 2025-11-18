# ASPM Dashboard Implementation Plan

## Executive Summary

Transform the static ASPM dashboard (`aspm_dashboard_otw.html`) into a fully functional system that pulls real-time data from Fortify Software Security Center (SSC). The solution uses a Node.js/Express backend for data aggregation and caching, with Python test scripts for initial API validation.

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

### Phase 1: SSC API Validation (1-2 days)
**Objective**: Validate all SSC API endpoints and document data structures

Create Python test scripts to:
- Test authentication with FortifyToken
- Validate each required API endpoint
- Document response structures and field mappings
- Test custom attribute filters
- Identify API limitations and edge cases
- Create sample data transformations

**Key Deliverable**: Working Python scripts that prove all required data can be extracted from SSC

### Phase 2: Backend Architecture (2-3 days)
**Objective**: Build Node.js backend with caching and scheduling

Components:
- Express server with structured API routes
- SSC API client with authentication
- In-memory cache with TTL management
- Background scheduler for periodic refresh
- Data transformation layer
- File-based logging (Winston)
- Error handling with cache fallback

**Key Deliverable**: Backend infrastructure ready to serve dashboard APIs

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
Aggregate issues across all versions with severity grouping:

```
SSC API: GET /api/v1/issues?q=removed:false&groupby=severity
Transformation: Count by severity level
Output: { critical: 16116, high: 24173, medium: 29546, low: 64464 }
```

### Example 3: Scan Coverage by Type
Calculate percentage of applications with each scan type:

```
SSC APIs:
  1. GET /api/v1/projects (total count)
  2. GET /api/v1/projectVersions (versions per project)
  3. GET /api/v1/artifacts (scan types per version)
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
3. **Aggregation**: Use SSC's `groupby` feature to reduce response size
4. **Selective Fields**: Use `fields` parameter to limit payload
5. **Response Compression**: Enable gzip on backend responses
6. **Frontend Lazy Load**: Load dashboard sections progressively

## Success Criteria

1. **Functionality**: All 21 dashboard metrics displaying real SSC data
2. **Performance**: < 2 second load time for full dashboard
3. **Accuracy**: Data matches SSC web UI (spot checked)
4. **Filtering**: All 4 filter dimensions working correctly
5. **Resilience**: Graceful degradation when SSC unavailable
6. **Refresh**: Auto-refresh working without user intervention
7. **Logging**: Error tracking and debugging capability

## Future Enhancements (Out of Scope)

- Historical data tracking for YoY comparisons
- Database for persistent caching
- User authentication and authorization
- Customizable refresh intervals per user
- Export to PDF/CSV functionality
- Email alerts for threshold breaches
- Mobile responsive design improvements
- Additional dashboard pages

## Timeline Estimate

- **Phase 1**: 1-2 days (Python API testing)
- **Phase 2**: 2-3 days (Backend architecture)
- **Phase 3**: 5-7 days (Data integration)
- **Phase 4**: 2-3 days (Frontend integration)
- **Phase 5**: 2 days (Deployment & testing)

**Total**: 12-17 days (2.5-3.5 weeks)

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| SSC API rate limiting | High | Implement caching, reduce refresh frequency |
| Custom attributes not properly configured | High | Validate in Phase 1, document setup requirements |
| Performance degradation with large dataset | Medium | Implement pagination, optimize queries |
| SSC API changes/deprecation | Medium | Abstract SSC client, version API calls |
| Memory exhaustion from cache | Medium | Implement LRU eviction, monitor memory |
| Incomplete data for some metrics | Low | Graceful fallbacks, show partial data |

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

### Code
- Python test scripts and results
- Node.js backend application
- Modified frontend HTML/JavaScript
- Configuration files

### Documentation
- API documentation (backend endpoints)
- Deployment guide
- Configuration guide
- Troubleshooting guide

### Testing
- API test results
- Performance test reports
- Filter validation results

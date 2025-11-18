# ASPM Dashboard - Detailed Task Breakdown

## Phase 1: SSC API Validation with Python Scripts

### Task 1.1: Setup Python Testing Environment
- [ ] Create `scripts/` directory
- [ ] Create `requirements.txt` with dependencies (requests, python-dotenv, tabulate)
- [ ] Create `.env` file with SSC credentials (from Fortify-ssc-credentials.txt)
- [ ] Install dependencies: `pip install -r requirements.txt`

### Task 1.2: Create Base SSC API Client
- [ ] Create `scripts/ssc_api_client.py`
- [ ] Implement authentication with FortifyToken header
- [ ] Implement base GET request function with error handling
- [ ] Test connection to SSC base URL
- [ ] Verify authentication works

### Task 1.3: Test Core Project/Version Endpoints
- [ ] Test `GET /api/v1/projects`
  - Document response structure
  - Check pagination limits
  - Save sample JSON to `scripts/samples/projects.json`
- [ ] Test `GET /api/v1/projectVersions`
  - Test with `embed=performanceIndicators,variables`
  - Test with custom field selection
  - Check for custom attributes (Business Unit, Criticality, App Type, SDLC)
  - Save sample to `scripts/samples/projectVersions.json`
- [ ] Test filtering by custom attributes
  - Filter by Business Unit
  - Filter by Criticality
  - Filter by SDLC Status
  - Confirm query syntax works

### Task 1.4: Test Issue/Vulnerability Endpoints
- [ ] Test `GET /api/v1/issues`
  - Test with `q=removed:false` (open issues)
  - Test with `groupby=severity`
  - Test with date range filters
  - Save sample to `scripts/samples/issues.json`
- [ ] Test `GET /api/v1/projectVersions/{id}/issues`
  - Test severity grouping
  - Test scan type filtering
  - Test production tag filtering
- [ ] Verify issue count accuracy vs SSC UI

### Task 1.5: Test Artifact/Scan Endpoints
- [ ] Test `GET /api/v1/artifacts`
  - Check scan type field
  - Check upload date
  - Save sample to `scripts/samples/artifacts.json`
- [ ] Test `GET /api/v1/projectVersions/{id}/artifacts`
  - Verify embedded scan data
  - Check LOC (lines of code) field
  - Check file count field
  - Identify SAST/DAST/SCA differentiation

### Task 1.6: Test Performance Indicator Endpoints
- [ ] Test `GET /api/v1/projectVersions/{id}/performanceIndicatorHistories`
  - Identify FortifySecurityRating field
  - Test value range (1.0 to 5.0)
  - Map to compliance status
  - Save sample to `scripts/samples/performanceIndicators.json`
- [ ] Document transformation logic for compliance

### Task 1.7: Test Additional Endpoints
- [ ] Test user/persona endpoints
- [ ] Test entitlement/license endpoints (if available)
- [ ] Test ScanCentral endpoints (if available)
- [ ] Document any missing/unavailable endpoints

### Task 1.8: Create Data Transformation Examples
- [ ] Create `scripts/transformations.py`
- [ ] Implement policy compliance transformation
- [ ] Implement severity distribution aggregation
- [ ] Implement scan coverage calculation
- [ ] Implement MTTR calculation example
- [ ] Test transformations with sample data

### Task 1.9: Create Comprehensive Test Script
- [ ] Create `scripts/test_all_endpoints.py`
- [ ] Test all required endpoints sequentially
- [ ] Generate summary report
- [ ] Save all samples to `scripts/samples/`
- [ ] Output success/failure for each endpoint

### Task 1.10: Document Findings
- [ ] Create `scripts/TEST_RESULTS.md`
- [ ] Document all working endpoints with examples
- [ ] Document required query parameters
- [ ] Document response field mappings
- [ ] Document any limitations or issues
- [ ] Document transformation logic for each metric
- [ ] Create endpoint-to-metric mapping table

---

## Phase 2: Node.js Backend Architecture

### Task 2.1: Initialize Node.js Project
- [ ] Create `backend/` directory
- [ ] Run `npm init -y`
- [ ] Create `.gitignore` for node_modules, logs, .env
- [ ] Create `backend/.env.example` with required variables
- [ ] Create `backend/README.md` with setup instructions

### Task 2.2: Install Dependencies
- [ ] Install Express: `npm install express`
- [ ] Install logging: `npm install winston winston-daily-rotate-file`
- [ ] Install HTTP client: `npm install axios`
- [ ] Install utilities: `npm install dotenv cors`
- [ ] Install dev dependencies: `npm install --save-dev nodemon`
- [ ] Configure npm scripts in package.json

### Task 2.3: Create Configuration System
- [ ] Create `backend/config/ssc-config.js`
  - SSC base URL
  - Authentication token
  - API version
  - Timeout settings
- [ ] Create `backend/config/cache-config.js`
  - TTL settings (5-15 minutes)
  - Memory limits
  - Refresh intervals
- [ ] Create `backend/config/logger-config.js`
  - Log levels
  - File rotation settings
  - Log directory

### Task 2.4: Create Logger Service
- [ ] Create `backend/services/logger.js`
- [ ] Configure Winston with daily rotate file
- [ ] Setup log levels (error, warn, info, debug)
- [ ] Create separate error log file
- [ ] Test logging functionality

### Task 2.5: Create SSC API Client
- [ ] Create `backend/services/ssc-client.js`
- [ ] Implement authentication header setup
- [ ] Implement base GET request method
- [ ] Implement request timeout handling
- [ ] Implement retry logic for transient failures
- [ ] Implement error handling and logging
- [ ] Add request/response logging (debug level)
- [ ] Test connection to SSC

### Task 2.6: Create Cache Manager
- [ ] Create `backend/services/cache-manager.js`
- [ ] Implement in-memory Map-based cache
- [ ] Implement cache key generation (metric + filters)
- [ ] Implement TTL checking
- [ ] Implement cache get/set/delete methods
- [ ] Implement cache statistics (hit/miss rates)
- [ ] Implement LRU eviction strategy
- [ ] Add cache monitoring/logging

### Task 2.7: Create Scheduler Service
- [ ] Create `backend/services/scheduler.js`
- [ ] Implement interval-based refresh (5-15 min configurable)
- [ ] Create refresh job for each metric type
- [ ] Implement parallel refresh for independent metrics
- [ ] Add error handling (don't crash on SSC failures)
- [ ] Log refresh cycle start/completion
- [ ] Track last successful refresh time

### Task 2.8: Create Express Server
- [ ] Create `backend/server.js`
- [ ] Setup Express app with middleware (cors, json)
- [ ] Configure error handling middleware
- [ ] Setup health check endpoint: `GET /health`
- [ ] Setup cache status endpoint: `GET /api/cache/status`
- [ ] Setup logging middleware for requests
- [ ] Configure graceful shutdown

### Task 2.9: Create Route Structure
- [ ] Create `backend/routes/program.js` (stub routes)
- [ ] Create `backend/routes/risk.js` (stub routes)
- [ ] Create `backend/routes/remediation.js` (stub routes)
- [ ] Create `backend/routes/filters.js`
- [ ] Register routes in server.js
- [ ] Test route accessibility

### Task 2.10: Create Base Data Aggregator
- [ ] Create `backend/services/data-aggregator.js`
- [ ] Implement helper for parallel API calls
- [ ] Implement helper for pagination handling
- [ ] Implement helper for query building (filters → SSC query)
- [ ] Implement helper for date range formatting
- [ ] Test aggregator helpers

---

## Phase 3: Data Integration - Program Dashboard

### Task 3.1: Program KPIs Endpoint
- [ ] Create `backend/transformers/program-transformer.js`
- [ ] Implement `/api/program/kpis` route
- [ ] Fetch projects count from `/api/v1/projects`
- [ ] Fetch versions count from `/api/v1/projectVersions`
- [ ] Fetch users count from `/api/v1/users`
- [ ] Aggregate LOC from artifacts
- [ ] Aggregate file counts from artifacts
- [ ] Count OSS components from SCA issues
- [ ] Apply filters to all queries
- [ ] Implement caching
- [ ] Test endpoint with/without filters

### Task 3.2: Coverage Metrics Endpoint
- [ ] Implement `/api/program/coverage` route
- [ ] Fetch all projects
- [ ] Fetch versions for each project
- [ ] Fetch artifacts per version
- [ ] Calculate SAST coverage percentage
- [ ] Calculate DAST coverage percentage
- [ ] Calculate SCA coverage percentage
- [ ] Calculate Other coverage percentage
- [ ] Apply filters
- [ ] Implement caching
- [ ] Test calculations accuracy

### Task 3.3: Scan Activity Trend Endpoint
- [ ] Implement `/api/program/scan-activity` route
- [ ] Fetch artifacts for last 12 months
- [ ] Group by month and scan type
- [ ] Count completed scans per month
- [ ] Format for chart consumption
- [ ] Apply filters
- [ ] Implement caching
- [ ] Test with different date ranges

### Task 3.4: Entitlements Endpoint
- [ ] Implement `/api/program/entitlements` route
- [ ] Fetch license/entitlement data
- [ ] Calculate consumed vs purchased
- [ ] Calculate percentage used
- [ ] Format response
- [ ] Implement caching
- [ ] Test endpoint

### Task 3.5: Technology Stack Endpoint
- [ ] Implement `/api/program/technology-stack` route
- [ ] Fetch project versions with technology attributes
- [ ] Parse engine types from artifacts
- [ ] Aggregate by language/technology
- [ ] Calculate percentages
- [ ] Apply filters
- [ ] Implement caching
- [ ] Test aggregation logic

### Task 3.6: ScanCentral Utilization Endpoint
- [ ] Implement `/api/program/scancentral` route
- [ ] Fetch ScanCentral pool data (if available)
- [ ] Calculate SAST sensor utilization
- [ ] Calculate DAST sensor utilization
- [ ] Format response
- [ ] Implement caching
- [ ] Test or create mock if endpoint unavailable

---

## Phase 3: Data Integration - Risk Exposure Dashboard

### Task 3.7: Policy Compliance Endpoint
- [ ] Create `backend/transformers/risk-transformer.js`
- [ ] Implement `/api/risk/compliance` route
- [ ] Fetch project versions with performance indicators
- [ ] Extract FortifySecurityRating values
- [ ] Transform: 5.0→Pass, 1.0→Fail, null→Unassessed
- [ ] Count each status
- [ ] Calculate percentages
- [ ] Apply filters
- [ ] Implement caching
- [ ] Test transformation logic

### Task 3.8: Star Ratings Endpoint
- [ ] Implement `/api/risk/star-ratings` route
- [ ] Fetch project versions with star ratings
- [ ] Group by rating (0-5 stars)
- [ ] Count versions per rating
- [ ] Calculate percentages
- [ ] Apply filters
- [ ] Implement caching
- [ ] Test distribution calculations

### Task 3.9: Open Issues Endpoint
- [ ] Implement `/api/risk/open-issues` route
- [ ] Fetch all open issues grouped by severity
- [ ] Fetch production-only issues (filter by tag/attribute)
- [ ] Count by severity for each environment
- [ ] Format response for both donut and bar charts
- [ ] Apply filters
- [ ] Implement caching
- [ ] Test severity grouping

### Task 3.10: Vulnerability Density Endpoint
- [ ] Implement `/api/risk/density` route
- [ ] Fetch total open issues count
- [ ] Fetch total active versions count
- [ ] Calculate issues per version (average)
- [ ] Apply filters
- [ ] Implement caching
- [ ] Test calculation

### Task 3.11: Detection Trend Endpoint
- [ ] Implement `/api/risk/detection-trend` route
- [ ] Fetch issues for last 12 months by foundDate
- [ ] Group by month and severity
- [ ] Count new issues per month
- [ ] Format for trend chart
- [ ] Apply filters
- [ ] Implement caching
- [ ] Test monthly aggregation

### Task 3.12: Prevalent Vulnerabilities Endpoint
- [ ] Implement `/api/risk/prevalent` route
- [ ] Fetch all open issues grouped by category (issueName)
- [ ] Count total per category
- [ ] Break down by severity within each category
- [ ] Count affected versions
- [ ] Sort by total count (descending)
- [ ] Return top 10-15 categories
- [ ] Apply filters
- [ ] Implement caching
- [ ] Test category aggregation

### Task 3.13: Aging Matrix Endpoint
- [ ] Implement `/api/risk/aging-matrix` route
- [ ] Fetch all open issues with foundDate
- [ ] Calculate age (current date - foundDate)
- [ ] Bucket into age ranges (<30d, 30-90d, 90-180d, 180-365d, >365d)
- [ ] Cross-tabulate with severity
- [ ] Format as matrix
- [ ] Apply filters
- [ ] Implement caching
- [ ] Test age calculations

### Task 3.14: Open Source Security Risk Endpoint
- [ ] Implement `/api/risk/opensource-security` route
- [ ] Fetch SCA issues (filter by scanType)
- [ ] Group by component name
- [ ] Identify vulnerable vs secure components
- [ ] Count each category
- [ ] Calculate percentages
- [ ] Apply filters
- [ ] Implement caching
- [ ] Test SCA data extraction

### Task 3.15: Open Source License Risk Endpoint
- [ ] Implement `/api/risk/opensource-licenses` route
- [ ] Fetch SCA component license data
- [ ] Classify licenses (Strong Copyleft, Weak, Permissive, Unknown)
- [ ] Count components per license type
- [ ] Calculate percentages
- [ ] Apply filters
- [ ] Implement caching
- [ ] Test license classification

---

## Phase 3: Data Integration - Remediation Dashboard

### Task 3.16: Remediation Rates Endpoint
- [ ] Create `backend/transformers/remediation-transformer.js`
- [ ] Implement `/api/remediation/rates` route
- [ ] Fetch total issues (open + closed) by severity
- [ ] Fetch closed issues by severity
- [ ] Calculate remediation rate per severity
- [ ] Calculate remediation rate per scan type
- [ ] Format percentages
- [ ] Apply filters
- [ ] Implement caching
- [ ] Test rate calculations

### Task 3.17: MTTR Endpoint
- [ ] Implement `/api/remediation/mttr` route
- [ ] Fetch closed issues with foundDate and removedDate
- [ ] Calculate time difference for each issue
- [ ] Calculate average MTTR overall
- [ ] Calculate average MTTR per severity
- [ ] Convert to days
- [ ] Apply filters
- [ ] Implement caching
- [ ] Test MTTR calculations

### Task 3.18: Remediation Trend Endpoint
- [ ] Implement `/api/remediation/trend` route
- [ ] Fetch issues closed in last 12 months
- [ ] Group by month (removedDate) and severity
- [ ] Count remediated issues per month
- [ ] Format for trend chart
- [ ] Apply filters
- [ ] Implement caching
- [ ] Test monthly aggregation

### Task 3.19: Review Metrics Endpoint
- [ ] Implement `/api/remediation/review-metrics` route
- [ ] Fetch issues with audit/review status
- [ ] Count reviewed vs total per severity
- [ ] Calculate review rates
- [ ] Fetch audit history for review timestamps
- [ ] Calculate mean time to review
- [ ] Apply filters
- [ ] Implement caching
- [ ] Test review calculations

### Task 3.20: Recurrence Endpoint
- [ ] Implement `/api/remediation/recurrence` route
- [ ] Fetch issues with reopened status (if available)
- [ ] Identify issues with multiple open/close cycles
- [ ] Count reopened vs permanently fixed
- [ ] Group reopened issues by category
- [ ] Calculate recurrence percentages
- [ ] Apply filters
- [ ] Implement caching
- [ ] Test recurrence tracking

### Task 3.21: Filters Metadata Endpoint
- [ ] Implement `/api/filters/metadata` route
- [ ] Fetch available custom attribute values from SSC
- [ ] Extract Business Unit options
- [ ] Extract Criticality options
- [ ] Extract Application Type options
- [ ] Extract SDLC Status options
- [ ] Format for frontend consumption
- [ ] Implement caching (longer TTL: 1 hour)
- [ ] Test metadata retrieval

---

## Phase 4: Frontend Integration

### Task 4.1: Create API Client Module
- [ ] Create `public/js/api-client.js`
- [ ] Implement base fetch wrapper with error handling
- [ ] Implement retry logic for failed requests
- [ ] Implement timeout handling
- [ ] Create methods for each backend endpoint
- [ ] Add request/response logging (console)
- [ ] Test API client standalone

### Task 4.2: Create Dashboard Data Manager
- [ ] Create `public/js/dashboard.js`
- [ ] Implement data fetching orchestration
- [ ] Implement auto-refresh scheduler
- [ ] Implement filter state management
- [ ] Implement loading state management
- [ ] Implement error state management
- [ ] Implement last-updated tracking
- [ ] Create event system for data updates

### Task 4.3: Update Program Dashboard
- [ ] Modify `aspm_dashboard_otw.html`
- [ ] Replace mock KPI data with API calls
- [ ] Update coverage metrics with real data
- [ ] Update scan activity chart with API data
- [ ] Update entitlements table with API data
- [ ] Update technology stack treemap with API data
- [ ] Update ScanCentral charts with API data
- [ ] Test all visualizations with real data

### Task 4.4: Update Risk Exposure Dashboard
- [ ] Replace compliance donut chart data
- [ ] Update star ratings chart data
- [ ] Update open issues charts (donut + bar)
- [ ] Update vulnerability density metric
- [ ] Update detection trend chart
- [ ] Update prevalent vulnerabilities table
- [ ] Update aging matrix heatmap
- [ ] Update open source risk charts (security + license)
- [ ] Test all visualizations

### Task 4.5: Update Remediation Dashboard
- [ ] Replace remediation rates charts
- [ ] Update MTTR metrics
- [ ] Update remediation trend chart
- [ ] Update review metrics charts
- [ ] Update recurrence donut chart
- [ ] Update most reopened vulnerabilities table
- [ ] Test all visualizations

### Task 4.6: Implement Filter Functionality
- [ ] Connect filter UI to dashboard.js
- [ ] Implement applyFilters() function
  - Collect selected filter values
  - Update API calls with filter parameters
  - Refresh all dashboard data
- [ ] Implement clearFilters() function
- [ ] Implement removeFilter() function
- [ ] Test filter application
- [ ] Test filter clearing
- [ ] Test filter combinations

### Task 4.7: Implement Auto-Refresh
- [ ] Create refresh timer (5-15 min configurable)
- [ ] Implement silent background refresh
- [ ] Update last-updated timestamp on each refresh
- [ ] Preserve filter state during refresh
- [ ] Don't interrupt user interactions
- [ ] Test auto-refresh behavior
- [ ] Add manual refresh button

### Task 4.8: Implement Loading States
- [ ] Create loading overlay/spinner component
- [ ] Show loading on initial page load
- [ ] Show loading during filter changes
- [ ] Show subtle indicator during auto-refresh
- [ ] Disable interactions during loading
- [ ] Test loading states

### Task 4.9: Implement Error Handling
- [ ] Create error banner component
- [ ] Show stale data warning when SSC unavailable
- [ ] Display last successful update time
- [ ] Show specific error messages for failures
- [ ] Implement retry button for failed requests
- [ ] Test error scenarios
- [ ] Test recovery from errors

### Task 4.10: Add Timestamp Display
- [ ] Add "Last updated" display in header
- [ ] Format timestamp user-friendly
- [ ] Update on each refresh
- [ ] Show different color for stale data
- [ ] Test timestamp updates

---

## Phase 5: Deployment & Testing

### Task 5.1: Create Deployment Package
- [ ] Create `DEPLOYMENT.md` documentation
- [ ] Document server requirements (Node.js version, memory)
- [ ] Document environment variables setup
- [ ] Create deployment script
- [ ] Create start/stop scripts
- [ ] Document firewall/network requirements
- [ ] Create health check documentation

### Task 5.2: Create API Documentation
- [ ] Create `API.md` file
- [ ] Document all backend endpoints
- [ ] Include request/response examples
- [ ] Document filter parameters
- [ ] Document error responses
- [ ] Include curl examples

### Task 5.3: Performance Testing
- [ ] Test initial load time (should be < 2 seconds)
- [ ] Test with 200+ applications
- [ ] Test with 100K+ issues
- [ ] Monitor memory usage during refresh cycles
- [ ] Identify and optimize slow endpoints
- [ ] Test concurrent user access
- [ ] Document performance results

### Task 5.4: Filter Testing
- [ ] Test each filter dimension individually
- [ ] Test multiple filter combinations
- [ ] Test filter with each dashboard page
- [ ] Verify filter counts are accurate
- [ ] Test filter clearing
- [ ] Test filter removal (individual tags)
- [ ] Document filter behavior

### Task 5.5: Error Scenario Testing
- [ ] Test with SSC completely unavailable
- [ ] Test with SSC returning partial data
- [ ] Test with invalid authentication
- [ ] Test with slow SSC responses
- [ ] Test with network interruptions
- [ ] Verify stale cache is served correctly
- [ ] Document error handling behavior

### Task 5.6: Auto-Refresh Testing
- [ ] Verify refresh runs at configured interval
- [ ] Verify data updates after refresh
- [ ] Verify filters persist during refresh
- [ ] Verify no memory leaks over multiple refreshes
- [ ] Test manual refresh button
- [ ] Document refresh behavior

### Task 5.7: Data Accuracy Validation
- [ ] Spot check KPI values against SSC UI
- [ ] Verify issue counts match SSC
- [ ] Verify compliance status calculations
- [ ] Verify filter results accuracy
- [ ] Verify trend data accuracy
- [ ] Document any discrepancies

### Task 5.8: Browser Compatibility Testing
- [ ] Test on Chrome
- [ ] Test on Firefox
- [ ] Test on Edge
- [ ] Test on Safari
- [ ] Document any browser-specific issues
- [ ] Fix critical compatibility issues

### Task 5.9: Create Deployment Checklist
- [ ] Create pre-deployment checklist
- [ ] Create deployment steps checklist
- [ ] Create post-deployment validation checklist
- [ ] Create rollback procedure
- [ ] Test deployment process

### Task 5.10: Production Deployment
- [ ] Deploy backend to internal server
- [ ] Deploy frontend to internal server
- [ ] Configure environment variables
- [ ] Start backend service
- [ ] Verify health check endpoint
- [ ] Verify dashboard loads
- [ ] Verify data is flowing
- [ ] Monitor logs for errors
- [ ] Document deployed URLs
- [ ] Notify stakeholders

---

## Ongoing Maintenance Tasks

### Task M.1: Monitoring Setup
- [ ] Setup log monitoring
- [ ] Setup error alerting
- [ ] Setup performance monitoring
- [ ] Create monitoring dashboard
- [ ] Document monitoring procedures

### Task M.2: Documentation Maintenance
- [ ] Create user guide
- [ ] Create troubleshooting guide
- [ ] Document common issues and solutions
- [ ] Create FAQ
- [ ] Document SSC API version compatibility

### Task M.3: Optimization
- [ ] Review and optimize slow queries
- [ ] Optimize cache strategy based on usage
- [ ] Review memory usage patterns
- [ ] Optimize payload sizes
- [ ] Document optimization results

---

## Task Dependencies

```
Phase 1 (Python Testing)
  ↓
Phase 2 (Backend Architecture)
  ↓
Phase 3 (Data Integration)
  ├→ Program Dashboard Tasks (3.1-3.6)
  ├→ Risk Dashboard Tasks (3.7-3.15)
  └→ Remediation Dashboard Tasks (3.16-3.21)
  ↓
Phase 4 (Frontend Integration)
  ↓
Phase 5 (Deployment & Testing)
  ↓
Ongoing Maintenance
```

## Estimated Hours per Phase

- **Phase 1**: 12-16 hours (Python testing)
- **Phase 2**: 16-24 hours (Backend architecture)
- **Phase 3**: 40-56 hours (Data integration - 21 endpoints)
- **Phase 4**: 16-24 hours (Frontend integration)
- **Phase 5**: 16 hours (Deployment & testing)

**Total Estimated Hours**: 100-136 hours (12.5-17 days)

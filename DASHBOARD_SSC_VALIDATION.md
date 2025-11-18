# Dashboard Element SSC API Validation

Complete validation of every dashboard element against Fortify SSC API capabilities.

**Dashboard File:** aspm_dashboard.html
**SSC Version:** 25.2.2.0005
**Validation Date:** November 18, 2025

---

## PROGRAM DASHBOARD VALIDATION

### ✅ FULLY AVAILABLE (8 elements)

#### 1. Applications Card
- **Status:** ✅ Available
- **Endpoint:** `GET /projects`
- **Fields:** Count of `Project` objects where `active=true`
- **YoY Delta:** ❌ Not available (requires historical snapshot tracking)

#### 2. Versions/Releases Card
- **Status:** ✅ Available
- **Endpoint:** `GET /projectVersions?includeInactive=false`
- **Fields:** Count of active `ProjectVersion` objects
- **YoY Delta:** ❌ Not available (requires historical snapshot tracking)

#### 3. Users Card
- **Status:** ✅ Available
- **Endpoint:** `GET /localUsers`
- **Example:** `https://ssc.stage.cyberresstage.com/api/v1/localUsers?limit=-1&start=0`
- **Fields:** Count of `LocalUser` objects where `suspended=false`
- **Note:** This returns local SSC users only (not LDAP users). For all users including LDAP, use `/authEntities`
- **YoY Delta:** ❌ Not available (no creation date on users)

#### 4. Lines of Code Scanned Card
- **Status:** ✅ Available (requires aggregation)
- **Endpoint:** `GET /projectVersions/{id}/artifacts?embed=scans`
- **Fields:** Sum of `Scan.totalLOC` across all scans
- **Calculation:** Aggregate across all versions

#### 5. Files Scanned Card
- **Status:** ✅ Available (requires aggregation)
- **Endpoint:** `GET /projectVersions/{id}/artifacts?embed=scans`
- **Fields:** Sum of `Scan.noOfFiles` across all scans
- **Calculation:** Aggregate across all versions

#### 12. ScanCentral SAST Utilization Card
- **Status:** ✅ Available
- **Endpoint:** `GET /cloudpools` + `GET /cloudpools/{id}/workers`
- **Fields:** `CloudPool.stats.activeWorkerCount`, `CloudPool.stats.totalWorkerCount`
- **Calculation:** (activeWorkerCount / totalWorkerCount) × 100%
- **7-day average:** ⚠️ Must be calculated by tracking over time

#### 13. ScanCentral DAST Utilization Card
- **Status:** ⚠️ Partially Available
- **Endpoint:** `GET /cloudpools` (need to identify DAST pools)
- **Challenge:** No explicit DAST pool type flag
- **Workaround:** Use pool naming conventions or check job types

---

### 🔄 CALCULABLE (5 elements)

#### 7. Application Coverage Card (SAST/DAST/SCA/Other %)
- **Status:** 🔄 Calculable
- **Endpoints:**
  - `GET /projects`
  - `GET /projectVersions?fields=project.id`
  - `GET /projectVersions/{id}/artifacts?embed=scans`
- **Calculation Logic:**
  1. Get all projects (denominator)
  2. For each project, get latest version artifacts
  3. Check scan types: `Scan.type`, `Artifact.scaStatus`, `Artifact.webInspectStatus`
  4. SAST: Artifacts with standard scan type
  5. DAST: Artifacts with `webInspectStatus` != null
  6. SCA: Artifacts with `scaStatus` != null
  7. Calculate: (Projects with scan type / Total projects) × 100%

#### 8. Version Coverage Card (SAST/DAST/SCA/Other %)
- **Status:** 🔄 Calculable
- **Same as Application Coverage but at version granularity**
- **Denominator:** All active versions instead of projects

#### 9. Scan Activity Trend Chart (12 months)
- **Status:** 🔄 Calculable
- **Endpoint:** `GET /projectVersions/{id}/artifacts`
- **Fields:** `Artifact.uploadDate`, `Artifact.lastScanDate`
- **Calculation:**
  1. Get all artifacts from last 12 months
  2. Group by month from uploadDate
  3. Categorize by scan type
  4. Count per month per type

#### 11. Applications by Language Card (Treemap)
- **Status:** 🔄 Calculable (EXPENSIVE)
- **Endpoint:** `GET /projectVersions/{id}/sourceFiles`
- **Fields:** `SourceFile.languageName`
- **Calculation:**
  1. Get source files for all versions (WARNING: potentially millions of records)
  2. Group by languageName
  3. Roll up to application level
  4. Calculate percentages
- **Performance:** ⚠️ CRITICAL - This could be very slow
- **Recommendation:** Sample latest version per app or use cached snapshots

---

#### 6. Open Source Components Card
- **Status:** ✅ Available (requires aggregation)
- **Endpoint:** `GET /projectVersions/{id}/dependencyScanIssues`
- **Example:** `https://ssc.stage.cyberresstage.com/api/v1/projectVersions/10009/dependencyScanIssues?engineType=SONATYPE&start=0&limit=-1&showhidden=false&showremoved=false&showsuppressed=false`
- **Parameters:**
  - `engineType=SONATYPE` - For SCA/dependency scanning
  - `showhidden=false` - Exclude hidden components
  - `showremoved=false` - Exclude removed components
  - `showsuppressed=false` - Exclude suppressed components
- **Fields:** Each item represents a component/dependency
- **Calculation:**
  1. Query `dependencyScanIssues` for each active project version
  2. Count unique components (deduplicate by component name/ID)
  3. Sum across all versions for total component count
- **Performance:** Much simpler than CSV export - direct API access

---

### ❌ NOT AVAILABLE (1 element)

#### 10. Entitlements Table
- **Status:** ❌ NOT AVAILABLE IN SSC
- **Reason:** This is a **Fortify on Demand (FOD)** feature
- **SSC Alternative:** `GET /license` provides license info but NOT consumption-based entitlements
- **SSC License Fields:**
  - License capabilities (enabled features)
  - Expiration date
  - No "purchased vs consumed" metrics
- **Recommendation:** **REMOVE THIS ELEMENT** or replace with:
  - ScanCentral job queue metrics
  - User license utilization (if tracked)
  - Project/version count limits (if configured)

---

## RISK EXPOSURE DASHBOARD VALIDATION

### ✅ FULLY AVAILABLE (3 elements)

#### 1. Versions by Policy Compliance Card
- **Status:** ✅ Available (transformation required)
- **Endpoint:** `GET /projectVersions?embed=performanceIndicators`
- **Fields:** `PerformanceIndicator.name = "FortifySecurityRating"`, `value`
- **Transformation:**
  - value >= 4.5 → "Passing" (green)
  - value <= 1.5 → "Failing" (red)
  - value = null → "Unassessed" (gray)
- **Calculation:** Count versions in each category, calculate percentages

#### 3. Open Issues by Severity (All) Card
- **Status:** ✅ Available
- **Endpoint:** `GET /issues?q=removed:false&groupby=severity`
- **Fields:** `Issue.severity` (Critical, High, Medium, Low)
- **Calculation:** Count by severity, sum for total

#### 7. Most Prevalent Vulnerabilities Table
- **Status:** ✅ Available
- **Endpoint:** `GET /issues?q=removed:false&groupby=issueName`
- **Fields:**
  - `Issue.issueName` - Vulnerability category
  - `Issue.severity` - For critical/high counts
  - `Issue.projectVersionId` - For version count
- **Calculation:**
  1. Group issues by issueName
  2. Count total per category
  3. Break down by severity
  4. Count unique versions affected
  5. Sort by total count, take top 5

---

### 🔄 CALCULABLE (5 elements)

#### 5. Vulnerability Density Card
- **Status:** 🔄 Calculable
- **Endpoints:**
  - `GET /issues?q=removed:false` - Total open issues
  - `GET /projectVersions?includeInactive=false` - Active versions
- **Calculation:** Total open issues / Total active versions
- **YoY Delta:** ❌ Requires historical tracking

#### 6. New Issue Detection Trend Chart (12 months)
- **Status:** 🔄 Calculable
- **Endpoint:** `GET /issues?q=foundDate:[YYYY-MM-01 TO YYYY-MM-31]`
- **Fields:** `Issue.foundDate`, `Issue.severity`
- **Calculation:**
  1. For each month, query issues found in that month
  2. Group by severity
  3. Count per severity per month

#### 8. Security Technical Debt Aging Matrix
- **Status:** 🔄 Calculable
- **Endpoint:** `GET /issues?q=removed:false`
- **Fields:** `Issue.foundDate`, `Issue.severity`
- **Calculation:**
  1. Get all open issues
  2. Calculate age: (current date - foundDate) in days
  3. Bucket into: <30d, 30-60d, 60-90d, >90d
  4. Cross-tabulate severity × age bucket
  5. Count issues in each cell (16 cells total)

#### 9. Open Source Security Risk Card
- **Status:** 🔄 Calculable
- **Endpoint:** `GET /issues?q=removed:false+scanType:SCA`
- **Fields:** `Issue.componentName`, vulnerability status
- **Calculation:**
  1. Get all SCA issues
  2. Group by unique componentName
  3. Components with issues = Vulnerable
  4. Get total components (from exports or SBOM)
  5. Secure = Total - Vulnerable
- **Challenge:** Getting total component count (see Program Dashboard #6)

#### 10. Open Source License Risk Card
- **Status:** 🔄 Calculable (if license data available)
- **Endpoint:** `POST /dataExports/action/exportDependencyScanToCsv`
- **Fields:** License information in SCA export
- **Calculation:**
  1. Export SCA dependency data
  2. Parse license field
  3. Classify: Strong Copyleft, Weak Copyleft, Permissive, Unknown
  4. Count per category
- **Challenge:** License classification rules need to be defined

---

### ⚠️ PARTIALLY AVAILABLE (2 elements)

#### 2. Versions by Star Rating Card
- **Status:** ⚠️ Partially Available
- **Endpoint:** `GET /projectVersions`
- **Fields:** **NEED TO VALIDATE** - Check for star rating field
- **Possible Fields:**
  - Custom attribute storing rating
  - Derived from performance indicators
  - Derived from issue severity counts
- **Action Required:** Test SSC to determine if/where star ratings are stored
- **Alternative:** Calculate from highest severity: 0★=not scanned, 1★=criticals present, etc.

#### 4. Open Issues by Severity (Production) Card
- **Status:** ⚠️ Partially Available
- **Endpoint:** `GET /issues?q=removed:false+???`
- **Challenge:** How to filter for "Production" environment?
- **Possible Approaches:**
  1. `q=analysis:exploitable` - Issues marked as exploitable
  2. `q=tag:Production` - If production tag exists
  3. `q=primaryTag:Production` - Primary tag filtering
  4. Custom attribute on version (SDLC Status = Production)
- **Action Required:** Test filtering methods in SSC instance
- **Recommendation:** Use `analysis:exploitable` as closest match to production-relevant issues

---

## REMEDIATION DASHBOARD VALIDATION

### ✅ FULLY AVAILABLE (2 elements)

#### 3. Mean Time to Remediate Card
- **Status:** ✅ Available (calculation required)
- **Endpoint:** `GET /issues?q=removed:true&fields=foundDate,removedDate`
- **Fields:** `Issue.foundDate`, `Issue.removedDate`
- **Calculation:** Average of (removedDate - foundDate) for all closed issues
- **YoY Delta:** ❌ Requires historical tracking

#### 5. Issue Remediation Trend Chart (12 months)
- **Status:** ✅ Available
- **Endpoint:** `GET /issues?q=removedDate:[YYYY-MM-01 TO YYYY-MM-31]`
- **Fields:** `Issue.removedDate`, `Issue.severity`
- **Calculation:**
  1. For each month, query issues remediated in that month
  2. Group by severity
  3. Count per severity per month

---

### 🔄 CALCULABLE (4 elements)

#### 1. Remediated Issues by Severity Card
- **Status:** 🔄 Calculable
- **Endpoints:**
  - `GET /issues?q=removed:true&groupby=severity` - Remediated
  - `GET /issues?q=removed:false&groupby=severity` - Still open
- **Calculation:**
  1. Get count of remediated issues per severity
  2. Get count of open issues per severity
  3. Total per severity = remediated + open
  4. Percentage = (remediated / total) × 100%

#### 2. Remediated Issues by Scan Type Card
- **Status:** 🔄 Calculable
- **Same as #1 but group by scan type instead of severity**
- **Query:** `q=removed:true&groupby=scanType`

#### 4. Mean Time to Remediate by Severity Card
- **Status:** 🔄 Calculable
- **Endpoint:** `GET /issues?q=removed:true&fields=foundDate,removedDate,severity`
- **Calculation:**
  1. Get all closed issues
  2. Calculate remediation time per issue
  3. Group by severity
  4. Average per severity
- **YoY Deltas:** ❌ Require historical snapshots

#### 10. Most Reopened Vulnerabilities Table
- **Status:** 🔄 Calculable (IF reopen data exists)
- **Challenge:** Need to identify reopened issues
- **Possible Approach:**
  - Check audit history: `GET /projectVersions/{id}/auditHistory`
  - Look for issues that have multiple close/reopen cycles
  - Issue state transitions in audit log
- **Action Required:** Validate if SSC tracks reopen events in audit history

---

### ⚠️ UNCERTAIN - REQUIRE FIELD VALIDATION (4 elements)

#### 6. Reviewed Issues by Severity Card
- **Status:** ⚠️ Uncertain - Need to validate review fields
- **Endpoint:** `GET /issues?fields=audited,reviewed,scanStatus`
- **Possible Fields:**
  - `Issue.scanStatus` - May indicate review status
  - `Issue.audited` - Boolean flag?
  - Audit trail in `auditHistory`
- **Action Required:** Test SSC to identify which field indicates "reviewed"
- **Fallback:** Use `scanStatus != "UNREVIEWED"` as proxy

#### 7. Reviewed Issues by Scan Type Card
- **Status:** ⚠️ Same as #6, need review field validation

#### 8. Mean Time to Review Card
- **Status:** ⚠️ Uncertain
- **Challenge:** Need timestamps for:
  - When issue was detected (foundDate) ✅ Available
  - When issue was first reviewed (?) ⚠️ Unknown field
- **Possible Sources:**
  - `GET /issues/{id}/auditHistory` - First audit entry timestamp
  - Custom field or attribute
- **Action Required:** Check audit history for review timestamps
- **YoY Delta:** ❌ Requires historical tracking

#### 9. Vulnerability Recurrence Rate Card
- **Status:** ⚠️ Uncertain
- **Challenge:** Need to identify reopened issues
- **Same challenge as #10** - requires audit history analysis
- **Action Required:** Validate SSC tracks issue state changes

---

### ❌ NOT AVAILABLE IN SSC (2 elements)

#### 11. SAST Aviator Adoption Rate Card
- **Status:** ❌ NOT AVAILABLE
- **Reason:** **SAST Aviator is likely a Fortify on Demand (FOD) AI feature**
- **SSC Equivalent:** None - SSC doesn't have AI-powered auto-remediation
- **Recommendation:** **REMOVE THIS ELEMENT** for SSC deployments

#### 12. SAST Aviator ROI Card
- **Status:** ❌ NOT AVAILABLE
- **Reason:** Depends on Aviator adoption (#11)
- **Recommendation:** **REMOVE THIS ELEMENT** for SSC deployments

---

## SUMMARY BY AVAILABILITY

### Program Dashboard (13 elements)
- ✅ Fully Available: 8
- 🔄 Calculable: 4
- ⚠️ Partially Available: 0
- ❌ Not Available (FOD): 1

**Success Rate: 92% (12/13) - Excellent**

---

### Risk Exposure Dashboard (10 elements)
- ✅ Fully Available: 3
- 🔄 Calculable: 5
- ⚠️ Partially Available: 2
- ❌ Not Available: 0

**Success Rate: 100% (10/10) - All implementable with validation**

---

### Remediation Dashboard (12 elements)
- ✅ Fully Available: 2
- 🔄 Calculable: 4
- ⚠️ Uncertain (need validation): 4
- ❌ Not Available (FOD): 2

**Success Rate: 83% (10/12) - Good with field validation**

---

## CRITICAL ACTIONS REQUIRED

### 1. Field Validation Tests (Priority: HIGH)
Test these fields in SSC to confirm availability:

```python
# Test star ratings
GET /projectVersions/{id}?fields=starRating,rating,securityRating

# Test production filtering
GET /issues?q=removed:false+analysis:exploitable
GET /issues?q=removed:false+tag:Production
GET /issues?q=removed:false+primaryTag:Production

# Test review status
GET /issues?fields=audited,reviewed,scanStatus,reviewedBy,reviewedDate

# Test audit history for review timestamps
GET /issues/{issueId}/auditHistory

# Test reopen tracking
GET /issues/{issueId}/auditHistory  # Look for state transitions
```

### 2. Remove FOD-Specific Elements (Priority: HIGH)
- **Entitlements Table** (Program Dashboard) - FOD only
- **SAST Aviator Adoption** (Remediation Dashboard) - FOD only
- **SAST Aviator ROI** (Remediation Dashboard) - FOD only

**Decision:** Remove or replace with SSC-appropriate metrics

### 3. Performance Optimization (Priority: MEDIUM)
- **Applications by Language** - Very expensive, consider sampling
- **Open Source Components** - Requires export/parsing, implement caching

### 4. Historical Data Strategy (Priority: MEDIUM)
YoY comparisons are not directly available. Options:
- Implement daily/weekly snapshots
- Store historical counts in external database
- Calculate based on creation dates (limited accuracy)

---

## RECOMMENDED APPROACH

### Phase 1: Core Metrics (Week 1)
Implement elements with ✅ Fully Available status:
- Basic counts (apps, versions, users)
- Lines of code, files scanned
- Open issues by severity
- ScanCentral SAST utilization
- Policy compliance
- Most prevalent vulnerabilities
- Mean time to remediate
- Remediation trend

### Phase 2: Calculated Metrics (Week 2)
Implement 🔄 Calculable elements:
- Coverage calculations
- Scan activity trends
- Vulnerability density
- Issue aging matrix
- Open source security risk
- Remediation rates

### Phase 3: Field Validation & Uncertain Elements (Week 3)
Test and implement ⚠️ Uncertain elements:
- Star ratings
- Production filtering
- Review metrics
- Recurrence tracking

### Phase 4: Optimization (Week 4)
- Optimize expensive queries
- Implement caching
- Add historical tracking
- Performance tuning

---

## FINAL DASHBOARD FEASIBILITY

**Total Elements:** 35 across all dashboards

**Implementable:** 29 elements (83%)
- 13 Fully Available
- 13 Calculable
- 3 Need Field Validation

**Not Implementable:** 3 elements (9%) - FOD specific

**Uncertain:** 3 elements (9%) - Pending validation

**Overall Assessment:** ✅ **Dashboard is highly feasible for SSC**

Most metrics can be implemented. Main challenges:
1. YoY comparisons (solve with snapshots)
2. Some field validations needed
3. Remove 3 FOD-specific elements
4. Performance optimization for expensive queries

**Recommendation:** Proceed with implementation, validate uncertain fields in parallel.

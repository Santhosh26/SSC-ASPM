# SSC API Test Scripts

Python test scripts for validating Fortify SSC API endpoints and data transformations.

## Setup

1. **Install Python 3.8+**

2. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure Environment**:
   The `.env` file is already configured with SSC credentials from `Fortify-ssc-credentials.txt`.
   ```
   SSC_URL=https://ssc.stage.cyberresstage.com/api/v1
   SSC_TOKEN=NTEyMTRkMGMtMjc1My00YmRkLTgyOTEtNzdiZjllNDY5MmU0
   ```

## Test Scripts

### Individual Test Modules

1. **test_projects_versions.py** - Tests project and version endpoints
   ```bash
   python test_projects_versions.py
   ```
   - GET /projects
   - GET /projectVersions
   - Custom attribute filtering
   - Performance indicators

2. **test_issues.py** - Tests issue and vulnerability endpoints
   ```bash
   python test_issues.py
   ```
   - GET /issues
   - Severity grouping
   - Scan type filtering
   - Date range filtering
   - Category grouping

3. **test_artifacts_scans.py** - Tests artifact and scan endpoints
   ```bash
   python test_artifacts_scans.py
   ```
   - GET /artifacts
   - GET /projectVersions/{id}/artifacts
   - Scan coverage calculation
   - LOC and file metrics

4. **transformations.py** - Data transformation examples
   ```bash
   python transformations.py
   ```
   - Policy compliance transformation
   - Severity distribution
   - Scan coverage calculation
   - MTTR calculation
   - Top vulnerabilities aggregation

### Comprehensive Test Suite

Run all tests at once:
```bash
python test_all_endpoints.py
```

This will:
- Test connection to SSC
- Run all individual test modules
- Run transformation examples
- Generate comprehensive report
- Save sample JSON files to `samples/` directory

## Output Files

All test scripts save sample JSON responses to `samples/`:
- `projects.json`
- `projectVersions.json`
- `issues_all_open.json`
- `issues_by_severity.json`
- `artifacts.json`
- And more...

## Base Client

**ssc_api_client.py** - Reusable SSC API client

Features:
- FortifyToken authentication
- Error handling and retries
- Response parsing
- Sample data saving
- Connection testing

Can be imported and used in other scripts:
```python
from ssc_api_client import SSCApiClient

client = SSCApiClient()
response = client.get('/projects', params={'limit': 10})
```

## Expected Test Results

✅ **Should Pass:**
- Connection test
- Get projects
- Get project versions
- Get issues
- Get artifacts
- Performance indicators
- Custom attributes

⚠️ **May Fail:**
- Some custom attribute filters (if not configured in SSC)
- Production-only issues (if tags not configured)
- ScanCentral metrics (if not available)

## Troubleshooting

### Connection Failed
- Check SSC_URL and SSC_TOKEN in `.env`
- Verify SSC server is accessible
- Check network/firewall

### No Data Returned
- SSC instance may be empty
- Adjust query parameters
- Check SSC permissions for the token

### Import Errors
- Ensure you're in the `scripts/` directory
- Install requirements: `pip install -r requirements.txt`

## Next Steps

After successful testing:
1. Review sample JSON files in `samples/`
2. Document findings in `TEST_RESULTS.md`
3. Proceed to Phase 2: Node.js backend development

"""
Test SSC API - Issues and Vulnerabilities Endpoints
Tests endpoints for retrieving and analyzing security issues
"""

from ssc_api_client import SSCApiClient
from tabulate import tabulate
from datetime import datetime, timedelta


def test_all_issues(client: SSCApiClient):
    """Test /issues endpoint - get all issues"""
    print("\n" + "="*80)
    print("TEST: GET /issues (All Open Issues)")
    print("="*80)

    try:
        response = client.get('/issues', params={
            'q': 'removed:false',  # Only open issues
            'start': 0,
            'limit': 100,
            'fields': 'id,issueName,severity,friority,foundDate,removedDate,scanStatus,primaryTag'
        })

        client.print_response_summary(response, "All Open Issues")

        if 'data' in response and response['data']:
            client.save_sample('issues_all_open.json', response)

            # Analyze severity distribution
            issues = response['data']
            severity_counts = {}
            for issue in issues:
                severity = issue.get('severity', 'Unknown')
                severity_counts[severity] = severity_counts.get(severity, 0) + 1

            print("Severity Distribution (from sample):")
            for severity, count in sorted(severity_counts.items()):
                print(f"  {severity}: {count}")

            # Show first 10 issues
            table_data = []
            for issue in issues[:10]:
                table_data.append([
                    issue.get('id'),
                    issue.get('issueName', 'N/A')[:40],
                    issue.get('severity', 'N/A'),
                    issue.get('friority', 'N/A'),
                    issue.get('foundDate', 'N/A')[:10],
                    issue.get('scanStatus', 'N/A')
                ])

            print("\nFirst 10 Open Issues:")
            print(tabulate(table_data,
                         headers=['ID', 'Issue Name', 'Severity', 'Friority', 'Found Date', 'Status'],
                         tablefmt='grid'))

            return True, response.get('totalCount', 0)
        else:
            print("⚠️  No issues found")
            return False, 0

    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
        return False, 0


def test_issues_grouped_by_severity(client: SSCApiClient):
    """Test /issues with severity grouping"""
    print("\n" + "="*80)
    print("TEST: GET /issues Grouped by Severity")
    print("="*80)

    try:
        response = client.get('/issues', params={
            'q': 'removed:false',
            'groupby': 'severity',
            'start': 0,
            'limit': 50
        })

        client.print_response_summary(response, "Issues Grouped by Severity")

        if 'data' in response:
            # Count issues by severity
            severity_distribution = {}
            for issue in response['data']:
                severity = issue.get('severity', 'Unknown')
                severity_distribution[severity] = severity_distribution.get(severity, 0) + 1

            # Print distribution table
            table_data = [[sev, count] for sev, count in sorted(severity_distribution.items())]
            print("\nSeverity Distribution:")
            print(tabulate(table_data, headers=['Severity', 'Count'], tablefmt='grid'))

            client.save_sample('issues_by_severity.json', response)

            return True
        else:
            print("⚠️  No data in response")
            return False

    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
        return False


def test_issues_by_scan_type(client: SSCApiClient):
    """Test filtering issues by scan type"""
    print("\n" + "="*80)
    print("TEST: GET /issues by Scan Type (SAST, DAST, SCA)")
    print("="*80)

    scan_types = ['SAST', 'DAST', 'SCA']
    results = []

    for scan_type in scan_types:
        print(f"\n📋 Testing {scan_type} issues...")

        try:
            response = client.get('/issues', params={
                'q': f'removed:false+scanType:{scan_type}',
                'limit': 10
            })

            if 'data' in response:
                count = response.get('totalCount', 0)
                print(f"   ✅ Found {count} {scan_type} issues")
                results.append((scan_type, True, count))
            else:
                print(f"   ⚠️  No data in response")
                results.append((scan_type, False, 0))

        except Exception as e:
            print(f"   ❌ Failed: {str(e)}")
            results.append((scan_type, False, 0))

    # Print summary
    print("\n\nScan Type Issues Summary:")
    print(tabulate(
        results,
        headers=['Scan Type', 'Status', 'Count'],
        tablefmt='grid'
    ))

    return all(r[1] for r in results)


def test_project_version_issues(client: SSCApiClient, version_id: int):
    """Test /projectVersions/{id}/issues endpoint"""
    print("\n" + "="*80)
    print(f"TEST: GET /projectVersions/{version_id}/issues")
    print("="*80)

    try:
        response = client.get(f'/projectVersions/{version_id}/issues', params={
            'q': 'removed:false',
            'start': 0,
            'limit': 50,
            'fields': 'id,issueName,severity,friority,foundDate,scanStatus,primaryTag,likelihood,impact'
        })

        client.print_response_summary(response, f"Issues for Version {version_id}")

        if 'data' in response and response['data']:
            issues = response['data']

            # Analyze by severity
            severity_counts = {}
            category_counts = {}

            for issue in issues:
                severity = issue.get('severity', 'Unknown')
                severity_counts[severity] = severity_counts.get(severity, 0) + 1

                category = issue.get('issueName', 'Unknown')
                category_counts[category] = category_counts.get(category, 0) + 1

            # Print severity breakdown
            print("\nSeverity Breakdown:")
            table_data = [[sev, count] for sev, count in sorted(severity_counts.items())]
            print(tabulate(table_data, headers=['Severity', 'Count'], tablefmt='grid'))

            # Print top vulnerability categories
            print("\nTop 5 Vulnerability Categories:")
            top_categories = sorted(category_counts.items(), key=lambda x: x[1], reverse=True)[:5]
            print(tabulate(top_categories, headers=['Category', 'Count'], tablefmt='grid'))

            client.save_sample(f'projectVersion_{version_id}_issues.json', response)

            return True, response.get('totalCount', 0)
        else:
            print("⚠️  No issues found for this version")
            return False, 0

    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
        return False, 0


def test_issues_date_filters(client: SSCApiClient):
    """Test date range filtering for issues"""
    print("\n" + "="*80)
    print("TEST: GET /issues with Date Range Filters")
    print("="*80)

    # Test different date ranges
    today = datetime.now()
    last_30_days = (today - timedelta(days=30)).strftime('%Y-%m-%d')
    last_90_days = (today - timedelta(days=90)).strftime('%Y-%m-%d')

    date_tests = [
        {
            'name': 'Issues found in last 30 days',
            'query': f'removed:false+foundDate:[{last_30_days} TO *]'
        },
        {
            'name': 'Issues found in last 90 days',
            'query': f'removed:false+foundDate:[{last_90_days} TO *]'
        },
        {
            'name': 'Remediated issues in last 30 days',
            'query': f'removed:true+removedDate:[{last_30_days} TO *]'
        }
    ]

    results = []

    for test in date_tests:
        print(f"\n📋 {test['name']}")

        try:
            response = client.get('/issues', params={
                'q': test['query'],
                'limit': 10
            })

            if 'data' in response:
                count = response.get('totalCount', 0)
                print(f"   ✅ Found {count} issues")
                results.append((test['name'], True, count))
            else:
                print(f"   ⚠️  No data in response")
                results.append((test['name'], False, 0))

        except Exception as e:
            print(f"   ❌ Failed: {str(e)}")
            results.append((test['name'], False, 0))

    # Print summary
    print("\n\nDate Filter Tests Summary:")
    print(tabulate(
        [[r[0], '✅' if r[1] else '❌', r[2]] for r in results],
        headers=['Test', 'Status', 'Count'],
        tablefmt='grid'
    ))

    return all(r[1] for r in results)


def test_issues_by_category(client: SSCApiClient):
    """Test grouping issues by category (issueName)"""
    print("\n" + "="*80)
    print("TEST: GET /issues Grouped by Category")
    print("="*80)

    try:
        response = client.get('/issues', params={
            'q': 'removed:false',
            'groupby': 'issueName',
            'limit': 100
        })

        if 'data' in response:
            # Count by category
            category_counts = {}
            for issue in response['data']:
                category = issue.get('issueName', 'Unknown')
                category_counts[category] = category_counts.get(category, 0) + 1

            # Get top 10 categories
            top_categories = sorted(category_counts.items(), key=lambda x: x[1], reverse=True)[:10]

            print("\nTop 10 Vulnerability Categories:")
            print(tabulate(top_categories, headers=['Category', 'Count'], tablefmt='grid'))

            client.save_sample('issues_by_category.json', response)

            return True
        else:
            print("⚠️  No data in response")
            return False

    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
        return False


def test_production_issues(client: SSCApiClient):
    """Test filtering for production-only issues"""
    print("\n" + "="*80)
    print("TEST: GET /issues (Production Only)")
    print("="*80)

    # Try different production filters
    production_filters = [
        'removed:false+analysis:exploitable',
        'removed:false+tag:Production',
        'removed:false+primaryTag:Production'
    ]

    for i, query in enumerate(production_filters, 1):
        print(f"\n📋 Attempt {i}: {query}")

        try:
            response = client.get('/issues', params={
                'q': query,
                'limit': 10
            })

            if 'data' in response:
                count = response.get('totalCount', 0)
                print(f"   ✅ Found {count} production issues")

                if count > 0 and response['data']:
                    # Show severity distribution
                    severity_counts = {}
                    for issue in response['data']:
                        severity = issue.get('severity', 'Unknown')
                        severity_counts[severity] = severity_counts.get(severity, 0) + 1

                    print("   Severity breakdown:")
                    for sev, cnt in sorted(severity_counts.items()):
                        print(f"     {sev}: {cnt}")

                    client.save_sample('issues_production.json', response)
                    return True

        except Exception as e:
            print(f"   ⚠️  Query failed: {str(e)}")

    print("\n⚠️  Could not retrieve production issues with any filter")
    return False


def main():
    """Run all issue tests"""
    print("\n" + "🔬"*40)
    print("FORTIFY SSC API TESTING: Issues & Vulnerabilities")
    print("🔬"*40 + "\n")

    try:
        # Initialize client
        client = SSCApiClient()

        # Test connection
        if not client.test_connection():
            print("❌ Cannot proceed with tests - connection failed")
            return

        # Run tests
        print("\n\n" + "🧪"*40)
        print("STARTING TESTS")
        print("🧪"*40)

        test_results = []

        # Test 1: All open issues
        success, total_issues = test_all_issues(client)
        test_results.append(("Get All Open Issues", success, f"{total_issues} issues"))

        # Test 2: Issues grouped by severity
        success = test_issues_grouped_by_severity(client)
        test_results.append(("Group by Severity", success, "Severity grouping"))

        # Test 3: Issues by scan type
        success = test_issues_by_scan_type(client)
        test_results.append(("Filter by Scan Type", success, "SAST/DAST/SCA"))

        # Test 4: Issues by category
        success = test_issues_by_category(client)
        test_results.append(("Group by Category", success, "Vulnerability categories"))

        # Test 5: Date range filters
        success = test_issues_date_filters(client)
        test_results.append(("Date Range Filters", success, "30/90 day ranges"))

        # Test 6: Production issues
        success = test_production_issues(client)
        test_results.append(("Production Issues", success, "Exploitable/Tagged"))

        # Test 7: Project version issues (get first version with issues)
        response = client.get('/projectVersions', params={
            'q': 'issueCount:>0',
            'limit': 1
        })
        if 'data' in response and response['data']:
            version_id = response['data'][0]['id']
            success, issue_count = test_project_version_issues(client, version_id)
            test_results.append(("Get Version Issues", success, f"Version {version_id}: {issue_count} issues"))

        # Print final summary
        print("\n\n" + "="*80)
        print("TEST SUMMARY")
        print("="*80)
        print(tabulate(
            [[r[0], '✅ PASS' if r[1] else '❌ FAIL', r[2]] for r in test_results],
            headers=['Test', 'Result', 'Details'],
            tablefmt='grid'
        ))

        passed = sum(1 for r in test_results if r[1])
        total = len(test_results)
        print(f"\nTests Passed: {passed}/{total}")

        if passed == total:
            print("✅ All tests passed!")
        else:
            print(f"⚠️  {total - passed} test(s) failed")

    except Exception as e:
        print(f"\n❌ Test suite failed: {str(e)}")


if __name__ == "__main__":
    main()

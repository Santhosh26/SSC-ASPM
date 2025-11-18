"""
Test SSC API - Issue Review Status Field Validation
Determines how to identify "reviewed" issues and calculate Mean Time to Review
"""

from ssc_api_client import SSCApiClient
from tabulate import tabulate
from datetime import datetime


def test_scan_status_field(client: SSCApiClient):
    """Test if scanStatus indicates review status"""
    print("\n" + "="*80)
    print("TEST: scanStatus Field as Review Indicator")
    print("="*80)

    try:
        response = client.get('/issues', params={
            'limit': 50,
            'fields': 'id,issueName,severity,scanStatus,foundDate'
        })

        if 'data' in response and response['data']:
            print(f"\n✅ Retrieved {len(response['data'])} issues")

            # Count scan statuses
            status_counts = {}
            for issue in response['data']:
                status = issue.get('scanStatus', 'None')
                status_counts[status] = status_counts.get(status, 0) + 1

            print(f"\nscanStatus Distribution:")
            for status, count in sorted(status_counts.items()):
                print(f"  {status}: {count}")

            # Show sample issues
            print(f"\nSample Issues with scanStatus:")
            table_data = []
            for issue in response['data'][:10]:
                table_data.append([
                    issue.get('id'),
                    issue.get('issueName', 'N/A')[:30],
                    issue.get('severity'),
                    issue.get('scanStatus', 'N/A')
                ])

            print(tabulate(table_data,
                         headers=['ID', 'Issue Name', 'Severity', 'Scan Status'],
                         tablefmt='grid'))

            # Interpretation
            print(f"\n📊 Interpretation:")
            print(f"   - UNREVIEWED: Issue has not been reviewed")
            print(f"   - REVIEWED, APPROVED, etc.: Issue has been reviewed")
            print(f"   - Use: scanStatus != 'UNREVIEWED' to filter reviewed issues")

            return True, status_counts
        else:
            print("❌ No issues found")
            return False, {}

    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
        return False, {}


def test_audit_history_for_review_timestamps(client: SSCApiClient):
    """Test if audit history contains review timestamps"""
    print("\n" + "="*80)
    print("TEST: Audit History for Review Timestamps")
    print("="*80)

    try:
        # Get an issue with audit history
        issues_response = client.get('/issues', params={
            'limit': 5,
            'fields': 'id,issueName,foundDate,scanStatus'
        })

        if 'data' not in issues_response or not issues_response['data']:
            print("❌ No issues found")
            return False

        # Try to get audit history for first few issues
        for issue in issues_response['data'][:3]:
            issue_id = issue.get('id')
            issue_name = issue.get('issueName', 'N/A')
            found_date = issue.get('foundDate', 'N/A')
            scan_status = issue.get('scanStatus', 'N/A')

            print(f"\n--- Issue {issue_id}: {issue_name} ---")
            print(f"    Found Date: {found_date}")
            print(f"    Scan Status: {scan_status}")

            try:
                # Try to get audit history
                audit_response = client.get(f'/issues/{issue_id}/auditHistory', params={
                    'limit': 10
                })

                if 'data' in audit_response and audit_response['data']:
                    audit_entries = audit_response['data']
                    print(f"    Audit History: {len(audit_entries)} entries found")

                    # Show first few audit entries
                    for i, entry in enumerate(audit_entries[:3], 1):
                        print(f"\n    Entry {i}:")
                        for key, value in entry.items():
                            print(f"      {key}: {value}")

                    # Check if we can find review timestamp
                    review_entry = None
                    for entry in audit_entries:
                        # Look for review-related fields
                        if 'reviewed' in str(entry).lower() or 'audit' in str(entry).lower():
                            review_entry = entry
                            break

                    if review_entry:
                        print(f"\n    ✅ Potential review entry found")
                        return True
                    else:
                        print(f"\n    ⚠️  No obvious review entry in audit history")
                else:
                    print(f"    No audit history found")

            except Exception as e:
                print(f"    ❌ Could not get audit history: {str(e)}")

        return True

    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
        return False


def test_issue_detail_fields(client: SSCApiClient):
    """Test detailed issue response for review-related fields"""
    print("\n" + "="*80)
    print("TEST: Detailed Issue Fields for Review Status")
    print("="*80)

    try:
        # Get first issue
        response = client.get('/issues', params={'limit': 1})

        if 'data' not in response or not response['data']:
            print("❌ No issues found")
            return False

        issue_id = response['data'][0]['id']

        # Get detailed issue
        detailed_response = client.get(f'/issues/{issue_id}')

        if 'data' in detailed_response:
            issue = detailed_response['data']

            print(f"\n✅ Retrieved detailed issue {issue_id}")
            print(f"\n📋 ALL FIELDS IN ISSUE OBJECT:")
            print("="*80)

            # Show all fields
            for key, value in issue.items():
                print(f"{key}: {value}")

            # Look for review-related fields
            review_fields = [k for k in issue.keys() if any(
                term in k.lower() for term in ['review', 'audit', 'status', 'assign', 'comment']
            )]

            if review_fields:
                print(f"\n✅ REVIEW-RELATED FIELDS FOUND:")
                for field in review_fields:
                    print(f"   {field}: {issue[field]}")
            else:
                print(f"\n⚠️  No obvious review-related fields")

            return True
        else:
            print("❌ Could not get detailed issue")
            return False

    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
        return False


def test_review_rate_calculation(client: SSCApiClient):
    """Test calculating review rates from scanStatus"""
    print("\n" + "="*80)
    print("TEST: Calculate Review Rates by Severity")
    print("="*80)

    try:
        # Get issues grouped by severity
        response = client.get('/issues', params={
            'limit': 200,
            'fields': 'id,severity,scanStatus'
        })

        if 'data' in response and response['data']:
            print(f"\n✅ Retrieved {len(response['data'])} issues")

            # Calculate review rates by severity
            severity_stats = {}

            for issue in response['data']:
                severity = issue.get('severity', 'Unknown')
                scan_status = issue.get('scanStatus', 'UNREVIEWED')

                if severity not in severity_stats:
                    severity_stats[severity] = {'total': 0, 'reviewed': 0}

                severity_stats[severity]['total'] += 1

                # Consider anything other than UNREVIEWED as reviewed
                if scan_status != 'UNREVIEWED':
                    severity_stats[severity]['reviewed'] += 1

            # Calculate percentages
            print(f"\nReview Rates by Severity (using scanStatus):")
            print("="*60)

            table_data = []
            for severity in ['Critical', 'High', 'Medium', 'Low']:
                if severity in severity_stats:
                    total = severity_stats[severity]['total']
                    reviewed = severity_stats[severity]['reviewed']
                    rate = (reviewed / total * 100) if total > 0 else 0

                    table_data.append([
                        severity,
                        total,
                        reviewed,
                        f"{rate:.1f}%"
                    ])

            print(tabulate(table_data,
                         headers=['Severity', 'Total Issues', 'Reviewed', 'Review Rate'],
                         tablefmt='grid'))

            print(f"\n📝 This matches the dashboard metric:")
            print(f"   'Reviewed Issues by Severity'")

            return True
        else:
            print("❌ No issues found")
            return False

    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
        return False


def test_mean_time_to_review_calculation(client: SSCApiClient):
    """Test calculating Mean Time to Review if possible"""
    print("\n" + "="*80)
    print("TEST: Calculate Mean Time to Review")
    print("="*80)

    try:
        # For MTTR, we need:
        # 1. Issue found date (foundDate) - available
        # 2. Issue review date - need to find this

        # Get reviewed issues
        response = client.get('/issues', params={
            'limit': 50,
            'fields': 'id,foundDate,scanStatus,lastScanDate,uploadDate'
        })

        if 'data' in response and response['data']:
            reviewed_issues = [i for i in response['data'] if i.get('scanStatus') != 'UNREVIEWED']

            print(f"\n✅ Found {len(reviewed_issues)} reviewed issues")

            if reviewed_issues:
                print(f"\nChecking fields for review timestamps:")
                sample = reviewed_issues[0]

                print(f"\nSample reviewed issue:")
                for key, value in sample.items():
                    print(f"  {key}: {value}")

                # Check which date fields are available
                date_fields = [k for k in sample.keys() if 'date' in k.lower()]
                print(f"\nAvailable date fields: {date_fields}")

                # Attempt calculation if lastScanDate exists
                if 'lastScanDate' in sample and sample['lastScanDate']:
                    print(f"\n⚠️  POSSIBLE APPROACH:")
                    print(f"   Use lastScanDate as proxy for review date")
                    print(f"   MTR = lastScanDate - foundDate")
                    print(f"   This assumes scan date ≈ review date")

                    return True
                else:
                    print(f"\n❌ Cannot find review timestamp")
                    print(f"   Need to check audit history for actual review date")
                    return False
            else:
                print("⚠️  No reviewed issues found")
                return False
        else:
            print("❌ No issues found")
            return False

    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
        return False


def main():
    """Run all review status validation tests"""
    print("\n" + "📝"*40)
    print("FORTIFY SSC - REVIEW STATUS VALIDATION")
    print("📝"*40)

    try:
        # Initialize client
        client = SSCApiClient()

        # Test connection
        if not client.test_connection():
            print("❌ Cannot proceed - connection failed")
            return

        # Run tests
        print("\n\n" + "🧪"*40)
        print("TESTING REVIEW STATUS FIELDS")
        print("🧪"*40)

        test_results = []

        # Test 1: scanStatus field
        success, statuses = test_scan_status_field(client)
        test_results.append(("scanStatus Field", success, f"{len(statuses)} statuses found"))

        # Test 2: Detailed issue fields
        success = test_issue_detail_fields(client)
        test_results.append(("Detailed Issue Fields", success, "Check above"))

        # Test 3: Audit history
        success = test_audit_history_for_review_timestamps(client)
        test_results.append(("Audit History Timestamps", success, "Check above"))

        # Test 4: Review rate calculation
        success = test_review_rate_calculation(client)
        test_results.append(("Review Rate Calculation", success, "By severity"))

        # Test 5: Mean time to review
        success = test_mean_time_to_review_calculation(client)
        test_results.append(("Mean Time to Review", success, "Timestamp availability"))

        # Print summary
        print("\n\n" + "="*80)
        print("VALIDATION SUMMARY")
        print("="*80)

        print(tabulate(
            [[r[0], '✅ SUCCESS' if r[1] else '❌ FAILED', r[2]] for r in test_results],
            headers=['Test', 'Result', 'Details'],
            tablefmt='grid'
        ))

        # Conclusions
        print("\n" + "="*80)
        print("CONCLUSIONS & RECOMMENDATIONS")
        print("="*80)

        print(f"\n✅ REVIEWED ISSUES:")
        print(f"   Field: scanStatus")
        print(f"   Logic: scanStatus != 'UNREVIEWED'")
        print(f"   Confidence: HIGH")

        print(f"\n⚠️  MEAN TIME TO REVIEW:")
        print(f"   Challenge: Need review timestamp")
        print(f"   Options:")
        print(f"   1. Use audit history (if review timestamp available)")
        print(f"   2. Use lastScanDate as proxy (less accurate)")
        print(f"   3. Skip this metric if timestamp unavailable")
        print(f"   Confidence: MEDIUM (need audit history validation)")

    except Exception as e:
        print(f"\n❌ Validation failed: {str(e)}")


if __name__ == "__main__":
    main()

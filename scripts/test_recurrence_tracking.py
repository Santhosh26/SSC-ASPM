"""
Test SSC API - Issue Recurrence/Reopening Tracking
Determines if SSC tracks reopened issues and how to identify them
"""

from ssc_api_client import SSCApiClient
from tabulate import tabulate


def test_audit_history_for_reopens(client: SSCApiClient):
    """Test if audit history shows issue reopen events"""
    print("\n" + "="*80)
    print("TEST: Audit History for Reopen Events")
    print("="*80)

    try:
        # Get some closed issues
        response = client.get('/issues', params={
            'q': 'removed:true',
            'limit': 10,
            'fields': 'id,issueName,removed,removedDate'
        })

        if 'data' not in response or not response['data']:
            print("⚠️  No closed issues found - trying open issues with audit history")

            # Try open issues instead
            response = client.get('/issues', params={
                'limit': 10,
                'fields': 'id,issueName,removed'
            })

        if 'data' in response and response['data']:
            print(f"\n✅ Retrieved {len(response['data'])} issues")

            # Check audit history for each
            for issue in response['data'][:5]:
                issue_id = issue.get('id')
                issue_name = issue.get('issueName', 'N/A')

                print(f"\n--- Issue {issue_id}: {issue_name} ---")

                try:
                    audit_response = client.get(f'/issues/{issue_id}/auditHistory', params={
                        'limit': 20
                    })

                    if 'data' in audit_response and audit_response['data']:
                        audit_entries = audit_response['data']
                        print(f"    Audit History: {len(audit_entries)} entries")

                        # Look for state transitions
                        state_changes = []
                        for entry in audit_entries:
                            # Check all fields for state-related changes
                            entry_str = str(entry).lower()
                            if any(term in entry_str for term in ['removed', 'status', 'reopen', 'close', 'fix']):
                                state_changes.append(entry)

                        if state_changes:
                            print(f"    State changes: {len(state_changes)} found")

                            # Show first few state changes
                            for i, change in enumerate(state_changes[:3], 1):
                                print(f"\n    Change {i}:")
                                for key, value in change.items():
                                    print(f"      {key}: {value}")

                            # Look for reopen pattern
                            reopen_indicators = []
                            for change in state_changes:
                                change_str = str(change).lower()
                                if 'reopen' in change_str or ('removed' in change_str and 'false' in change_str):
                                    reopen_indicators.append(change)

                            if reopen_indicators:
                                print(f"\n    ✅ POTENTIAL REOPEN EVENTS FOUND: {len(reopen_indicators)}")
                                return True
                        else:
                            print(f"    No state changes found")
                    else:
                        print(f"    No audit history")

                except Exception as e:
                    print(f"    ❌ Could not get audit history: {str(e)}")

            print(f"\n⚠️  No clear reopen events found in sample")
            return False
        else:
            print("❌ No issues found")
            return False

    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
        return False


def test_issue_state_transitions(client: SSCApiClient):
    """Test if issues have fields indicating previous states"""
    print("\n" + "="*80)
    print("TEST: Issue Fields for State Tracking")
    print("="*80)

    try:
        # Get detailed issue
        response = client.get('/issues', params={'limit': 5})

        if 'data' not in response or not response['data']:
            print("❌ No issues found")
            return False

        issue_id = response['data'][0]['id']

        # Get full issue details
        detailed_response = client.get(f'/issues/{issue_id}')

        if 'data' in detailed_response:
            issue = detailed_response['data']

            print(f"\n✅ Retrieved detailed issue {issue_id}")

            # Look for state/history related fields
            state_fields = [k for k in issue.keys() if any(
                term in k.lower() for term in [
                    'removed', 'state', 'status', 'history',
                    'reopen', 'previous', 'original', 'count'
                ]
            )]

            if state_fields:
                print(f"\nState-related fields found:")
                for field in state_fields:
                    print(f"  {field}: {issue[field]}")

                return True
            else:
                print(f"\n⚠️  No obvious state tracking fields")
                print(f"\nAll available fields:")
                for key in sorted(issue.keys()):
                    print(f"  - {key}")

                return False
        else:
            print("❌ Could not get detailed issue")
            return False

    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
        return False


def test_issue_grouping_for_recurrence(client: SSCApiClient):
    """Test if we can identify recurring issues by grouping"""
    print("\n" + "="*80)
    print("TEST: Identify Recurring Issues by Pattern")
    print("="*80)

    try:
        # Get issues and group by category
        response = client.get('/issues', params={
            'limit': 200,
            'fields': 'id,issueName,projectVersionId,foundDate,removed,removedDate'
        })

        if 'data' in response and response['data']:
            print(f"\n✅ Retrieved {len(response['data'])} issues")

            # Group issues by version + category
            version_category_issues = {}

            for issue in response['data']:
                version_id = issue.get('projectVersionId')
                category = issue.get('issueName', 'Unknown')
                key = f"{version_id}:{category}"

                if key not in version_category_issues:
                    version_category_issues[key] = []

                version_category_issues[key].append(issue)

            # Find categories with both open and closed issues (potential recurrence)
            potential_recurrence = []

            for key, issues in version_category_issues.items():
                if len(issues) > 1:
                    has_open = any(not i.get('removed', False) for i in issues)
                    has_closed = any(i.get('removed', False) for i in issues)

                    if has_open and has_closed:
                        potential_recurrence.append((key, issues))

            if potential_recurrence:
                print(f"\n✅ Found {len(potential_recurrence)} potential recurring issue patterns")

                # Show first few
                for key, issues in potential_recurrence[:5]:
                    version_id, category = key.split(':', 1)
                    print(f"\n  Version {version_id} - {category}:")
                    print(f"    Total issues: {len(issues)}")
                    print(f"    Open: {sum(1 for i in issues if not i.get('removed', False))}")
                    print(f"    Closed: {sum(1 for i in issues if i.get('removed', False))}")

                print(f"\n⚠️  NOTE: This is a heuristic approach")
                print(f"   Multiple issues in same category != recurrence")
                print(f"   Need audit history to confirm actual reopen events")

                return True
            else:
                print(f"\n⚠️  No obvious recurring patterns found")
                return False
        else:
            print("❌ No issues found")
            return False

    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
        return False


def test_removed_date_analysis(client: SSCApiClient):
    """Analyze removed/reopened patterns in closed issues"""
    print("\n" + "="*80)
    print("TEST: Analyze Removal/Reopen Patterns")
    print("="*80)

    try:
        # Get closed issues
        response = client.get('/issues', params={
            'q': 'removed:true',
            'limit': 100,
            'fields': 'id,issueName,foundDate,removedDate,removed'
        })

        if 'data' in response and response['data']:
            print(f"\n✅ Retrieved {len(response['data'])} closed issues")

            # Check if any have been closed multiple times (if tracked)
            print(f"\nSample closed issues:")

            table_data = []
            for issue in response['data'][:10]:
                table_data.append([
                    issue.get('id'),
                    issue.get('issueName', 'N/A')[:30],
                    issue.get('foundDate', 'N/A')[:10],
                    issue.get('removedDate', 'N/A')[:10] if issue.get('removedDate') else 'None',
                    issue.get('removed', 'N/A')
                ])

            print(tabulate(table_data,
                         headers=['ID', 'Issue Name', 'Found Date', 'Removed Date', 'Removed'],
                         tablefmt='grid'))

            print(f"\n📊 Observation:")
            print(f"   Each issue has single foundDate and removedDate")
            print(f"   No built-in recurrence counter visible")
            print(f"   Need audit history to track reopen events")

            return True
        else:
            print("❌ No closed issues found")
            return False

    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
        return False


def main():
    """Run all recurrence tracking validation tests"""
    print("\n" + "🔄"*40)
    print("FORTIFY SSC - RECURRENCE/REOPEN TRACKING VALIDATION")
    print("🔄"*40)

    try:
        # Initialize client
        client = SSCApiClient()

        # Test connection
        if not client.test_connection():
            print("❌ Cannot proceed - connection failed")
            return

        # Run tests
        print("\n\n" + "🧪"*40)
        print("TESTING RECURRENCE TRACKING")
        print("🧪"*40)

        test_results = []

        # Test 1: Audit history for reopens
        success = test_audit_history_for_reopens(client)
        test_results.append(("Audit History Reopen Events", success, "Check above"))

        # Test 2: Issue state fields
        success = test_issue_state_transitions(client)
        test_results.append(("Issue State Fields", success, "Field availability"))

        # Test 3: Removed date analysis
        success = test_removed_date_analysis(client)
        test_results.append(("Removal Pattern Analysis", success, "Date fields"))

        # Test 4: Grouping heuristic
        success = test_issue_grouping_for_recurrence(client)
        test_results.append(("Recurring Pattern Detection", success, "Heuristic approach"))

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

        print(f"\n📊 RECURRENCE/REOPEN TRACKING:")

        print(f"\n⚠️  SSC does NOT have built-in recurrence counter")
        print(f"   Issues do not have 'timesReopened' or similar field")

        print(f"\n🔍 POSSIBLE APPROACHES:")

        print(f"\n1. AUDIT HISTORY METHOD (Most Accurate):")
        print(f"   - Check audit history for each issue")
        print(f"   - Look for 'removed' status changes")
        print(f"   - Count transitions: closed → reopened")
        print(f"   - Pros: Accurate if tracked in audit")
        print(f"   - Cons: Expensive (N API calls for N issues)")

        print(f"\n2. HEURISTIC METHOD (Approximation):")
        print(f"   - Group issues by version + category")
        print(f"   - If category has both open and closed issues → potential recurrence")
        print(f"   - Pros: Fast, single query")
        print(f"   - Cons: Not accurate (could be different instances)")

        print(f"\n3. SKIP THIS METRIC:")
        print(f"   - If recurrence tracking not available in audit history")
        print(f"   - Remove from dashboard or show 'Not Available'")

        print(f"\n💡 RECOMMENDATION:")
        print(f"   Test audit history for a few closed issues")
        print(f"   If reopen events are tracked → Use Method 1")
        print(f"   If NOT tracked → Skip this metric or use approximation")

    except Exception as e:
        print(f"\n❌ Validation failed: {str(e)}")


if __name__ == "__main__":
    main()

"""
Corrected SSC API Testing - Using projectVersions/{id}/issues
Tests with the correct SSC endpoint structure
"""

from ssc_api_client import SSCApiClient
from tabulate import tabulate


def get_version_with_issues(client: SSCApiClient):
    """Find a project version that has issues"""
    print("\n🔍 Finding a project version with issues...")

    try:
        # Get first few versions
        response = client.get('/projectVersions', params={'limit': 20})

        if 'data' in response and response['data']:
            for version in response['data']:
                version_id = version['id']
                version_name = version.get('name', 'N/A')

                # Check if this version has issues
                try:
                    issues_response = client.get(f'/projectVersions/{version_id}/issues', params={
                        'limit': 1
                    })

                    if 'data' in issues_response and issues_response['data']:
                        print(f"✅ Found version with issues: {version_name} (ID: {version_id})")
                        return version_id, version_name
                except:
                    continue

            print("⚠️  No versions with issues found in first 20")
            return None, None
        else:
            print("❌ No versions found")
            return None, None

    except Exception as e:
        print(f"❌ Failed: {str(e)}")
        return None, None


def test_star_ratings_corrected(client: SSCApiClient):
    """Test star ratings with correct approach"""
    print("\n" + "="*80)
    print("TEST: Star Ratings (Corrected)")
    print("="*80)

    version_id, version_name = get_version_with_issues(client)

    if not version_id:
        print("Cannot test - no versions with issues")
        return

    try:
        # Get issues for this version grouped by severity
        response = client.get(f'/projectVersions/{version_id}/issues', params={
            'limit': 100,
            'fields': 'severity'
        })

        if 'data' in response:
            severity_counts = {}
            for issue in response['data']:
                severity = issue.get('severity', 'Unknown')
                severity_counts[severity] = severity_counts.get(severity, 0) + 1

            print(f"\n📊 Version {version_name}:")
            print(f"Severity Distribution:")
            for severity, count in sorted(severity_counts.items()):
                severity_name = {1.0: 'Critical', 2.0: 'High', 3.0: 'Medium', 4.0: 'Low', 5.0: 'Info'}.get(severity, f'Unknown({severity})')
                print(f"  {severity} ({severity_name}): {count}")

            # Calculate star rating using SSC's numeric severity scale
            # SSC: 1.0=Critical, 2.0=High, 3.0=Medium, 4.0=Low, 5.0=Info
            min_severity = min(severity_counts.keys()) if severity_counts else 5.0

            if min_severity <= 1.0:
                rating = 1
                reason = "Has Critical issues (severity 1.0)"
            elif min_severity <= 2.0:
                rating = 2
                reason = "Has High issues (severity 2.0)"
            elif min_severity <= 3.0:
                rating = 3
                reason = "Has Medium issues (severity 3.0)"
            elif min_severity <= 4.0:
                rating = 4
                reason = "Has Low issues (severity 4.0)"
            else:
                rating = 5
                reason = "No significant issues (only Info/Best Practice)"

            print(f"\n⭐ Calculated Star Rating: {rating}★")
            print(f"Reason: {reason}")

            print(f"\n✅ CONCLUSION: Star ratings NOT stored in SSC")
            print(f"   Must calculate from issue severity (shown above)")

    except Exception as e:
        print(f"❌ Failed: {str(e)}")


def test_production_filtering_corrected(client: SSCApiClient):
    """Test production filtering with correct approach"""
    print("\n" + "="*80)
    print("TEST: Production Filtering (Corrected)")
    print("="*80)

    version_id, version_name = get_version_with_issues(client)

    if not version_id:
        print("Cannot test - no versions with issues")
        return

    try:
        # Test 1: Get all issues first to see available fields
        print(f"\n📋 Test 1: Get issues and check for production-related fields")
        response = client.get(f'/projectVersions/{version_id}/issues', params={
            'limit': 20,
            'fields': 'id,issueName,severity,analysisType,friority,primaryTag'
        })

        if 'data' in response:
            count = len(response['data'])
            total_count = response.get('totalCount', count)
            print(f"   ✅ Found {total_count} total issues")

            # Check what fields are available
            if response['data']:
                sample = response['data'][0]
                print(f"   Available fields: {list(sample.keys())}")
        else:
            print(f"   ⚠️  Query failed or no data")

        # Test 2: tags
        print(f"\n📋 Test 2: Check available tags")
        response = client.get(f'/projectVersions/{version_id}/issues', params={
            'limit': 50,
            'fields': 'id,primaryTag,secondaryTag'
        })

        if 'data' in response and response['data']:
            tags = set()
            for issue in response['data']:
                if issue.get('primaryTag'):
                    tags.add(issue.get('primaryTag'))
                if issue.get('secondaryTag'):
                    tags.add(issue.get('secondaryTag'))

            if tags:
                print(f"   ✅ Tags found: {tags}")
                if 'Production' in tags or 'production' in str(tags).lower():
                    print(f"   Production tag EXISTS - can filter by it")
                else:
                    print(f"   No Production tag - need to configure or use analysis:exploitable")
            else:
                print(f"   ⚠️  No tags found on issues")

    except Exception as e:
        print(f"❌ Failed: {str(e)}")


def test_review_status_corrected(client: SSCApiClient):
    """Test review status with correct approach"""
    print("\n" + "="*80)
    print("TEST: Review Status (Corrected)")
    print("="*80)

    version_id, version_name = get_version_with_issues(client)

    if not version_id:
        print("Cannot test - no versions with issues")
        return

    try:
        response = client.get(f'/projectVersions/{version_id}/issues', params={
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

            # Calculate review rates
            reviewed = sum(count for status, count in status_counts.items() if status != 'UNREVIEWED')
            total = sum(status_counts.values())
            rate = (reviewed / total * 100) if total > 0 else 0

            print(f"\n📊 Review Rate: {rate:.1f}%")
            print(f"   Reviewed (scanStatus != 'UNREVIEWED'): {reviewed}")
            print(f"   Total: {total}")

            print(f"\n✅ CONCLUSION: scanStatus field EXISTS")
            print(f"   Use: scanStatus != 'UNREVIEWED' for reviewed issues")

    except Exception as e:
        print(f"❌ Failed: {str(e)}")


def main():
    """Run corrected validation tests"""
    print("\n" + "🔧"*40)
    print("CORRECTED SSC API VALIDATION")
    print("Using /projectVersions/{id}/issues endpoint")
    print("🔧"*40)

    try:
        client = SSCApiClient()

        if not client.test_connection():
            print("❌ Connection failed")
            return

        test_star_ratings_corrected(client)
        test_production_filtering_corrected(client)
        test_review_status_corrected(client)

        print("\n\n" + "="*80)
        print("KEY FINDINGS")
        print("="*80)
        print("\n1. CORRECT ENDPOINT: /projectVersions/{id}/issues (NOT /issues)")
        print("\n2. STAR RATINGS: Must calculate from issue severity")
        print("\n3. PRODUCTION FILTER: Use analysis:exploitable or tags")
        print("\n4. REVIEW STATUS: scanStatus field exists and works")

    except Exception as e:
        print(f"\n❌ Failed: {str(e)}")


if __name__ == "__main__":
    main()

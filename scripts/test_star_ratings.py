"""
Test SSC API - Star Ratings Field Validation
Determines where/how star ratings are stored in SSC
"""

from ssc_api_client import SSCApiClient
from tabulate import tabulate


def test_star_ratings_in_project_versions(client: SSCApiClient):
    """Test if star ratings are in ProjectVersion response"""
    print("\n" + "="*80)
    print("TEST: Star Ratings in ProjectVersion Objects")
    print("="*80)

    try:
        # Get a sample of project versions
        response = client.get('/projectVersions', params={
            'limit': 10,
            'fields': 'id,name,project,currentState,issueCount'
        })

        if 'data' in response and response['data']:
            print(f"\n✅ Retrieved {len(response['data'])} project versions")

            # Check first version for all possible rating fields
            first_version = response['data'][0]
            print(f"\n🔍 Checking fields in version: {first_version.get('name')}")
            print(f"\n   All available fields in response:")
            for key in first_version.keys():
                print(f"   - {key}: {first_version[key]}")

            # Look for rating-related fields
            rating_fields = [k for k in first_version.keys() if 'rating' in k.lower() or 'star' in k.lower()]

            if rating_fields:
                print(f"\n   ✅ Found potential rating fields: {rating_fields}")
                return True, rating_fields
            else:
                print(f"\n   ⚠️  No rating fields found in basic response")
                return False, []
        else:
            print("❌ No project versions found")
            return False, []

    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
        return False, []


def test_star_ratings_with_performance_indicators(client: SSCApiClient):
    """Test if star ratings are in performance indicators"""
    print("\n" + "="*80)
    print("TEST: Star Ratings via Performance Indicators")
    print("="*80)

    try:
        response = client.get('/projectVersions', params={
            'limit': 5,
            'embed': 'performanceIndicators',
            'q': 'issueCount:>0'  # Only versions with issues
        })

        if 'data' in response and response['data']:
            print(f"\n✅ Retrieved {len(response['data'])} versions with performance indicators")

            for i, version in enumerate(response['data'][:3], 1):
                print(f"\n--- Version {i}: {version.get('name')} ---")

                if 'performanceIndicators' in version:
                    pis = version['performanceIndicators']
                    print(f"   Performance Indicators: {len(pis)} found")

                    # Look for rating-related indicators
                    for pi in pis:
                        pi_name = pi.get('name', '')
                        if 'rating' in pi_name.lower() or 'star' in pi_name.lower():
                            print(f"   ✅ FOUND: {pi_name} = {pi.get('value')}")

                    # Show all PI names for reference
                    print(f"\n   All Performance Indicator names:")
                    for pi in pis:
                        print(f"   - {pi.get('name')}: {pi.get('value')}")

            return True
        else:
            print("❌ No versions with performance indicators found")
            return False

    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
        return False


def test_star_ratings_calculation_from_severity(client: SSCApiClient):
    """Test calculating star ratings from issue severity"""
    print("\n" + "="*80)
    print("TEST: Calculate Star Ratings from Issue Severity")
    print("="*80)

    try:
        # Get a version with issues
        response = client.get('/projectVersions', params={
            'limit': 1,
            'q': 'issueCount:>0'
        })

        if 'data' not in response or not response['data']:
            print("❌ No versions with issues found")
            return False

        version = response['data'][0]
        version_id = version['id']
        version_name = version.get('name', 'N/A')

        print(f"\n📊 Analyzing version: {version_name} (ID: {version_id})")

        # Get issues for this version grouped by severity
        issues_response = client.get(f'/projectVersions/{version_id}/issues', params={
            'q': 'removed:false',
            'groupby': 'severity',
            'limit': 100
        })

        if 'data' in issues_response:
            severity_counts = {}
            for issue in issues_response['data']:
                severity = issue.get('severity', 'Unknown')
                severity_counts[severity] = severity_counts.get(severity, 0) + 1

            print(f"\n   Issue Severity Distribution:")
            for severity, count in sorted(severity_counts.items()):
                print(f"   {severity}: {count}")

            # Calculate star rating based on highest severity
            # SSC rating logic (typical):
            # 0 stars: No scans
            # 1 star: Has Critical issues
            # 2 stars: Has High issues (no Critical)
            # 3 stars: Has Medium issues (no High/Critical)
            # 4 stars: Has Low issues only
            # 5 stars: No issues

            if severity_counts.get('Critical', 0) > 0:
                calculated_rating = 1
                reason = "Has Critical issues"
            elif severity_counts.get('High', 0) > 0:
                calculated_rating = 2
                reason = "Has High issues"
            elif severity_counts.get('Medium', 0) > 0:
                calculated_rating = 3
                reason = "Has Medium issues"
            elif severity_counts.get('Low', 0) > 0:
                calculated_rating = 4
                reason = "Has Low issues only"
            else:
                calculated_rating = 5
                reason = "No issues"

            print(f"\n   ⭐ Calculated Star Rating: {calculated_rating}★")
            print(f"   Reason: {reason}")

            return True
        else:
            print("❌ Could not retrieve issues")
            return False

    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
        return False


def test_detailed_version_response(client: SSCApiClient):
    """Get detailed single version response to check all fields"""
    print("\n" + "="*80)
    print("TEST: Detailed Single Version Response (All Fields)")
    print("="*80)

    try:
        # Get first version ID
        response = client.get('/projectVersions', params={'limit': 1})

        if 'data' not in response or not response['data']:
            print("❌ No versions found")
            return False

        version_id = response['data'][0]['id']

        # Get full version details
        detailed_response = client.get(f'/projectVersions/{version_id}', params={
            'embed': 'performanceIndicators,variables,customTags,filterSets'
        })

        if 'data' in detailed_response:
            version = detailed_response['data']

            print(f"\n✅ Retrieved detailed version: {version.get('name')}")
            print(f"\n📋 ALL FIELDS IN VERSION OBJECT:")
            print("="*80)

            for key, value in version.items():
                if key in ['performanceIndicators', 'variables', 'customTags', 'filterSets']:
                    print(f"{key}: [{len(value) if isinstance(value, list) else 'embedded'}]")
                else:
                    print(f"{key}: {value}")

            # Check specifically for rating fields
            rating_related = [k for k in version.keys() if 'rating' in k.lower() or 'star' in k.lower() or 'score' in k.lower()]

            if rating_related:
                print(f"\n✅ RATING-RELATED FIELDS FOUND:")
                for field in rating_related:
                    print(f"   {field}: {version[field]}")
            else:
                print(f"\n⚠️  No direct rating fields found")

            return True
        else:
            print("❌ Could not get detailed version")
            return False

    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
        return False


def main():
    """Run all star rating validation tests"""
    print("\n" + "⭐"*40)
    print("FORTIFY SSC - STAR RATINGS FIELD VALIDATION")
    print("⭐"*40)

    try:
        # Initialize client
        client = SSCApiClient()

        # Test connection
        if not client.test_connection():
            print("❌ Cannot proceed - connection failed")
            return

        # Run validation tests
        print("\n\n" + "🧪"*40)
        print("RUNNING VALIDATION TESTS")
        print("🧪"*40)

        test_results = []

        # Test 1: Basic project version fields
        success, fields = test_star_ratings_in_project_versions(client)
        test_results.append(("Star Ratings in ProjectVersion", success, str(fields) if fields else "Not found"))

        # Test 2: Performance indicators
        success = test_star_ratings_with_performance_indicators(client)
        test_results.append(("Star Ratings in Performance Indicators", success, "Check above output"))

        # Test 3: Detailed version response
        success = test_detailed_version_response(client)
        test_results.append(("Detailed Version Fields", success, "Check above output"))

        # Test 4: Calculate from severity
        success = test_star_ratings_calculation_from_severity(client)
        test_results.append(("Calculate from Issue Severity", success, "Calculation method"))

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
        print("CONCLUSIONS")
        print("="*80)
        print("\nBased on the tests above:")
        print("1. If star ratings are found in response fields → Use directly")
        print("2. If found in performance indicators → Extract from there")
        print("3. If NOT found → Must calculate from issue severity (see Test 4)")
        print("\nRecommendation will be in the output above.")

    except Exception as e:
        print(f"\n❌ Validation failed: {str(e)}")


if __name__ == "__main__":
    main()

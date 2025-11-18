"""
Test SSC API - Production Issue Filtering Methods
Tests different ways to filter issues for production environment
"""

from ssc_api_client import SSCApiClient
from tabulate import tabulate


def test_analysis_exploitable_filter(client: SSCApiClient):
    """Test filtering by analysis:exploitable status"""
    print("\n" + "="*80)
    print("TEST: Filter by analysis:exploitable")
    print("="*80)

    try:
        # Get exploitable issues
        response = client.get('/issues', params={
            'q': 'removed:false+analysis:exploitable',
            'limit': 20,
            'fields': 'id,issueName,severity,friority,analysis,primaryTag'
        })

        if 'data' in response:
            count = response.get('totalCount', len(response['data']))
            print(f"\n✅ Query successful: Found {count} exploitable issues")

            if response['data']:
                # Show severity distribution
                severity_counts = {}
                for issue in response['data']:
                    severity = issue.get('severity', 'Unknown')
                    severity_counts[severity] = severity_counts.get(severity, 0) + 1

                print(f"\nSeverity Distribution:")
                for severity, cnt in sorted(severity_counts.items()):
                    print(f"  {severity}: {cnt}")

                # Show sample issues
                print(f"\nSample Issues (first 5):")
                table_data = []
                for issue in response['data'][:5]:
                    table_data.append([
                        issue.get('id'),
                        issue.get('issueName', 'N/A')[:40],
                        issue.get('severity'),
                        issue.get('friority'),
                        issue.get('analysis', 'N/A')
                    ])

                print(tabulate(table_data,
                             headers=['ID', 'Issue Name', 'Severity', 'Friority', 'Analysis'],
                             tablefmt='grid'))

                return True, count
            else:
                print("⚠️  Query returned 0 issues")
                return True, 0
        else:
            print("❌ No data in response")
            return False, 0

    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
        return False, 0


def test_tag_production_filter(client: SSCApiClient):
    """Test filtering by tag:Production"""
    print("\n" + "="*80)
    print("TEST: Filter by tag:Production")
    print("="*80)

    try:
        response = client.get('/issues', params={
            'q': 'removed:false+tag:Production',
            'limit': 20,
            'fields': 'id,issueName,severity,primaryTag,secondaryTag'
        })

        if 'data' in response:
            count = response.get('totalCount', len(response['data']))
            print(f"\n✅ Query successful: Found {count} issues with tag:Production")

            if response['data']:
                # Show tags
                tags_found = set()
                for issue in response['data'][:10]:
                    primary = issue.get('primaryTag')
                    secondary = issue.get('secondaryTag')
                    if primary:
                        tags_found.add(primary)
                    if secondary:
                        tags_found.add(secondary)

                print(f"\nTags found in results: {tags_found}")
                return True, count
            else:
                print("⚠️  Query returned 0 issues (tag may not exist)")
                return True, 0
        else:
            print("❌ No data in response")
            return False, 0

    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
        return False, 0


def test_primary_tag_production_filter(client: SSCApiClient):
    """Test filtering by primaryTag:Production"""
    print("\n" + "="*80)
    print("TEST: Filter by primaryTag:Production")
    print("="*80)

    try:
        response = client.get('/issues', params={
            'q': 'removed:false+primaryTag:Production',
            'limit': 20,
            'fields': 'id,issueName,severity,primaryTag'
        })

        if 'data' in response:
            count = response.get('totalCount', len(response['data']))
            print(f"\n✅ Query successful: Found {count} issues with primaryTag:Production")

            if response['data']:
                print(f"\nSample primary tags:")
                for issue in response['data'][:5]:
                    print(f"  Issue {issue.get('id')}: {issue.get('primaryTag')}")
                return True, count
            else:
                print("⚠️  Query returned 0 issues")
                return True, 0
        else:
            print("❌ No data in response")
            return False, 0

    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
        return False, 0


def test_version_sdlc_attribute_filter(client: SSCApiClient):
    """Test filtering versions by SDLC Status attribute then getting issues"""
    print("\n" + "="*80)
    print("TEST: Filter by Version SDLC Status Attribute")
    print("="*80)

    try:
        # First, try to find versions with SDLC Status = Production
        response = client.get('/projectVersions', params={
            'limit': 10,
            'embed': 'variables'
        })

        if 'data' in response and response['data']:
            production_versions = []

            print("\n🔍 Checking versions for SDLC Status attribute...")

            for version in response['data']:
                version_id = version.get('id')
                version_name = version.get('name')

                if 'variables' in version:
                    for var in version['variables']:
                        var_name = var.get('name', '')
                        var_value = var.get('value', '')

                        # Look for SDLC-related attributes
                        if 'sdlc' in var_name.lower() or 'status' in var_name.lower():
                            print(f"  Version {version_name}: {var_name} = {var_value}")

                            if 'production' in str(var_value).lower() or 'prod' in str(var_value).lower():
                                production_versions.append((version_id, version_name))

            if production_versions:
                print(f"\n✅ Found {len(production_versions)} production versions")

                # Get issues for first production version
                version_id, version_name = production_versions[0]
                print(f"\nGetting issues for production version: {version_name}")

                issues_response = client.get(f'/projectVersions/{version_id}/issues', params={
                    'q': 'removed:false',
                    'limit': 10,
                    'fields': 'id,severity'
                })

                if 'data' in issues_response:
                    issue_count = issues_response.get('totalCount', len(issues_response['data']))
                    print(f"  Issues in this production version: {issue_count}")

                    # Show severity distribution
                    if issues_response['data']:
                        severity_counts = {}
                        for issue in issues_response['data']:
                            severity = issue.get('severity', 'Unknown')
                            severity_counts[severity] = severity_counts.get(severity, 0) + 1

                        print(f"\n  Severity distribution (sample):")
                        for severity, cnt in sorted(severity_counts.items()):
                            print(f"    {severity}: {cnt}")

                    return True, issue_count
            else:
                print("⚠️  No production versions found via SDLC attribute")
                return True, 0
        else:
            print("❌ No versions found")
            return False, 0

    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
        return False, 0


def test_available_tags(client: SSCApiClient):
    """Check what tags are actually available in the system"""
    print("\n" + "="*80)
    print("TEST: Discover Available Tags in System")
    print("="*80)

    try:
        # Get a sample of issues and see what tags they have
        response = client.get('/issues', params={
            'limit': 100,
            'fields': 'id,primaryTag,secondaryTag'
        })

        if 'data' in response and response['data']:
            primary_tags = set()
            secondary_tags = set()

            for issue in response['data']:
                if issue.get('primaryTag'):
                    primary_tags.add(issue.get('primaryTag'))
                if issue.get('secondaryTag'):
                    secondary_tags.add(issue.get('secondaryTag'))

            print(f"\n✅ Analyzed {len(response['data'])} issues")
            print(f"\nUnique Primary Tags found ({len(primary_tags)}):")
            for tag in sorted(primary_tags):
                print(f"  - {tag}")

            if secondary_tags:
                print(f"\nUnique Secondary Tags found ({len(secondary_tags)}):")
                for tag in sorted(secondary_tags):
                    print(f"  - {tag}")
            else:
                print(f"\nNo secondary tags found")

            return True
        else:
            print("❌ No issues found")
            return False

    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
        return False


def main():
    """Run all production filtering validation tests"""
    print("\n" + "🏭"*40)
    print("FORTIFY SSC - PRODUCTION FILTERING VALIDATION")
    print("🏭"*40)

    try:
        # Initialize client
        client = SSCApiClient()

        # Test connection
        if not client.test_connection():
            print("❌ Cannot proceed - connection failed")
            return

        # Run tests
        print("\n\n" + "🧪"*40)
        print("TESTING PRODUCTION FILTERING METHODS")
        print("🧪"*40)

        test_results = []

        # Test 1: analysis:exploitable
        success, count = test_analysis_exploitable_filter(client)
        test_results.append(("analysis:exploitable", success, f"{count} issues"))

        # Test 2: tag:Production
        success, count = test_tag_production_filter(client)
        test_results.append(("tag:Production", success, f"{count} issues"))

        # Test 3: primaryTag:Production
        success, count = test_primary_tag_production_filter(client)
        test_results.append(("primaryTag:Production", success, f"{count} issues"))

        # Test 4: SDLC attribute on versions
        success, count = test_version_sdlc_attribute_filter(client)
        test_results.append(("Version SDLC Attribute", success, f"{count} issues"))

        # Test 5: Discover available tags
        success = test_available_tags(client)
        test_results.append(("Discover Available Tags", success, "See above"))

        # Print summary
        print("\n\n" + "="*80)
        print("VALIDATION SUMMARY")
        print("="*80)

        print(tabulate(
            [[r[0], '✅ SUCCESS' if r[1] else '❌ FAILED', r[2]] for r in test_results],
            headers=['Filtering Method', 'Result', 'Issues Found'],
            tablefmt='grid'
        ))

        # Recommendations
        print("\n" + "="*80)
        print("RECOMMENDATIONS")
        print("="*80)

        # Find the method with most results
        methods_with_results = [(r[0], int(r[2].split()[0])) for r in test_results if 'issues' in r[2] and r[1]]

        if methods_with_results:
            best_method = max(methods_with_results, key=lambda x: x[1])
            print(f"\n✅ RECOMMENDED METHOD: {best_method[0]}")
            print(f"   Found {best_method[1]} production/exploitable issues")

            print(f"\n📝 Implementation guidance:")
            if best_method[0] == "analysis:exploitable":
                print(f"   Use query: q=removed:false+analysis:exploitable")
                print(f"   This filters for issues marked as exploitable/production-relevant")
            elif "tag" in best_method[0]:
                print(f"   Use query: q=removed:false+{best_method[0].replace(' ', ':')}")
                print(f"   This filters by production tag")
            else:
                print(f"   Filter project versions by SDLC attribute first")
                print(f"   Then query issues for those versions")
        else:
            print(f"\n⚠️  No production filtering method returned results")
            print(f"   Options:")
            print(f"   1. Configure production tags in SSC")
            print(f"   2. Use SDLC Status attribute on versions")
            print(f"   3. Use analysis:exploitable as proxy for production issues")

    except Exception as e:
        print(f"\n❌ Validation failed: {str(e)}")


if __name__ == "__main__":
    main()

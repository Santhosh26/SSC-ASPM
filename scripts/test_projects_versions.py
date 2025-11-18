"""
Test SSC API - Projects and Project Versions Endpoints
Tests the core endpoints for retrieving projects and versions
"""

from ssc_api_client import SSCApiClient
from tabulate import tabulate


def test_projects(client: SSCApiClient):
    """Test /projects endpoint"""
    print("\n" + "="*80)
    print("TEST: GET /projects")
    print("="*80)

    try:
        # Fetch all projects
        response = client.get('/projects', params={
            'start': 0,
            'limit': 200,
            'fields': 'id,name,description,createdBy,creationDate,issueTemplateId'
        })

        client.print_response_summary(response, "Projects Response")

        if 'data' in response and response['data']:
            # Save sample
            client.save_sample('projects.json', response)

            # Print table of first 10 projects
            projects = response['data'][:10]
            table_data = []
            for p in projects:
                table_data.append([
                    p.get('id'),
                    p.get('name', 'N/A')[:40],
                    p.get('createdBy', 'N/A'),
                    p.get('creationDate', 'N/A')[:10]
                ])

            print("First 10 Projects:")
            print(tabulate(table_data, headers=['ID', 'Name', 'Created By', 'Created Date'], tablefmt='grid'))
            print()

            return True, response['totalCount']
        else:
            print("⚠️  No projects found in response")
            return False, 0

    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
        return False, 0


def test_project_versions(client: SSCApiClient):
    """Test /projectVersions endpoint with various parameters"""
    print("\n" + "="*80)
    print("TEST: GET /projectVersions")
    print("="*80)

    try:
        # Fetch project versions with performance indicators and variables
        response = client.get('/projectVersions', params={
            'start': 0,
            'limit': 200,
            'includeInactive': 'false',
            'myAssignedIssues': 'false',
            'onlyIfHasIssues': 'false',
            'fields': 'id,name,project,currentState,description,issueCount',
            'embed': 'performanceIndicators,variables'
        })

        client.print_response_summary(response, "Project Versions Response")

        if 'data' in response and response['data']:
            # Save sample
            client.save_sample('projectVersions.json', response)

            # Analyze first few versions
            versions = response['data'][:5]

            print("\nDetailed Analysis of First 5 Versions:")
            for i, version in enumerate(versions, 1):
                print(f"\n--- Version {i}: {version.get('name', 'N/A')} ---")
                print(f"ID: {version.get('id')}")
                print(f"Project: {version.get('project', {}).get('name', 'N/A')}")
                print(f"State: {version.get('currentState', {}).get('name', 'N/A')}")
                print(f"Issue Count: {version.get('issueCount', 0)}")

                # Check for performance indicators
                if 'performanceIndicators' in version:
                    pis = version['performanceIndicators']
                    print(f"Performance Indicators: {len(pis)} found")

                    # Look for FortifySecurityRating
                    for pi in pis:
                        if 'FortifySecurityRating' in pi.get('name', ''):
                            print(f"  ✓ FortifySecurityRating: {pi.get('value', 'N/A')}")

                # Check for variables (custom attributes)
                if 'variables' in version:
                    vars_data = version['variables']
                    if vars_data:
                        print(f"Variables/Custom Attributes: {len(vars_data)} found")
                        for var in vars_data[:3]:  # Show first 3
                            print(f"  - {var.get('name', 'N/A')}: {var.get('value', 'N/A')}")

            # Create summary table
            table_data = []
            for v in response['data'][:10]:
                table_data.append([
                    v.get('id'),
                    v.get('name', 'N/A')[:30],
                    v.get('project', {}).get('name', 'N/A')[:25],
                    v.get('currentState', {}).get('name', 'N/A'),
                    v.get('issueCount', 0)
                ])

            print("\n\nFirst 10 Project Versions:")
            print(tabulate(table_data,
                         headers=['ID', 'Version', 'Project', 'State', 'Issues'],
                         tablefmt='grid'))
            print()

            return True, response['totalCount']
        else:
            print("⚠️  No project versions found in response")
            return False, 0

    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
        return False, 0


def test_project_versions_with_filters(client: SSCApiClient):
    """Test /projectVersions with custom attribute filters"""
    print("\n" + "="*80)
    print("TEST: GET /projectVersions with Custom Attribute Filters")
    print("="*80)

    # Test different filter scenarios
    filter_tests = [
        {
            'name': 'Filter by Business Unit',
            'params': {
                'q': 'attributes.Business_Unit:ITOM',
                'limit': 10
            }
        },
        {
            'name': 'Filter by Criticality',
            'params': {
                'q': 'attributes.Business_Criticality:High',
                'limit': 10
            }
        },
        {
            'name': 'Filter by SDLC Status',
            'params': {
                'q': 'attributes.SDLC_Status:Production',
                'limit': 10
            }
        }
    ]

    results = []

    for test in filter_tests:
        print(f"\n📋 {test['name']}")
        print(f"   Query: {test['params'].get('q', 'N/A')}")

        try:
            response = client.get('/projectVersions', params=test['params'])

            if 'data' in response:
                count = len(response['data'])
                total = response.get('totalCount', 0)
                print(f"   ✅ Found {count} items (Total: {total})")
                results.append((test['name'], True, total))
            else:
                print(f"   ⚠️  No data in response")
                results.append((test['name'], False, 0))

        except Exception as e:
            print(f"   ❌ Failed: {str(e)}")
            results.append((test['name'], False, 0))

    # Print summary
    print("\n\nFilter Tests Summary:")
    print(tabulate(
        [[r[0], '✅' if r[1] else '❌', r[2]] for r in results],
        headers=['Filter Test', 'Status', 'Results'],
        tablefmt='grid'
    ))

    return all(r[1] for r in results)


def test_single_version_details(client: SSCApiClient, version_id: int):
    """Test retrieving a single project version with full details"""
    print("\n" + "="*80)
    print(f"TEST: GET /projectVersions/{version_id}")
    print("="*80)

    try:
        response = client.get(f'/projectVersions/{version_id}', params={
            'embed': 'performanceIndicators,variables,customTags'
        })

        if 'data' in response:
            version = response['data']

            print(f"\nVersion Details:")
            print(f"  ID: {version.get('id')}")
            print(f"  Name: {version.get('name')}")
            print(f"  Project: {version.get('project', {}).get('name', 'N/A')}")
            print(f"  Description: {version.get('description', 'N/A')}")
            print(f"  Issue Count: {version.get('issueCount', 0)}")
            print(f"  Created: {version.get('creationDate', 'N/A')}")

            # Performance Indicators
            if 'performanceIndicators' in version:
                print(f"\n  Performance Indicators:")
                for pi in version['performanceIndicators']:
                    print(f"    - {pi.get('name')}: {pi.get('value')}")

            # Variables (Custom Attributes)
            if 'variables' in version:
                print(f"\n  Custom Attributes:")
                for var in version['variables']:
                    print(f"    - {var.get('name')}: {var.get('value')}")

            # Custom Tags
            if 'customTags' in version:
                print(f"\n  Custom Tags:")
                for tag in version['customTags']:
                    print(f"    - {tag.get('name')}")

            client.save_sample(f'projectVersion_{version_id}_details.json', response)

            return True
        else:
            print("⚠️  No data in response")
            return False

    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
        return False


def main():
    """Run all project/version tests"""
    print("\n" + "🔬"*40)
    print("FORTIFY SSC API TESTING: Projects & Versions")
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

        # Test 1: Projects
        success, project_count = test_projects(client)
        test_results.append(("Get Projects", success, f"{project_count} projects"))

        # Test 2: Project Versions
        success, version_count = test_project_versions(client)
        test_results.append(("Get Project Versions", success, f"{version_count} versions"))

        # Test 3: Filtered Queries
        success = test_project_versions_with_filters(client)
        test_results.append(("Custom Attribute Filters", success, "Various filters"))

        # Test 4: Single Version Details (use first version ID if available)
        if version_count > 0:
            # Get first version ID
            response = client.get('/projectVersions', params={'limit': 1})
            if 'data' in response and response['data']:
                first_version_id = response['data'][0]['id']
                success = test_single_version_details(client, first_version_id)
                test_results.append(("Get Single Version Details", success, f"Version ID: {first_version_id}"))

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

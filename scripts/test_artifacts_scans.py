"""
Test SSC API - Artifacts and Scans Endpoints
Tests endpoints for retrieving scan artifacts and scan metadata
"""

from ssc_api_client import SSCApiClient
from tabulate import tabulate


def test_all_artifacts(client: SSCApiClient):
    """Test /artifacts endpoint"""
    print("\n" + "="*80)
    print("TEST: GET /artifacts")
    print("="*80)

    try:
        response = client.get('/artifacts', params={
            'start': 0,
            'limit': 50,
            'fields': 'id,fileName,artifactType,uploadDate,status,embed',
            'embed': 'scans'
        })

        client.print_response_summary(response, "Artifacts Response")

        if 'data' in response and response['data']:
            client.save_sample('artifacts.json', response)

            artifacts = response['data']

            # Analyze scan types
            scan_type_counts = {}
            total_loc = 0
            total_files = 0

            for artifact in artifacts:
                # Get embedded scan data
                if 'embed' in artifact and 'scans' in artifact['embed']:
                    scans = artifact['embed']['scans']
                    if scans:
                        for scan in scans:
                            scan_type = scan.get('scanType', 'Unknown')
                            scan_type_counts[scan_type] = scan_type_counts.get(scan_type, 0) + 1

                            # Aggregate LOC and files
                            loc = scan.get('linesOfCode', 0)
                            if loc:
                                total_loc += loc

                            files = scan.get('numFiles', 0)
                            if files:
                                total_files += files

            print(f"\nScan Type Distribution (from {len(artifacts)} artifacts):")
            for scan_type, count in sorted(scan_type_counts.items()):
                print(f"  {scan_type}: {count}")

            print(f"\nAggregate Metrics:")
            print(f"  Total Lines of Code: {total_loc:,}")
            print(f"  Total Files: {total_files:,}")

            # Show first 10 artifacts
            table_data = []
            for artifact in artifacts[:10]:
                upload_date = artifact.get('uploadDate', 'N/A')[:10] if artifact.get('uploadDate') else 'N/A'

                scan_type = 'N/A'
                if 'embed' in artifact and 'scans' in artifact['embed']:
                    scans = artifact['embed']['scans']
                    if scans and scans[0]:
                        scan_type = scans[0].get('scanType', 'N/A')

                table_data.append([
                    artifact.get('id'),
                    artifact.get('fileName', 'N/A')[:30],
                    artifact.get('artifactType', 'N/A'),
                    scan_type,
                    upload_date,
                    artifact.get('status', 'N/A')
                ])

            print("\nFirst 10 Artifacts:")
            print(tabulate(table_data,
                         headers=['ID', 'File Name', 'Type', 'Scan Type', 'Upload Date', 'Status'],
                         tablefmt='grid'))

            return True, response.get('totalCount', 0)
        else:
            print("⚠️  No artifacts found")
            return False, 0

    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
        return False, 0


def test_project_version_artifacts(client: SSCApiClient, version_id: int):
    """Test /projectVersions/{id}/artifacts endpoint"""
    print("\n" + "="*80)
    print(f"TEST: GET /projectVersions/{version_id}/artifacts")
    print("="*80)

    try:
        response = client.get(f'/projectVersions/{version_id}/artifacts', params={
            'start': 0,
            'limit': 50,
            'embed': 'scans'
        })

        client.print_response_summary(response, f"Artifacts for Version {version_id}")

        if 'data' in response and response['data']:
            artifacts = response['data']

            # Analyze scan coverage for this version
            scan_types_found = set()
            artifact_details = []

            for artifact in artifacts:
                artifact_info = {
                    'id': artifact.get('id'),
                    'fileName': artifact.get('fileName', 'N/A'),
                    'uploadDate': artifact.get('uploadDate', 'N/A')[:10],
                    'status': artifact.get('status', 'N/A'),
                    'scanType': 'N/A',
                    'loc': 0,
                    'files': 0
                }

                if 'embed' in artifact and 'scans' in artifact['embed']:
                    scans = artifact['embed']['scans']
                    if scans and scans[0]:
                        scan = scans[0]
                        artifact_info['scanType'] = scan.get('scanType', 'N/A')
                        artifact_info['loc'] = scan.get('linesOfCode', 0)
                        artifact_info['files'] = scan.get('numFiles', 0)
                        scan_types_found.add(artifact_info['scanType'])

                artifact_details.append(artifact_info)

            print(f"\nScan Types for this Version: {', '.join(scan_types_found)}")

            # Calculate coverage
            has_sast = 'SAST' in scan_types_found
            has_dast = 'DAST' in scan_types_found
            has_sca = 'SCA' in scan_types_found

            print(f"\nScan Coverage:")
            print(f"  SAST: {'✅ Yes' if has_sast else '❌ No'}")
            print(f"  DAST: {'✅ Yes' if has_dast else '❌ No'}")
            print(f"  SCA: {'✅ Yes' if has_sca else '❌ No'}")

            # Show artifacts table
            table_data = [[
                a['id'],
                a['fileName'][:25],
                a['scanType'],
                a['uploadDate'],
                f"{a['loc']:,}",
                a['files'],
                a['status']
            ] for a in artifact_details[:10]]

            print("\nArtifacts for this Version:")
            print(tabulate(table_data,
                         headers=['ID', 'File Name', 'Scan Type', 'Upload Date', 'LOC', 'Files', 'Status'],
                         tablefmt='grid'))

            client.save_sample(f'projectVersion_{version_id}_artifacts.json', response)

            return True, len(artifacts)
        else:
            print("⚠️  No artifacts found for this version")
            return False, 0

    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
        return False, 0


def test_artifacts_by_type(client: SSCApiClient):
    """Test filtering artifacts by scan type"""
    print("\n" + "="*80)
    print("TEST: Filter Artifacts by Scan Type")
    print("="*80)

    # Note: SSC might filter artifacts differently
    # We'll test filtering via scans
    scan_types = ['SAST', 'DAST', 'SCA']
    results = []

    for scan_type in scan_types:
        print(f"\n📋 Testing {scan_type} artifacts...")

        try:
            # Get artifacts and filter client-side or test with query if supported
            response = client.get('/artifacts', params={
                'limit': 100,
                'embed': 'scans'
            })

            if 'data' in response:
                # Filter for specific scan type
                matching_artifacts = []
                for artifact in response['data']:
                    if 'embed' in artifact and 'scans' in artifact['embed']:
                        scans = artifact['embed']['scans']
                        if scans:
                            for scan in scans:
                                if scan.get('scanType') == scan_type:
                                    matching_artifacts.append(artifact)
                                    break

                count = len(matching_artifacts)
                print(f"   ✅ Found {count} {scan_type} artifacts")
                results.append((scan_type, True, count))
            else:
                print(f"   ⚠️  No data in response")
                results.append((scan_type, False, 0))

        except Exception as e:
            print(f"   ❌ Failed: {str(e)}")
            results.append((scan_type, False, 0))

    # Print summary
    print("\n\nArtifacts by Scan Type Summary:")
    print(tabulate(
        results,
        headers=['Scan Type', 'Status', 'Count'],
        tablefmt='grid'
    ))

    return all(r[1] for r in results)


def test_scan_details(client: SSCApiClient):
    """Test /scans endpoint if available"""
    print("\n" + "="*80)
    print("TEST: GET /scans")
    print("="*80)

    try:
        response = client.get('/scans', params={
            'start': 0,
            'limit': 20
        })

        client.print_response_summary(response, "Scans Response")

        if 'data' in response and response['data']:
            scans = response['data']

            # Show scan details
            table_data = []
            for scan in scans[:10]:
                table_data.append([
                    scan.get('id', 'N/A'),
                    scan.get('scanType', 'N/A'),
                    scan.get('engineType', 'N/A')[:20],
                    scan.get('linesOfCode', 0),
                    scan.get('numFiles', 0),
                    scan.get('scanDate', 'N/A')[:10] if scan.get('scanDate') else 'N/A'
                ])

            print("\nFirst 10 Scans:")
            print(tabulate(table_data,
                         headers=['ID', 'Scan Type', 'Engine', 'LOC', 'Files', 'Scan Date'],
                         tablefmt='grid'))

            client.save_sample('scans.json', response)

            return True
        else:
            print("⚠️  No scans found or endpoint not available")
            return False

    except Exception as e:
        print(f"⚠️  Scans endpoint test failed: {str(e)}")
        print("   (This endpoint may not be available or may require different parameters)")
        return False


def calculate_scan_coverage(client: SSCApiClient):
    """Calculate scan coverage across all versions"""
    print("\n" + "="*80)
    print("TEST: Calculate Scan Coverage Metrics")
    print("="*80)

    try:
        # Get all active project versions
        versions_response = client.get('/projectVersions', params={
            'includeInactive': 'false',
            'limit': 200
        })

        if 'data' not in versions_response:
            print("⚠️  Could not retrieve project versions")
            return False

        versions = versions_response['data']
        total_versions = len(versions)

        print(f"\nAnalyzing scan coverage for {total_versions} active versions...")

        coverage_stats = {
            'SAST': 0,
            'DAST': 0,
            'SCA': 0,
            'Other': 0
        }

        # Sample first 50 versions (for performance)
        sample_size = min(50, total_versions)
        print(f"Sampling {sample_size} versions for detailed analysis...")

        for i, version in enumerate(versions[:sample_size], 1):
            version_id = version['id']

            if i % 10 == 0:
                print(f"  Processed {i}/{sample_size} versions...")

            try:
                artifacts_response = client.get(f'/projectVersions/{version_id}/artifacts', params={
                    'embed': 'scans',
                    'limit': 50
                })

                if 'data' in artifacts_response:
                    scan_types_in_version = set()

                    for artifact in artifacts_response['data']:
                        if 'embed' in artifact and 'scans' in artifact['embed']:
                            scans = artifact['embed']['scans']
                            for scan in scans:
                                scan_type = scan.get('scanType', 'Other')
                                scan_types_in_version.add(scan_type)

                    # Update coverage stats
                    for scan_type in scan_types_in_version:
                        if scan_type in coverage_stats:
                            coverage_stats[scan_type] += 1
                        else:
                            coverage_stats['Other'] += 1

            except Exception as e:
                print(f"    ⚠️  Error processing version {version_id}: {str(e)}")
                continue

        # Calculate percentages
        print(f"\n\nScan Coverage Results (based on {sample_size} versions):")
        coverage_table = []
        for scan_type, count in coverage_stats.items():
            percentage = (count / sample_size) * 100 if sample_size > 0 else 0
            coverage_table.append([scan_type, count, f"{percentage:.1f}%"])

        print(tabulate(coverage_table,
                      headers=['Scan Type', 'Versions', 'Coverage %'],
                      tablefmt='grid'))

        return True

    except Exception as e:
        print(f"❌ Coverage calculation failed: {str(e)}")
        return False


def main():
    """Run all artifact and scan tests"""
    print("\n" + "🔬"*40)
    print("FORTIFY SSC API TESTING: Artifacts & Scans")
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

        # Test 1: All artifacts
        success, total_artifacts = test_all_artifacts(client)
        test_results.append(("Get All Artifacts", success, f"{total_artifacts} artifacts"))

        # Test 2: Artifacts by type
        success = test_artifacts_by_type(client)
        test_results.append(("Filter by Scan Type", success, "SAST/DAST/SCA"))

        # Test 3: Project version artifacts (get first version with artifacts)
        response = client.get('/projectVersions', params={'limit': 1})
        if 'data' in response and response['data']:
            version_id = response['data'][0]['id']
            success, artifact_count = test_project_version_artifacts(client, version_id)
            test_results.append(("Get Version Artifacts", success, f"Version {version_id}: {artifact_count} artifacts"))

        # Test 4: Scans endpoint
        success = test_scan_details(client)
        test_results.append(("Get Scans", success, "Scan details"))

        # Test 5: Calculate coverage
        success = calculate_scan_coverage(client)
        test_results.append(("Calculate Scan Coverage", success, "SAST/DAST/SCA coverage"))

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

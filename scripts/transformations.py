"""
SSC Data Transformations
Examples of how to transform SSC API data into dashboard-ready formats
"""

from ssc_api_client import SSCApiClient
from tabulate import tabulate
from datetime import datetime
from collections import defaultdict


def transform_policy_compliance(client: SSCApiClient):
    """
    Transform FortifySecurityRating to Policy Compliance status
    Dashboard needs: { pass: count, fail: count, unassessed: count }
    """
    print("\n" + "="*80)
    print("TRANSFORMATION: Policy Compliance from FortifySecurityRating")
    print("="*80)

    try:
        print("\n1. Fetching project versions with performance indicators...")
        response = client.get('/projectVersions', params={
            'includeInactive': 'false',
            'limit': 100,
            'embed': 'performanceIndicators'
        })

        if 'data' not in response:
            print("❌ No data received")
            return False

        versions = response['data']
        print(f"   ✅ Retrieved {len(versions)} versions")

        print("\n2. Extracting FortifySecurityRating values...")
        compliance_status = {
            'pass': 0,
            'fail': 0,
            'unassessed': 0
        }

        for version in versions:
            rating_value = None

            if 'performanceIndicators' in version:
                for pi in version['performanceIndicators']:
                    if 'FortifySecurityRating' in pi.get('name', ''):
                        rating_value = pi.get('value')
                        break

            # Apply transformation logic
            if rating_value is None:
                compliance_status['unassessed'] += 1
            elif rating_value >= 4.5:  # 5.0 or close to it
                compliance_status['pass'] += 1
            elif rating_value <= 1.5:  # 1.0 or close to it
                compliance_status['fail'] += 1
            else:
                # Intermediate values - decide based on threshold
                if rating_value >= 3.0:
                    compliance_status['pass'] += 1
                else:
                    compliance_status['fail'] += 1

        print("\n3. Transformation complete!")
        print("\n📊 Dashboard Output:")
        print(f"   Pass: {compliance_status['pass']}")
        print(f"   Fail: {compliance_status['fail']}")
        print(f"   Unassessed: {compliance_status['unassessed']}")

        # Calculate percentages
        total = sum(compliance_status.values())
        if total > 0:
            print("\n📈 Percentages:")
            for status, count in compliance_status.items():
                percentage = (count / total) * 100
                print(f"   {status.capitalize()}: {percentage:.1f}%")

        return True

    except Exception as e:
        print(f"❌ Transformation failed: {str(e)}")
        return False


def transform_severity_distribution(client: SSCApiClient):
    """
    Transform issues into severity distribution
    Dashboard needs: { critical: count, high: count, medium: count, low: count }
    """
    print("\n" + "="*80)
    print("TRANSFORMATION: Issue Severity Distribution")
    print("="*80)

    try:
        print("\n1. Fetching open issues...")
        response = client.get('/issues', params={
            'q': 'removed:false',
            'limit': 200,
            'fields': 'severity'
        })

        if 'data' not in response:
            print("❌ No data received")
            return False

        issues = response['data']
        total_count = response.get('totalCount', 0)
        print(f"   ✅ Retrieved {len(issues)} issues (Total: {total_count})")

        print("\n2. Counting by severity...")
        severity_dist = defaultdict(int)

        for issue in issues:
            severity = issue.get('severity', 'Unknown')
            severity_dist[severity] += 1

        # Extrapolate to total if we only got a sample
        if len(issues) < total_count and len(issues) > 0:
            print(f"\n3. Extrapolating to total count ({total_count})...")
            scale_factor = total_count / len(issues)
            for severity in severity_dist:
                severity_dist[severity] = int(severity_dist[severity] * scale_factor)

        print("\n📊 Dashboard Output:")
        table_data = [[sev, count] for sev, count in sorted(severity_dist.items())]
        print(tabulate(table_data, headers=['Severity', 'Count'], tablefmt='grid'))

        return True

    except Exception as e:
        print(f"❌ Transformation failed: {str(e)}")
        return False


def transform_scan_coverage(client: SSCApiClient):
    """
    Calculate scan coverage percentages
    Dashboard needs: { sast: %, dast: %, sca: %, other: % }
    """
    print("\n" + "="*80)
    print("TRANSFORMATION: Scan Coverage Calculation")
    print("="*80)

    try:
        print("\n1. Fetching active project versions...")
        versions_response = client.get('/projectVersions', params={
            'includeInactive': 'false',
            'limit': 50  # Sample for demo
        })

        if 'data' not in versions_response:
            print("❌ No data received")
            return False

        versions = versions_response['data']
        print(f"   ✅ Retrieved {len(versions)} versions")

        print("\n2. Checking scan types for each version...")
        coverage_stats = {
            'SAST': 0,
            'DAST': 0,
            'SCA': 0,
            'Other': 0,
            'total': len(versions)
        }

        for i, version in enumerate(versions[:20], 1):  # Limit to 20 for demo
            version_id = version['id']

            if i % 5 == 0:
                print(f"   Processing... {i}/20")

            try:
                artifacts_response = client.get(f'/projectVersions/{version_id}/artifacts', params={
                    'embed': 'scans',
                    'limit': 50
                })

                if 'data' in artifacts_response:
                    scan_types_found = set()

                    for artifact in artifacts_response['data']:
                        if 'embed' in artifact and 'scans' in artifact['embed']:
                            for scan in artifact['embed']['scans']:
                                scan_type = scan.get('scanType', 'Other')
                                scan_types_found.add(scan_type)

                    # Update coverage
                    for scan_type in scan_types_found:
                        if scan_type in coverage_stats:
                            coverage_stats[scan_type] += 1
                        else:
                            coverage_stats['Other'] += 1

            except Exception:
                continue

        print("\n3. Calculating coverage percentages...")
        total = 20  # We checked 20 versions

        coverage_percentages = {}
        for scan_type in ['SAST', 'DAST', 'SCA', 'Other']:
            count = coverage_stats[scan_type]
            percentage = (count / total * 100) if total > 0 else 0
            coverage_percentages[scan_type] = percentage

        print("\n📊 Dashboard Output:")
        table_data = [[st, f"{coverage_percentages[st]:.1f}%"] for st in ['SAST', 'DAST', 'SCA', 'Other']]
        print(tabulate(table_data, headers=['Scan Type', 'Coverage'], tablefmt='grid'))

        return True

    except Exception as e:
        print(f"❌ Transformation failed: {str(e)}")
        return False


def transform_mttr(client: SSCApiClient):
    """
    Calculate Mean Time To Remediate
    Dashboard needs: { overall: days, critical: days, high: days, medium: days, low: days }
    """
    print("\n" + "="*80)
    print("TRANSFORMATION: Mean Time To Remediate (MTTR)")
    print("="*80)

    try:
        print("\n1. Fetching remediated issues (last 90 days)...")

        from datetime import datetime, timedelta
        ninety_days_ago = (datetime.now() - timedelta(days=90)).strftime('%Y-%m-%d')

        response = client.get('/issues', params={
            'q': f'removed:true+removedDate:[{ninety_days_ago} TO *]',
            'limit': 100,
            'fields': 'severity,foundDate,removedDate'
        })

        if 'data' not in response:
            print("❌ No data received")
            return False

        issues = response['data']
        print(f"   ✅ Retrieved {len(issues)} remediated issues")

        print("\n2. Calculating remediation time per issue...")
        remediation_times = defaultdict(list)

        for issue in issues:
            severity = issue.get('severity', 'Unknown')
            found_date_str = issue.get('foundDate')
            removed_date_str = issue.get('removedDate')

            if found_date_str and removed_date_str:
                try:
                    # Parse dates (SSC format: 2024-01-15T10:30:00.000+0000)
                    found_date = datetime.fromisoformat(found_date_str.replace('Z', '+00:00').split('+')[0])
                    removed_date = datetime.fromisoformat(removed_date_str.replace('Z', '+00:00').split('+')[0])

                    # Calculate days
                    days_to_remediate = (removed_date - found_date).total_seconds() / 86400

                    if days_to_remediate >= 0:  # Sanity check
                        remediation_times[severity].append(days_to_remediate)
                        remediation_times['All'].append(days_to_remediate)

                except Exception:
                    continue

        print("\n3. Calculating mean times...")
        mttr = {}

        for severity, times in remediation_times.items():
            if times:
                mttr[severity] = sum(times) / len(times)

        print("\n📊 Dashboard Output (MTTR in days):")
        table_data = [[sev, f"{days:.1f}"] for sev, days in sorted(mttr.items())]
        print(tabulate(table_data, headers=['Severity', 'MTTR (days)'], tablefmt='grid'))

        return True

    except Exception as e:
        print(f"❌ Transformation failed: {str(e)}")
        return False


def transform_top_vulnerabilities(client: SSCApiClient):
    """
    Get top vulnerability categories with severity breakdown
    Dashboard needs: [ { category, total, critical, high, medium, low, versions } ]
    """
    print("\n" + "="*80)
    print("TRANSFORMATION: Top Vulnerability Categories")
    print("="*80)

    try:
        print("\n1. Fetching open issues...")
        response = client.get('/issues', params={
            'q': 'removed:false',
            'limit': 200,
            'fields': 'issueName,severity,projectVersionId'
        })

        if 'data' not in response:
            print("❌ No data received")
            return False

        issues = response['data']
        print(f"   ✅ Retrieved {len(issues)} issues")

        print("\n2. Grouping by category and severity...")
        category_data = defaultdict(lambda: {
            'total': 0,
            'Critical': 0,
            'High': 0,
            'Medium': 0,
            'Low': 0,
            'versions': set()
        })

        for issue in issues:
            category = issue.get('issueName', 'Unknown')
            severity = issue.get('severity', 'Unknown')
            version_id = issue.get('projectVersionId')

            category_data[category]['total'] += 1
            if severity in category_data[category]:
                category_data[category][severity] += 1
            if version_id:
                category_data[category]['versions'].add(version_id)

        print("\n3. Sorting by total count...")
        sorted_categories = sorted(
            category_data.items(),
            key=lambda x: x[1]['total'],
            reverse=True
        )[:10]  # Top 10

        print("\n📊 Dashboard Output (Top 10 Vulnerabilities):")
        table_data = []
        for category, data in sorted_categories:
            table_data.append([
                category[:35],
                data['total'],
                data['Critical'],
                data['High'],
                data['Medium'],
                data['Low'],
                len(data['versions'])
            ])

        print(tabulate(table_data,
                      headers=['Category', 'Total', 'Crit', 'High', 'Med', 'Low', 'Versions'],
                      tablefmt='grid'))

        return True

    except Exception as e:
        print(f"❌ Transformation failed: {str(e)}")
        return False


def main():
    """Run all transformation examples"""
    print("\n" + "🔄"*40)
    print("SSC DATA TRANSFORMATIONS - EXAMPLES")
    print("🔄"*40)
    print("\nThese examples show how to transform SSC API data")
    print("into the format needed for the ASPM dashboard")

    try:
        # Initialize client
        client = SSCApiClient()

        # Test connection
        if not client.test_connection():
            print("❌ Cannot proceed - connection failed")
            return

        # Run transformations
        transformations = [
            ("Policy Compliance", transform_policy_compliance),
            ("Severity Distribution", transform_severity_distribution),
            ("Scan Coverage", transform_scan_coverage),
            ("MTTR Calculation", transform_mttr),
            ("Top Vulnerabilities", transform_top_vulnerabilities)
        ]

        results = []

        for name, transform_func in transformations:
            print("\n\n")
            success = transform_func(client)
            results.append((name, success))

        # Summary
        print("\n\n" + "="*80)
        print("TRANSFORMATIONS SUMMARY")
        print("="*80)

        summary_table = [[name, '✅ SUCCESS' if success else '❌ FAILED'] for name, success in results]
        print(tabulate(summary_table, headers=['Transformation', 'Result'], tablefmt='grid'))

        passed = sum(1 for _, success in results if success)
        print(f"\nSuccessful Transformations: {passed}/{len(results)}")

        print("\n📝 Note: These transformations will be implemented in the Node.js backend")
        print("   See backend/transformers/ for production implementations")

    except Exception as e:
        print(f"\n❌ Transformations demo failed: {str(e)}")


if __name__ == "__main__":
    main()

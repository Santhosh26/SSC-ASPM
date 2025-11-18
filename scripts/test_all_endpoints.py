"""
Comprehensive SSC API Test Suite
Runs all endpoint tests and generates a complete report
"""

import sys
import time
from ssc_api_client import SSCApiClient
from tabulate import tabulate


def run_test_module(module_name, description):
    """Run a test module and return results"""
    print(f"\n{'='*80}")
    print(f"RUNNING: {description}")
    print(f"{'='*80}\n")

    start_time = time.time()

    try:
        # Import and run the module
        if module_name == 'projects_versions':
            import test_projects_versions
            test_projects_versions.main()
        elif module_name == 'issues':
            import test_issues
            test_issues.main()
        elif module_name == 'artifacts_scans':
            import test_artifacts_scans
            test_artifacts_scans.main()
        elif module_name == 'transformations':
            import transformations
            transformations.main()

        elapsed = time.time() - start_time
        print(f"\n✅ {description} completed in {elapsed:.2f}s")
        return True, elapsed

    except Exception as e:
        elapsed = time.time() - start_time
        print(f"\n❌ {description} failed: {str(e)}")
        return False, elapsed


def test_performance_indicators(client: SSCApiClient):
    """Quick test of performance indicators endpoint"""
    print("\n" + "="*80)
    print("QUICK TEST: Performance Indicators")
    print("="*80)

    try:
        # Get first project version with performance indicators
        response = client.get('/projectVersions', params={
            'limit': 5,
            'embed': 'performanceIndicators'
        })

        if 'data' in response and response['data']:
            for version in response['data']:
                if 'performanceIndicators' in version and version['performanceIndicators']:
                    print(f"\n✅ Found performance indicators for version: {version.get('name')}")

                    pis = version['performanceIndicators']
                    print(f"   Total indicators: {len(pis)}")

                    # Look for FortifySecurityRating
                    for pi in pis:
                        if 'FortifySecurityRating' in pi.get('name', ''):
                            value = pi.get('value')
                            print(f"\n   🎯 FortifySecurityRating found: {value}")
                            print(f"   This can be used for compliance calculations:")
                            print(f"     5.0 → Pass")
                            print(f"     1.0 → Fail")
                            print(f"     null → Unassessed")
                            return True

            print("\n⚠️  FortifySecurityRating not found in sampled versions")
            return False
        else:
            print("⚠️  No project versions found")
            return False

    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
        return False


def test_custom_attributes(client: SSCApiClient):
    """Quick test of custom attributes"""
    print("\n" + "="*80)
    print("QUICK TEST: Custom Attributes")
    print("="*80)

    try:
        response = client.get('/projectVersions', params={
            'limit': 5,
            'embed': 'variables'
        })

        if 'data' in response and response['data']:
            attributes_found = set()

            for version in response['data']:
                if 'variables' in version and version['variables']:
                    for var in version['variables']:
                        attr_name = var.get('name', '')
                        if attr_name:
                            attributes_found.add(attr_name)

            if attributes_found:
                print(f"\n✅ Found {len(attributes_found)} unique custom attributes:")
                for attr in sorted(attributes_found):
                    print(f"   - {attr}")

                # Check for dashboard filter attributes
                required_attrs = ['Business Unit', 'Business Criticality', 'Application Type', 'SDLC Status']
                print(f"\n🔍 Checking for dashboard filter attributes:")
                for req_attr in required_attrs:
                    # Check for various name formats
                    found = any(req_attr.lower() in attr.lower() for attr in attributes_found)
                    status = '✅' if found else '❌'
                    print(f"   {status} {req_attr}")

                return True
            else:
                print("⚠️  No custom attributes found")
                return False
        else:
            print("⚠️  No project versions found")
            return False

    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
        return False


def main():
    """Run comprehensive test suite"""
    print("\n" + "🚀"*40)
    print("FORTIFY SSC API - COMPREHENSIVE TEST SUITE")
    print("🚀"*40)

    overall_start = time.time()
    test_results = []

    try:
        # Initialize client
        print("\n📡 Initializing SSC API Client...")
        client = SSCApiClient()

        # Test connection first
        print("\n🔌 Testing connection to SSC...")
        if not client.test_connection():
            print("\n❌ CRITICAL: Cannot connect to SSC API")
            print("Please check:")
            print("  1. SSC_URL in .env file")
            print("  2. SSC_TOKEN in .env file")
            print("  3. Network connectivity")
            print("  4. SSC server status")
            return

        print("✅ Connection successful!\n")

        # Quick tests before running modules
        print("\n" + "⚡"*40)
        print("QUICK VALIDATION TESTS")
        print("⚡"*40)

        # Test performance indicators
        success = test_performance_indicators(client)
        test_results.append(("Performance Indicators Check", success, "Quick", 0))

        # Test custom attributes
        success = test_custom_attributes(client)
        test_results.append(("Custom Attributes Check", success, "Quick", 0))

        # Run test modules
        print("\n\n" + "🧪"*40)
        print("RUNNING TEST MODULES")
        print("🧪"*40)

        modules = [
            ('projects_versions', 'Projects & Versions Tests'),
            ('issues', 'Issues & Vulnerabilities Tests'),
            ('artifacts_scans', 'Artifacts & Scans Tests'),
        ]

        for module_name, description in modules:
            success, elapsed = run_test_module(module_name, description)
            test_results.append((description, success, "Full Module", elapsed))
            time.sleep(1)  # Brief pause between modules

        # Run transformations demo
        print("\n\n" + "🔄"*40)
        print("DATA TRANSFORMATION EXAMPLES")
        print("🔄"*40)

        success, elapsed = run_test_module('transformations', 'Data Transformations Demo')
        test_results.append(("Transformations Demo", success, "Demo", elapsed))

        # Final summary
        overall_elapsed = time.time() - overall_start

        print("\n\n" + "="*80)
        print("FINAL TEST SUMMARY")
        print("="*80)

        # Create summary table
        summary_table = []
        for name, success, test_type, elapsed in test_results:
            status = '✅ PASS' if success else '❌ FAIL'
            time_str = f"{elapsed:.2f}s" if elapsed > 0 else "N/A"
            summary_table.append([name, status, test_type, time_str])

        print(tabulate(summary_table,
                      headers=['Test Suite', 'Result', 'Type', 'Duration'],
                      tablefmt='grid'))

        # Statistics
        passed = sum(1 for _, success, _, _ in test_results if success)
        total = len(test_results)
        pass_rate = (passed / total * 100) if total > 0 else 0

        print(f"\n📊 Statistics:")
        print(f"   Total Tests: {total}")
        print(f"   Passed: {passed}")
        print(f"   Failed: {total - passed}")
        print(f"   Pass Rate: {pass_rate:.1f}%")
        print(f"   Total Duration: {overall_elapsed:.2f}s")

        # Final verdict
        print(f"\n{'='*80}")
        if passed == total:
            print("✅ ALL TESTS PASSED!")
            print("   SSC API is fully functional and ready for dashboard integration")
        elif pass_rate >= 75:
            print("⚠️  MOST TESTS PASSED")
            print("   SSC API is mostly functional, review failed tests")
        else:
            print("❌ MANY TESTS FAILED")
            print("   Please review SSC configuration and failed tests")
        print(f"{'='*80}\n")

        # Next steps
        print("📝 Next Steps:")
        print("   1. Review sample JSON files in scripts/samples/")
        print("   2. Check TEST_RESULTS.md for detailed findings")
        print("   3. Verify custom attributes match dashboard filters")
        print("   4. Proceed to Phase 2: Backend development")

    except KeyboardInterrupt:
        print("\n\n⚠️  Test suite interrupted by user")
    except Exception as e:
        print(f"\n\n❌ Test suite failed with error: {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()

"""
Fortify SSC API Client
Provides base functionality for authenticating and making requests to SSC API
"""

import os
import sys
import json
import requests
from dotenv import load_dotenv
from typing import Optional, Dict, Any

# Fix Windows console encoding for emoji support
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except:
        pass

# Load environment variables
load_dotenv()

class SSCApiClient:
    """Client for interacting with Fortify SSC API"""

    def __init__(self):
        self.base_url = os.getenv('SSC_URL')
        self.token = os.getenv('SSC_TOKEN')

        if not self.base_url or not self.token:
            raise ValueError("SSC_URL and SSC_TOKEN must be set in .env file")

        self.headers = {
            'Authorization': f'FortifyToken {self.token}',
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }

        self.timeout = 30  # seconds

    def get(self, endpoint: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Make a GET request to SSC API

        Args:
            endpoint: API endpoint (e.g., '/projects', '/projectVersions')
            params: Optional query parameters

        Returns:
            JSON response as dictionary

        Raises:
            requests.exceptions.RequestException: On API errors
        """
        url = f"{self.base_url}{endpoint}"

        try:
            response = requests.get(
                url,
                headers=self.headers,
                params=params,
                timeout=self.timeout,
                verify=True  # Enable SSL verification
            )

            # Raise exception for bad status codes
            response.raise_for_status()

            return response.json()

        except requests.exceptions.Timeout:
            print(f"❌ Timeout while requesting {endpoint}")
            raise
        except requests.exceptions.ConnectionError:
            print(f"❌ Connection error while requesting {endpoint}")
            raise
        except requests.exceptions.HTTPError as e:
            print(f"❌ HTTP error {response.status_code} while requesting {endpoint}")
            print(f"   Response: {response.text[:200]}")
            raise
        except Exception as e:
            print(f"❌ Unexpected error while requesting {endpoint}: {str(e)}")
            raise

    def test_connection(self) -> bool:
        """
        Test connection to SSC API

        Returns:
            True if connection successful, False otherwise
        """
        try:
            print(f"🔍 Testing connection to {self.base_url}")
            response = self.get('/projectVersions', params={'limit': 1})

            if 'data' in response:
                print(f"✅ Connection successful!")
                print(f"   Response code: {response.get('responseCode', 'N/A')}")
                return True
            else:
                print(f"⚠️  Unexpected response format: {list(response.keys())}")
                return False

        except Exception as e:
            print(f"❌ Connection test failed: {str(e)}")
            return False

    def save_sample(self, filename: str, data: Any) -> None:
        """
        Save sample response data to file

        Args:
            filename: Name of file to save (will be placed in samples/ directory)
            data: Data to save (will be JSON serialized)
        """
        filepath = os.path.join('samples', filename)

        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            print(f"   💾 Saved sample to {filepath}")
        except Exception as e:
            print(f"   ⚠️  Failed to save sample: {str(e)}")

    def print_response_summary(self, response: Dict[str, Any], title: str = "Response") -> None:
        """
        Print a summary of API response

        Args:
            response: API response dictionary
            title: Title for the summary
        """
        print(f"\n{'='*60}")
        print(f"{title}")
        print(f"{'='*60}")

        if 'responseCode' in response:
            print(f"Response Code: {response['responseCode']}")

        if 'data' in response:
            data = response['data']
            if isinstance(data, list):
                print(f"Data Type: List")
                print(f"Count: {len(data)}")
                if data:
                    print(f"First item keys: {list(data[0].keys())}")
            elif isinstance(data, dict):
                print(f"Data Type: Dict")
                print(f"Keys: {list(data.keys())}")

        if 'count' in response:
            print(f"Count (current page): {response['count']}")

        if 'totalCount' in response:
            print(f"Total Count: {response['totalCount']}")

        print(f"{'='*60}\n")


# Test the client if run directly
if __name__ == "__main__":
    print("Fortify SSC API Client Test\n")

    try:
        client = SSCApiClient()
        print(f"Base URL: {client.base_url}")
        print(f"Token: {client.token[:10]}...")
        print()

        # Test connection
        if client.test_connection():
            print("\n✅ SSC API Client is ready to use!")
        else:
            print("\n❌ SSC API Client failed connection test")

    except Exception as e:
        print(f"\n❌ Failed to initialize client: {str(e)}")

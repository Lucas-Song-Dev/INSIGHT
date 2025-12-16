"""
Tests that simulate the exact browser CORS preflight behavior
based on the error logs from the frontend
"""
import pytest
from flask import Flask


class TestBrowserCORSSimulation:
    """Simulate exact browser CORS preflight requests"""
    
    def test_browser_preflight_to_login(self, client):
        """Simulate the exact OPTIONS request the browser sends"""
        # This is what the browser sends for a POST to /api/login
        response = client.options(
            '/api/login',
            headers={
                'Origin': 'http://localhost:5173',
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'content-type',
                'Referer': 'http://localhost:5173/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        )
        
        print(f"\n[TEST] Browser-like OPTIONS to /api/login")
        print(f"[TEST] Status Code: {response.status_code}")
        print(f"[TEST] Response Headers:")
        for key, value in response.headers.items():
            if 'access-control' in key.lower():
                print(f"  {key}: {value}")
        
        # Critical checks that would cause browser CORS errors
        assert response.status_code == 200, f"OPTIONS must return 200, got {response.status_code}"
        assert 'Access-Control-Allow-Origin' in response.headers, "Missing Access-Control-Allow-Origin (browser will block)"
        assert 'Access-Control-Allow-Methods' in response.headers, "Missing Access-Control-Allow-Methods (browser will block)"
        assert 'Access-Control-Allow-Headers' in response.headers, "Missing Access-Control-Allow-Headers (browser will block)"
        assert 'Access-Control-Allow-Credentials' in response.headers, "Missing Access-Control-Allow-Credentials (browser will block)"
        
        # Check that the origin is allowed
        assert response.headers['Access-Control-Allow-Origin'] == 'http://localhost:5173'
        assert response.headers['Access-Control-Allow-Credentials'] == 'true'
        assert 'POST' in response.headers['Access-Control-Allow-Methods']
        assert 'content-type' in response.headers['Access-Control-Allow-Headers'].lower()
    
    def test_browser_preflight_to_status(self, client):
        """Simulate OPTIONS request to /api/status (from error logs)"""
        response = client.options(
            '/api/status',
            headers={
                'Origin': 'http://localhost:5173',
                'Access-Control-Request-Method': 'GET',
                'Referer': 'http://localhost:5173/'
            }
        )
        
        print(f"\n[TEST] Browser-like OPTIONS to /api/status")
        print(f"[TEST] Status Code: {response.status_code}")
        print(f"[TEST] CORS Headers Present: {all(h in response.headers for h in ['Access-Control-Allow-Origin', 'Access-Control-Allow-Methods'])}")
        
        assert response.status_code == 200
        assert 'Access-Control-Allow-Origin' in response.headers
    
    def test_full_browser_request_flow(self, client):
        """Test the full flow: OPTIONS preflight -> actual POST request"""
        # Step 1: Browser sends OPTIONS preflight
        print("\n[TEST] Step 1: Browser sends OPTIONS preflight...")
        preflight = client.options(
            '/api/login',
            headers={
                'Origin': 'http://localhost:5173',
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'content-type, authorization',
                'Referer': 'http://localhost:5173/'
            }
        )
        
        print(f"  Preflight Status: {preflight.status_code}")
        print(f"  Has CORS Headers: {'Access-Control-Allow-Origin' in preflight.headers}")
        
        # Preflight must succeed
        assert preflight.status_code == 200, "Preflight failed - browser will block actual request"
        assert 'Access-Control-Allow-Origin' in preflight.headers, "Preflight missing CORS headers - browser will block"
        
        # Step 2: Browser sends actual POST request
        print("\n[TEST] Step 2: Browser sends actual POST request...")
        post_response = client.post(
            '/api/login',
            json={'username': 'test', 'password': 'test'},
            headers={
                'Origin': 'http://localhost:5173',
                'Content-Type': 'application/json',
                'Referer': 'http://localhost:5173/'
            }
        )
        
        print(f"  POST Status: {post_response.status_code}")
        print(f"  Has CORS Headers: {'Access-Control-Allow-Origin' in post_response.headers}")
        
        # POST response must also have CORS headers
        assert 'Access-Control-Allow-Origin' in post_response.headers, "POST response missing CORS headers - browser will block"
        assert post_response.headers['Access-Control-Allow-Origin'] == 'http://localhost:5173'
    
    def test_cors_headers_in_error_responses(self, client):
        """Test that error responses (401, 404, etc.) also have CORS headers"""
        # Test 401 error (unauthorized)
        response = client.post(
            '/api/login',
            json={'username': 'nonexistent', 'password': 'wrong'},
            headers={
                'Origin': 'http://localhost:5173',
                'Content-Type': 'application/json'
            }
        )
        
        print(f"\n[TEST] Error response (401) CORS headers check")
        print(f"[TEST] Status: {response.status_code}")
        print(f"[TEST] Has CORS Headers: {'Access-Control-Allow-Origin' in response.headers}")
        
        # Even error responses need CORS headers
        assert 'Access-Control-Allow-Origin' in response.headers, "Error responses must have CORS headers"
        assert response.headers['Access-Control-Allow-Origin'] == 'http://localhost:5173'
    
    def test_cors_with_credentials(self, client):
        """Test that CORS works with credentials (cookies)"""
        response = client.options(
            '/api/login',
            headers={
                'Origin': 'http://localhost:5173',
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'content-type',
                'Cookie': 'test=value'  # Simulate cookie being sent
            }
        )
        
        print(f"\n[TEST] CORS with credentials")
        print(f"[TEST] Status: {response.status_code}")
        print(f"[TEST] Allow-Credentials: {response.headers.get('Access-Control-Allow-Credentials')}")
        
        assert response.status_code == 200
        assert response.headers.get('Access-Control-Allow-Credentials') == 'true', "Must allow credentials for cookie-based auth"
    
    def test_multiple_origins(self, client):
        """Test that different allowed origins work correctly"""
        origins = [
            'http://localhost:5173',
            'https://reddit-painpoint-4nx9b.ondigitalocean.app',
            'https://iinsightss.com'
        ]
        
        for origin in origins:
            response = client.options(
                '/api/login',
                headers={
                    'Origin': origin,
                    'Access-Control-Request-Method': 'POST'
                }
            )
            
            print(f"\n[TEST] Testing origin: {origin}")
            print(f"[TEST] Status: {response.status_code}")
            print(f"[TEST] Allowed-Origin: {response.headers.get('Access-Control-Allow-Origin')}")
            
            assert response.status_code == 200
            assert response.headers.get('Access-Control-Allow-Origin') == origin


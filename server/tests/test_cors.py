"""
Tests for CORS preflight and cross-origin requests
"""
import pytest
from flask import Flask


class TestCORSPreflight:
    """Test CORS OPTIONS preflight requests"""
    
    def test_options_login_endpoint(self, client):
        """Test OPTIONS request to /api/login endpoint"""
        response = client.options(
            '/api/login',
            headers={
                'Origin': 'http://localhost:5173',
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'Content-Type, Authorization'
            }
        )
        
        print(f"\n[TEST] OPTIONS /api/login - Status: {response.status_code}")
        print(f"[TEST] Response headers: {dict(response.headers)}")
        
        # Should return 200 OK
        assert response.status_code == 200, f"Expected 200, got {response.status_code}. Response: {response.data}"
        
        # Check for CORS headers
        assert 'Access-Control-Allow-Origin' in response.headers, "Missing Access-Control-Allow-Origin header"
        assert 'Access-Control-Allow-Methods' in response.headers, "Missing Access-Control-Allow-Methods header"
        assert 'Access-Control-Allow-Headers' in response.headers, "Missing Access-Control-Allow-Headers header"
        assert 'Access-Control-Allow-Credentials' in response.headers, "Missing Access-Control-Allow-Credentials header"
        
        # Check header values
        assert response.headers['Access-Control-Allow-Origin'] == 'http://localhost:5173'
        assert 'POST' in response.headers['Access-Control-Allow-Methods']
        assert 'OPTIONS' in response.headers['Access-Control-Allow-Methods']
        assert response.headers['Access-Control-Allow-Credentials'] == 'true'
    
    def test_options_register_endpoint(self, client):
        """Test OPTIONS request to /api/register endpoint"""
        response = client.options(
            '/api/register',
            headers={
                'Origin': 'http://localhost:5173',
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'Content-Type'
            }
        )
        
        print(f"\n[TEST] OPTIONS /api/register - Status: {response.status_code}")
        print(f"[TEST] Response headers: {dict(response.headers)}")
        
        assert response.status_code == 200
        assert 'Access-Control-Allow-Origin' in response.headers
        assert response.headers['Access-Control-Allow-Origin'] == 'http://localhost:5173'
    
    def test_options_status_endpoint(self, client):
        """Test OPTIONS request to /api/status endpoint"""
        response = client.options(
            '/api/status',
            headers={
                'Origin': 'http://localhost:5173',
                'Access-Control-Request-Method': 'GET'
            }
        )
        
        print(f"\n[TEST] OPTIONS /api/status - Status: {response.status_code}")
        print(f"[TEST] Response headers: {dict(response.headers)}")
        
        assert response.status_code == 200
        assert 'Access-Control-Allow-Origin' in response.headers
    
    def test_options_with_production_origin(self, client):
        """Test OPTIONS request with production origin"""
        response = client.options(
            '/api/login',
            headers={
                'Origin': 'https://reddit-painpoint-4nx9b.ondigitalocean.app',
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'Content-Type, Authorization'
            }
        )
        
        print(f"\n[TEST] OPTIONS with production origin - Status: {response.status_code}")
        print(f"[TEST] Response headers: {dict(response.headers)}")
        
        assert response.status_code == 200
        assert 'Access-Control-Allow-Origin' in response.headers
        assert response.headers['Access-Control-Allow-Origin'] == 'https://reddit-painpoint-4nx9b.ondigitalocean.app'
    
    def test_options_with_disallowed_origin(self, client):
        """Test OPTIONS request with disallowed origin"""
        response = client.options(
            '/api/login',
            headers={
                'Origin': 'https://evil.com',
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'Content-Type'
            }
        )
        
        print(f"\n[TEST] OPTIONS with disallowed origin - Status: {response.status_code}")
        print(f"[TEST] Response headers: {dict(response.headers)}")
        
        # Should still return 200 (the CORSResource handles it)
        # But Flask-CORS might reject it in after_request
        assert response.status_code == 200
    
    def test_post_after_preflight(self, client):
        """Test that POST request works after OPTIONS preflight"""
        # First, send OPTIONS preflight
        options_response = client.options(
            '/api/login',
            headers={
                'Origin': 'http://localhost:5173',
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'Content-Type, Authorization'
            }
        )
        
        print(f"\n[TEST] Preflight OPTIONS - Status: {options_response.status_code}")
        assert options_response.status_code == 200
        
        # Then, send actual POST request
        post_response = client.post(
            '/api/login',
            json={'username': 'test', 'password': 'test'},
            headers={
                'Origin': 'http://localhost:5173',
                'Content-Type': 'application/json'
            }
        )
        
        print(f"[TEST] POST after preflight - Status: {post_response.status_code}")
        print(f"[TEST] POST Response headers: {dict(post_response.headers)}")
        
        # Should have CORS headers in response
        assert 'Access-Control-Allow-Origin' in post_response.headers
        assert post_response.headers['Access-Control-Allow-Origin'] == 'http://localhost:5173'
    
    def test_all_endpoints_have_cors_support(self, client):
        """Test that all main endpoints support OPTIONS"""
        endpoints = [
            '/api/login',
            '/api/register',
            '/api/logout',
            '/api/status',
            '/api/scrape',
            '/api/posts',
            '/api/pain-points',
            '/api/health'
        ]
        
        for endpoint in endpoints:
            response = client.options(
                endpoint,
                headers={
                    'Origin': 'http://localhost:5173',
                    'Access-Control-Request-Method': 'POST'
                }
            )
            
            print(f"\n[TEST] OPTIONS {endpoint} - Status: {response.status_code}")
            
            assert response.status_code == 200, f"OPTIONS failed for {endpoint}"
            assert 'Access-Control-Allow-Origin' in response.headers, f"Missing CORS headers for {endpoint}"


class TestCORSActualRequests:
    """Test actual cross-origin requests (not just preflight)"""
    
    def test_post_login_with_cors_headers(self, client):
        """Test POST to login with CORS headers in response"""
        response = client.post(
            '/api/login',
            json={'username': 'testuser', 'password': 'wrongpass'},
            headers={
                'Origin': 'http://localhost:5173',
                'Content-Type': 'application/json'
            }
        )
        
        print(f"\n[TEST] POST /api/login with Origin - Status: {response.status_code}")
        print(f"[TEST] Response headers: {dict(response.headers)}")
        
        # Should have CORS headers even if auth fails
        assert 'Access-Control-Allow-Origin' in response.headers
        assert response.headers['Access-Control-Allow-Origin'] == 'http://localhost:5173'
        assert response.headers['Access-Control-Allow-Credentials'] == 'true'
    
    def test_get_status_with_cors_headers(self, client):
        """Test GET to status with CORS headers"""
        response = client.get(
            '/api/status',
            headers={
                'Origin': 'http://localhost:5173'
            }
        )
        
        print(f"\n[TEST] GET /api/status with Origin - Status: {response.status_code}")
        print(f"[TEST] Response headers: {dict(response.headers)}")
        
        assert response.status_code == 200
        assert 'Access-Control-Allow-Origin' in response.headers
        assert response.headers['Access-Control-Allow-Origin'] == 'http://localhost:5173'


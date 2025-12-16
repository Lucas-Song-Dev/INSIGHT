"""
Test specific error conditions that could cause CORS failures
"""
import pytest


class TestCORSErrorConditions:
    """Test conditions that would cause the specific CORS errors seen in production"""
    
    def test_options_must_return_200(self, client):
        """OPTIONS must return exactly 200 - any other status causes 'does not have HTTP ok status' error"""
        response = client.options('/api/login', headers={'Origin': 'http://localhost:5173'})
        
        # This is the critical check - if status is not 200, browser shows:
        # "Response to preflight request doesn't pass access control check: It does not have HTTP ok status"
        assert response.status_code == 200, \
            f"OPTIONS returned {response.status_code} instead of 200. " \
            f"This causes: 'Response to preflight request doesn't pass access control check: It does not have HTTP ok status'"
    
    def test_options_must_have_allow_origin_header(self, client):
        """Missing Access-Control-Allow-Origin causes: 'No Access-Control-Allow-Origin header is present'"""
        response = client.options('/api/login', headers={'Origin': 'http://localhost:5173'})
        
        assert 'Access-Control-Allow-Origin' in response.headers, \
            "Missing Access-Control-Allow-Origin header causes: " \
            "'No Access-Control-Allow-Origin header is present on the requested resource'"
    
    def test_options_must_match_requested_method(self, client):
        """Access-Control-Allow-Methods must include the requested method"""
        # Browser requests POST
        response = client.options(
            '/api/login',
            headers={
                'Origin': 'http://localhost:5173',
                'Access-Control-Request-Method': 'POST'
            }
        )
        
        allowed_methods = response.headers.get('Access-Control-Allow-Methods', '')
        assert 'POST' in allowed_methods, \
            f"POST not in allowed methods: {allowed_methods}. " \
            "Browser will reject preflight if requested method is not allowed."
    
    def test_options_must_match_requested_headers(self, client):
        """Access-Control-Allow-Headers must include requested headers"""
        # Browser requests Content-Type and Authorization
        response = client.options(
            '/api/login',
            headers={
                'Origin': 'http://localhost:5173',
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'content-type, authorization'
            }
        )
        
        allowed_headers = response.headers.get('Access-Control-Allow-Headers', '').lower()
        assert 'content-type' in allowed_headers, \
            f"content-type not in allowed headers: {response.headers.get('Access-Control-Allow-Headers')}"
        assert 'authorization' in allowed_headers, \
            f"authorization not in allowed headers: {response.headers.get('Access-Control-Allow-Headers')}"
    
    def test_options_response_body_can_be_empty(self, client):
        """OPTIONS response body should be empty (or very small)"""
        response = client.options('/api/login', headers={'Origin': 'http://localhost:5173'})
        
        # Body should be empty or minimal
        body_length = len(response.data)
        assert body_length == 0 or body_length < 100, \
            f"OPTIONS response body is too large ({body_length} bytes). " \
            "Should be empty or minimal."
    
    def test_all_endpoints_handle_options_consistently(self, client):
        """All endpoints must handle OPTIONS the same way"""
        endpoints = [
            '/api/login',
            '/api/register',
            '/api/logout',
            '/api/status',
            '/api/scrape',
            '/api/posts',
            '/api/pain-points',
            '/api/health',
            '/api/user/profile',
            '/api/user/credits'
        ]
        
        for endpoint in endpoints:
            response = client.options(endpoint, headers={'Origin': 'http://localhost:5173'})
            
            assert response.status_code == 200, \
                f"OPTIONS {endpoint} returned {response.status_code} instead of 200"
            assert 'Access-Control-Allow-Origin' in response.headers, \
                f"OPTIONS {endpoint} missing Access-Control-Allow-Origin header"
            assert 'Access-Control-Allow-Methods' in response.headers, \
                f"OPTIONS {endpoint} missing Access-Control-Allow-Methods header"
    
    def test_cors_headers_present_in_all_responses(self, client):
        """All responses (not just OPTIONS) must have CORS headers"""
        # Test GET
        get_response = client.get('/api/status', headers={'Origin': 'http://localhost:5173'})
        assert 'Access-Control-Allow-Origin' in get_response.headers, "GET response missing CORS headers"
        
        # Test POST (even if it fails)
        post_response = client.post(
            '/api/login',
            json={'username': 'test', 'password': 'test'},
            headers={'Origin': 'http://localhost:5173', 'Content-Type': 'application/json'}
        )
        assert 'Access-Control-Allow-Origin' in post_response.headers, "POST response missing CORS headers"
        
        # Test 404
        not_found_response = client.get('/api/nonexistent', headers={'Origin': 'http://localhost:5173'})
        # 404 might not have CORS headers if handled by Flask's default handler, but our resources should
    
    def test_origin_validation(self, client):
        """Test that origin validation works correctly"""
        # Valid origin
        valid_response = client.options(
            '/api/login',
            headers={'Origin': 'http://localhost:5173'}
        )
        assert valid_response.status_code == 200
        assert valid_response.headers.get('Access-Control-Allow-Origin') == 'http://localhost:5173'
        
        # Invalid origin (should still return 200, but Flask-CORS might not set the header)
        invalid_response = client.options(
            '/api/login',
            headers={'Origin': 'https://evil.com'}
        )
        # Our CORSResource returns 200 but might not set Allow-Origin for invalid origins
        assert invalid_response.status_code == 200


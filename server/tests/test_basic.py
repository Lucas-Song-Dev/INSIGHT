def test_app_exists(client):
    """Test that the app exists and is configured for testing."""
    assert client is not None

def test_api_endpoints_exist(client):
    """Test that basic API endpoints exist."""
    endpoints = [
        '/api/register',
        '/api/login',
        '/api/pain-points',  # Fixed: correct endpoint name
        '/api/posts',
        '/api/status'
    ]
    
    for endpoint in endpoints:
        response = client.get(endpoint)
        # We don't care about the status code, just that the endpoint exists
        assert response.status_code != 404, f"Endpoint {endpoint} not found" 
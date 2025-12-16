import pytest
import os
import sys
from unittest.mock import Mock, patch, MagicMock

# Add parent directory to path so we can import app
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

@pytest.fixture(scope='session', autouse=True)
def setup_test_env():
    """Set up test environment variables before any tests run"""
    os.environ['MONGODB_URI'] = os.getenv('TEST_MONGODB_URI', 'mongodb://localhost:27017/test_insight_db')
    os.environ['REDDIT_CLIENT_ID'] = 'test_client_id'
    os.environ['REDDIT_CLIENT_SECRET'] = 'test_client_secret'
    os.environ['ANTHROPIC_API_KEY'] = 'test_anthropic_api_key_sk-test-123456789012345678901234567890'
    os.environ['JWT_SECRET_KEY'] = 'test_jwt_secret_key_that_is_at_least_32_chars_long_for_testing'
    os.environ['SESSION_SECRET'] = 'test_session_secret'
    os.environ['ALLOWED_ORIGINS'] = 'http://localhost:5173'

@pytest.fixture(scope='module')
def app():
    """Create a test Flask app."""
    from app import app as flask_app
    flask_app.config['TESTING'] = True
    flask_app.config['WTF_CSRF_ENABLED'] = False
    return flask_app

@pytest.fixture
def client(app):
    """Create a test client for the app."""
    return app.test_client()

@pytest.fixture
def test_user():
    """Create a test user for authentication tests."""
    return {
        'username': 'testuser',
        'password': 'TestPass123!',
        'email': 'test@example.com'
    }

@pytest.fixture
def auth_token(client, test_user):
    """Register a user and return auth token."""
    # Register user
    client.post('/api/register', json=test_user)
    
    # Login and get token
    response = client.post('/api/login', json={
        'username': test_user['username'],
        'password': test_user['password']
    })
    
    if response.status_code == 200:
        return response.json.get('access_token')
    return None

@pytest.fixture
def auth_headers(auth_token):
    """Create authentication headers for testing."""
    if auth_token:
        return {'Authorization': f'Bearer {auth_token}'}
    return {}

@pytest.fixture
def mock_data_store():
    """Create a mock data_store for testing."""
    mock_store = MagicMock()
    mock_store.db = None
    mock_store.scrape_in_progress = False
    mock_store.pain_points = {}
    mock_store.raw_posts = []
    mock_store.analyzed_posts = []
    mock_store.subreddits_scraped = set()
    mock_store.last_scrape_time = None
    mock_store.anthropic_analyses = {}
    return mock_store

@pytest.fixture
def mock_reddit_scraper():
    """Create a mock Reddit scraper for testing."""
    mock_scraper = MagicMock()
    mock_scraper.reddit = MagicMock()
    mock_scraper.time_filters = {
        "hour": "past hour",
        "day": "past 24 hours",
        "week": "past week",
        "month": "past month",
        "year": "past year",
        "all": "all time"
    }
    return mock_scraper

@pytest.fixture
def mock_claude_analyzer():
    """Create a mock Claude analyzer for testing."""
    mock_analyzer = MagicMock()
    mock_analyzer.api_key = 'test_key'
    mock_analyzer.client = MagicMock()
    return mock_analyzer

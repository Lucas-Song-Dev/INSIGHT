"""
Comprehensive tests for API endpoints
"""
import pytest
import json
from unittest.mock import patch, MagicMock
from datetime import datetime

class TestScrapePostsEndpoint:
    """Tests for the ScrapePosts endpoint"""
    
    def test_scrape_requires_auth(self, client):
        """Test that scrape endpoint requires authentication"""
        response = client.post('/api/scrape', json={'topic': 'test'})
        assert response.status_code == 401
    
    def test_scrape_without_topic(self, client, auth_headers):
        """Test scrape endpoint without topic parameter"""
        response = client.post('/api/scrape', json={}, headers=auth_headers)
        assert response.status_code == 400
        assert 'topic' in response.json.get('message', '').lower()
    
    @patch('api.scraper.initialize_client')
    @patch('api.claude_analyzer.suggest_subreddits')
    @patch('api.data_store')
    def test_scrape_valid_request(self, mock_data_store, mock_suggest, mock_init, client, auth_headers):
        """Test valid scrape request"""
        # Setup mocks
        mock_init.return_value = True
        mock_suggest.return_value = {
            'subreddits': ['test_subreddit'],
            'search_queries': ['test query']
        }
        mock_data_store.scrape_in_progress = False
        mock_data_store.update_metadata = MagicMock()
        
        response = client.post('/api/scrape', json={
            'topic': 'VS Code',
            'limit': 50,
            'time_filter': 'week'
        }, headers=auth_headers)
        
        assert response.status_code == 200
        assert response.json['status'] == 'success'
        assert 'topic' in response.json
    
    def test_scrape_invalid_time_filter(self, client, auth_headers):
        """Test scrape with invalid time filter"""
        with patch('api.scraper.initialize_client', return_value=True):
            with patch('api.claude_analyzer.suggest_subreddits'):
                with patch('api.data_store') as mock_store:
                    mock_store.scrape_in_progress = False
                    response = client.post('/api/scrape', json={
                        'topic': 'test',
                        'time_filter': 'invalid'
                    }, headers=auth_headers)
                    assert response.status_code == 400

class TestGetPostsEndpoint:
    """Tests for the GetPosts endpoint"""
    
    def test_get_posts_requires_auth(self, client):
        """Test that get posts requires authentication"""
        response = client.get('/api/posts')
        assert response.status_code == 401
    
    @patch('api.data_store')
    def test_get_posts_without_db(self, mock_store, client, auth_headers):
        """Test get posts when MongoDB is not connected"""
        mock_store.db = None
        mock_store.analyzed_posts = []
        mock_store.raw_posts = []
        
        response = client.get('/api/posts', headers=auth_headers)
        assert response.status_code == 200
        assert 'posts' in response.json
    
    @patch('api.data_store')
    def test_get_posts_with_filters(self, mock_store, client, auth_headers):
        """Test get posts with filters"""
        mock_store.db = MagicMock()
        mock_store.db.posts.find.return_value = []
        mock_store.db.posts.find.return_value.sort.return_value = []
        mock_store.db.posts.find.return_value.sort.return_value.limit.return_value = []
        list(mock_store.db.posts.find().sort().limit())  # Make it iterable
        
        response = client.get('/api/posts?product=test&limit=10', headers=auth_headers)
        assert response.status_code == 200

class TestGetStatusEndpoint:
    """Tests for the GetStatus endpoint"""
    
    def test_get_status_requires_auth(self, client):
        """Test that get status requires authentication"""
        response = client.get('/api/status')
        assert response.status_code == 401
    
    @patch('api.scraper')
    @patch('api.claude_analyzer')
    @patch('api.data_store')
    def test_get_status_success(self, mock_store, mock_claude, mock_scraper, client, auth_headers):
        """Test successful status retrieval"""
        mock_scraper.reddit = MagicMock()
        mock_claude.api_key = 'test_key'
        mock_store.db = None
        mock_store.raw_posts = []
        mock_store.analyzed_posts = []
        mock_store.pain_points = {}
        mock_store.openai_analyses = {}
        mock_store.subreddits_scraped = set()
        mock_store.scrape_in_progress = False
        mock_store.last_scrape_time = None
        
        response = client.get('/api/status', headers=auth_headers)
        assert response.status_code == 200
        assert 'status' in response.json
        assert 'apis' in response.json

class TestRunAnalysisEndpoint:
    """Tests for the RunAnalysis endpoint"""
    
    def test_run_analysis_requires_auth(self, client):
        """Test that run analysis requires authentication"""
        response = client.post('/api/run-analysis', json={'product': 'test'})
        assert response.status_code == 401
    
    def test_run_analysis_without_product(self, client, auth_headers):
        """Test run analysis without product parameter"""
        response = client.post('/api/run-analysis', json={}, headers=auth_headers)
        assert response.status_code == 400
    
    @patch('api.data_store')
    @patch('api.claude_analyzer.analyze_common_pain_points')
    def test_run_analysis_success(self, mock_analyze, mock_store, client, auth_headers):
        """Test successful analysis run"""
        # Mock no posts found
        mock_store.db = None
        mock_store.raw_posts = []
        
        response = client.post('/api/run-analysis', json={'product': 'test'}, headers=auth_headers)
        # Should return 404 if no posts found
        assert response.status_code in [404, 500]

class TestGetAllProductsEndpoint:
    """Tests for the GetAllProducts endpoint"""
    
    def test_get_all_products_requires_auth(self, client):
        """Test that get all products requires authentication"""
        response = client.get('/api/all-products')
        assert response.status_code == 401
    
    @patch('api.data_store')
    def test_get_all_products_success(self, mock_store, client, auth_headers):
        """Test successful get all products"""
        mock_store.db = None
        mock_store.raw_posts = []
        
        response = client.get('/api/all-products', headers=auth_headers)
        assert response.status_code == 200
        assert 'products' in response.json

class TestRecommendationsEndpoint:
    """Tests for the Recommendations endpoint"""
    
    def test_get_recommendations_requires_auth(self, client):
        """Test that get recommendations requires authentication"""
        response = client.get('/api/recommendations')
        assert response.status_code == 401
    
    @patch('api.data_store')
    def test_get_recommendations_no_db(self, mock_store, client, auth_headers):
        """Test get recommendations without database"""
        mock_store.db = None
        mock_store.openai_analyses = {}
        
        response = client.get('/api/recommendations', headers=auth_headers)
        assert response.status_code in [400, 500]

class TestGetPainPointsEndpoint:
    """Tests for the GetPainPoints endpoint"""
    
    def test_get_pain_points_requires_auth(self, client):
        """Test that get pain points requires authentication"""
        response = client.get('/api/pain-points')
        assert response.status_code == 401
    
    @patch('api.data_store')
    def test_get_pain_points_success(self, mock_store, client, auth_headers):
        """Test successful get pain points"""
        mock_store.db = None
        mock_store.pain_points = {}
        
        response = client.get('/api/pain-points', headers=auth_headers)
        assert response.status_code == 200
        assert 'pain_points' in response.json

class TestGetClaudeAnalysisEndpoint:
    """Tests for the GetClaudeAnalysis endpoint"""
    
    def test_get_claude_analysis_requires_auth(self, client):
        """Test that get Claude analysis requires authentication"""
        response = client.get('/api/claude-analysis')
        assert response.status_code == 401
    
    @patch('api.data_store')
    def test_get_claude_analysis_success(self, mock_store, client, auth_headers):
        """Test successful get Claude analysis"""
        mock_store.db = None
        mock_store.openai_analyses = {}
        
        response = client.get('/api/claude-analysis', headers=auth_headers)
        assert response.status_code in [200, 400]

class TestDeleteAccountEndpoint:
    """Tests for the DeleteAccount endpoint"""
    
    def test_delete_account_requires_auth(self, client):
        """Test that delete account requires authentication"""
        response = client.delete('/api/user')
        assert response.status_code == 401
    
    @patch('api.data_store')
    def test_delete_account_success(self, mock_store, client, auth_headers):
        """Test successful account deletion"""
        # Setup mocks
        mock_store.db = MagicMock()
        mock_store.user_scraping_jobs = {}
        mock_store.db.users.find_one.return_value = {
            'username': 'testuser',
            'email': 'test@example.com'
        }
        mock_store.db.users.delete_one.return_value = MagicMock(deleted_count=1)
        
        response = client.delete('/api/user', headers=auth_headers)
        assert response.status_code == 200
        assert response.json['status'] == 'success'
        assert 'deleted successfully' in response.json.get('message', '').lower()
        mock_store.db.users.delete_one.assert_called_once()
    
    @patch('api.data_store')
    def test_delete_account_user_not_found(self, mock_store, client, auth_headers):
        """Test delete account when user doesn't exist"""
        mock_store.db = MagicMock()
        mock_store.user_scraping_jobs = {}
        mock_store.db.users.find_one.return_value = None
        
        response = client.delete('/api/user', headers=auth_headers)
        assert response.status_code == 404
        assert response.json['status'] == 'error'
    
    @patch('api.data_store')
    def test_delete_account_with_active_scrape(self, mock_store, client, auth_headers):
        """Test delete account fails when scraping is in progress"""
        from threading import Thread
        mock_store.db = MagicMock()
        mock_store.user_scraping_jobs = {
            'testuser': MagicMock(is_alive=MagicMock(return_value=True))
        }
        mock_store.db.users.find_one.return_value = {
            'username': 'testuser',
            'email': 'test@example.com'
        }
        
        response = client.delete('/api/user', headers=auth_headers)
        assert response.status_code == 409
        assert response.json['status'] == 'error'
        assert 'scraping job' in response.json.get('message', '').lower()
    
    @patch('api.data_store')
    def test_delete_account_no_db(self, mock_store, client, auth_headers):
        """Test delete account when database is not available"""
        mock_store.db = None
        
        response = client.delete('/api/user', headers=auth_headers)
        assert response.status_code == 500
        assert response.json['status'] == 'error'


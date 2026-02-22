"""
Comprehensive tests for API endpoints
"""
import os
import pytest
import json
import jwt
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta, timezone


def _test_auth_headers():
    """Build auth headers with a valid JWT so tests don't require MongoDB for login."""
    secret = os.environ.get("JWT_SECRET_KEY", "test_jwt_secret_key_that_is_at_least_32_chars_long_for_testing")
    token = jwt.encode(
        {"username": "testuser", "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
        secret,
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {token}"}

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
        mock_store.anthropic_analyses = {}
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
    
    def test_run_analysis_without_product(self, client):
        """Test run analysis without product parameter"""
        # Use a valid JWT so token_required passes (no MongoDB needed)
        secret = os.getenv("JWT_SECRET_KEY")
        token = jwt.encode(
            {"username": "testuser", "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
            secret,
            algorithm="HS256",
        )
        headers = {"Authorization": f"Bearer {token}"}
        response = client.post("/api/run-analysis", json={}, headers=headers)
        assert response.status_code == 400

    @patch("app.data_store")
    def test_run_analysis_success(self, mock_store, client):
        """Test run analysis creates a job and returns job_id immediately (analysis runs in background)."""
        from bson import ObjectId

        mock_store.db = MagicMock()
        mock_store.db.posts.count_documents.return_value = 5
        fake_job_id = ObjectId()
        mock_store.create_job = MagicMock(return_value=fake_job_id)
        mock_store.update_job_status = MagicMock(return_value=True)
        mock_store.append_job_log = MagicMock(return_value=True)

        secret = os.getenv("JWT_SECRET_KEY")
        token = jwt.encode(
            {"username": "testuser", "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
            secret,
            algorithm="HS256",
        )
        headers = {"Authorization": f"Bearer {token}"}

        response = client.post(
            "/api/run-analysis",
            json={"product": "test"},
            headers=headers,
        )

        assert response.status_code == 200
        data = response.json
        assert data.get("status") == "success"
        assert data.get("job_id") == str(fake_job_id)
        assert data.get("product") == "test"
        mock_store.create_job.assert_called_once()
        # Job started in background; update_job_status(in_progress) called from thread (may race)
        assert mock_store.db.posts.count_documents.called

    @patch("app.data_store")
    def test_run_analysis_no_posts_returns_404(self, mock_store, client):
        """Test run analysis when no posts exist for the product."""
        mock_store.db = MagicMock()
        mock_store.db.posts.count_documents.return_value = 0

        secret = os.getenv("JWT_SECRET_KEY")
        token = jwt.encode(
            {"username": "testuser", "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
            secret,
            algorithm="HS256",
        )
        response = client.post(
            "/api/run-analysis",
            json={"product": "test"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 404
        assert "no posts" in response.json.get("message", "").lower()

    @patch("app.data_store")
    def test_run_analysis_regenerate_insufficient_credits(self, mock_store, client):
        """Oracle 2: Regenerate with < 1 credit returns 400 with required_credits and available_credits."""
        from bson import ObjectId

        mock_store.db = MagicMock()
        mock_store.db.posts.count_documents.return_value = 5
        mock_store.db.users.find_one.return_value = {"username": "testuser", "credits": 0}
        mock_store.db.users.find_one_and_update.return_value = None  # atomic deduct fails

        secret = os.getenv("JWT_SECRET_KEY")
        token = jwt.encode(
            {"username": "testuser", "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
            secret,
            algorithm="HS256",
        )
        headers = {"Authorization": f"Bearer {token}"}

        response = client.post(
            "/api/run-analysis",
            json={"product": "test", "regenerate": True},
            headers=headers,
        )

        assert response.status_code == 400
        data = response.json
        assert "credits" in data.get("message", "").lower() or "insufficient" in data.get("message", "").lower()
        assert data.get("required_credits") == 1
        assert data.get("available_credits") == 0
        mock_store.create_job.assert_not_called()

    @patch("app.data_store")
    def test_run_analysis_regenerate_deducts_clears_and_creates_job(self, mock_store, client):
        """Oracle 2 & 3: Regenerate deducts 1 credit, clears analysis for product, then creates job."""
        from bson import ObjectId

        mock_store.db = MagicMock()
        mock_store.db.posts.count_documents.return_value = 5
        mock_store.db.users.find_one.return_value = {"username": "testuser", "credits": 10}
        mock_store.db.users.find_one_and_update.return_value = {"username": "testuser", "credits": 9}
        fake_job_id = ObjectId()
        mock_store.create_job = MagicMock(return_value=fake_job_id)
        mock_store.update_job_status = MagicMock(return_value=True)
        mock_store.append_job_log = MagicMock(return_value=True)
        mock_store.delete_anthropic_analysis = MagicMock(return_value=True)
        mock_store.delete_pain_points_by_product = MagicMock(return_value=True)
        mock_store.delete_recommendations_by_product = MagicMock(return_value=True)

        secret = os.getenv("JWT_SECRET_KEY")
        token = jwt.encode(
            {"username": "testuser", "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
            secret,
            algorithm="HS256",
        )
        headers = {"Authorization": f"Bearer {token}"}

        response = client.post(
            "/api/run-analysis",
            json={"product": "TestProduct", "regenerate": True},
            headers=headers,
        )

        assert response.status_code == 200
        assert response.json.get("status") == "success"
        assert response.json.get("job_id") == str(fake_job_id)
        mock_store.delete_anthropic_analysis.assert_called_once_with("TestProduct", user_id="testuser")
        mock_store.delete_pain_points_by_product.assert_called_once_with("TestProduct", user_id="testuser")
        mock_store.delete_recommendations_by_product.assert_called_once_with("TestProduct", user_id="testuser")
        call_args = mock_store.db.users.find_one_and_update.call_args
        assert call_args[0][1]["$inc"]["credits"] == -1
        mock_store.create_job.assert_called_once()

class TestGetAllProductsEndpoint:
    """Tests for the GetAllProducts endpoint (user-scoped)"""

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

    @patch('api.data_store')
    def test_get_all_products_returns_only_user_jobs(self, mock_store, client, auth_headers):
        """Oracle 5: Product list only includes topics from jobs where user_id is current user."""
        mock_store.db = MagicMock()
        mock_store.db.jobs.find.return_value = [
            {"parameters": {"topic": "HubSpot"}},
            {"parameters": {"topic": "VS Code"}},
            {"parameters": {"product": "Slack"}},
        ]

        response = client.get('/api/all-products', headers=auth_headers)
        assert response.status_code == 200
        products = response.json.get("products", [])
        mock_store.db.jobs.find.assert_called_once()
        args = mock_store.db.jobs.find.call_args[0]
        query = args[0] if args else {}
        projection = args[1] if len(args) > 1 else {}
        assert query.get("user_id") is not None
        assert projection.get("parameters") == 1
        assert "HubSpot" in products
        assert "VS Code" in products
        assert "Slack" in products

class TestRecommendationsEndpoint:
    """Tests for the Recommendations endpoint"""
    
    def test_get_recommendations_requires_auth(self, client):
        """Test that get recommendations requires authentication"""
        response = client.get('/api/recommendations')
        assert response.status_code == 401
    
    @patch('app.data_store')
    def test_get_recommendations_no_db(self, mock_store, client):
        """Test get recommendations without database returns 200 with empty list"""
        mock_store.db = None
        response = client.get('/api/recommendations?product=Test', headers=_test_auth_headers())
        assert response.status_code == 200
        assert response.json.get("recommendations") == []

    def test_post_recommendations_requires_auth(self, client):
        """Test that POST recommendations requires authentication"""
        response = client.post(
            '/api/recommendations',
            json={"products": ["Test"], "recommendation_type": "improve_product"},
        )
        assert response.status_code == 401

    def test_post_recommendations_validation(self, client):
        """Test POST recommendations validation: missing products or invalid type"""
        auth_headers = _test_auth_headers()
        # Missing products
        response = client.post(
            '/api/recommendations',
            json={"recommendation_type": "improve_product"},
            headers=auth_headers,
        )
        assert response.status_code == 400
        # Invalid recommendation_type
        response = client.post(
            '/api/recommendations',
            json={"products": ["Test"], "recommendation_type": "invalid_type"},
            headers=auth_headers,
        )
        assert response.status_code == 400

    @patch('app.data_store')
    def test_get_recommendations_by_type_returns_correct_doc(self, mock_store, client):
        """GET with recommendation_type returns only the doc for that type; different types return different docs."""
        mock_store.db = MagicMock()
        auth_headers = _test_auth_headers()
        # Doc for improve_product
        improve_doc = {
            "_id": "testuser:hubspot:improve_product",
            "product": "hubspot",
            "recommendation_type": "improve_product",
            "recommendations": [{"title": "Improve onboarding"}],
            "summary": "Improve product summary",
        }
        new_feature_doc = {
            "_id": "testuser:hubspot:new_feature",
            "product": "hubspot",
            "recommendation_type": "new_feature",
            "recommendations": [{"title": "Add dark mode"}],
            "summary": "New feature summary",
        }

        def find_one(query):
            _id = query.get("_id")
            if _id == "testuser:hubspot:improve_product":
                return improve_doc.copy()
            if _id == "testuser:hubspot:new_feature":
                return new_feature_doc.copy()
            return None

        mock_store.db.recommendations.find_one = find_one

        # Request improve_product
        r_improve = client.get(
            '/api/recommendations',
            query_string={"product": "Hubspot", "recommendation_type": "improve_product"},
            headers=auth_headers,
        )
        assert r_improve.status_code == 200
        recs = r_improve.json.get("recommendations") or []
        assert len(recs) == 1
        assert recs[0].get("recommendation_type") == "improve_product"
        assert recs[0].get("summary") == "Improve product summary"
        assert any(r.get("title") == "Improve onboarding" for r in (recs[0].get("recommendations") or []))

        # Request new_feature
        r_new = client.get(
            '/api/recommendations',
            query_string={"product": "Hubspot", "recommendation_type": "new_feature"},
            headers=auth_headers,
        )
        assert r_new.status_code == 200
        recs_new = r_new.json.get("recommendations") or []
        assert len(recs_new) == 1
        assert recs_new[0].get("recommendation_type") == "new_feature"
        assert recs_new[0].get("summary") == "New feature summary"
        assert any(r.get("title") == "Add dark mode" for r in (recs_new[0].get("recommendations") or []))

        # Improve and new_feature must not return the same content
        assert recs[0].get("summary") != recs_new[0].get("summary")

    @patch('app.data_store')
    def test_get_recommendations_wrong_type_returns_empty(self, mock_store, client):
        """If stored doc has different recommendation_type than requested, return empty (safeguard)."""
        mock_store.db = MagicMock()
        auth_headers = _test_auth_headers()
        # Stored doc has recommendation_type new_feature but we request improve_product
        wrong_doc = {
            "_id": "testuser:hubspot:improve_product",
            "product": "hubspot",
            "recommendation_type": "new_feature",  # mismatched
            "recommendations": [],
            "summary": "Wrong",
        }
        mock_store.db.recommendations.find_one = lambda q: wrong_doc.copy() if q.get("_id") == "testuser:hubspot:improve_product" else None

        r = client.get(
            '/api/recommendations',
            query_string={"product": "Hubspot", "recommendation_type": "improve_product"},
            headers=auth_headers,
        )
        assert r.status_code == 200
        assert r.json.get("recommendations") == []

    @patch('claude_analyzer.ClaudeAnalyzer')
    @patch('app.data_store')
    def test_post_recommendations_creates_job_with_recommendation_type(self, mock_store, mock_claude, client):
        """POST creates a job whose parameters include the requested recommendation_type."""
        from bson import ObjectId
        auth_headers = _test_auth_headers()
        mock_store.db = MagicMock()
        mock_store.db.pain_points.find.return_value = [
            {"topic": "Pricing", "description": "Cost", "severity": "high", "product": "hubspot", "user_id": "testuser"},
        ]
        mock_store.db.recommendations.find_one.return_value = None
        mock_store.db.users.find_one.return_value = {"username": "testuser", "credits": 10}
        mock_store.db.users.find_one_and_update.return_value = {"username": "testuser"}
        mock_store.create_job = MagicMock(return_value=ObjectId())
        mock_store.update_job_status = MagicMock(return_value=True)
        mock_store.append_job_log = MagicMock()
        mock_store.save_recommendations = MagicMock(return_value=True)
        mock_claude.return_value.generate_recommendations.return_value = {"recommendations": [], "summary": ""}

        r = client.post(
            '/api/recommendations',
            json={"products": ["Hubspot"], "recommendation_type": "new_feature"},
            headers=auth_headers,
        )
        assert r.status_code == 200
        assert r.json.get("job_id") is not None
        assert r.json.get("recommendation_type") == "new_feature"
        call_args = mock_store.create_job.call_args
        assert call_args[0][1].get("type") == "recommendations"
        assert call_args[0][1].get("recommendation_type") == "new_feature"
        assert call_args[0][1].get("product") == "Hubspot"

    @patch('claude_analyzer.ClaudeAnalyzer')
    @patch('app.data_store')
    def test_post_recommendations_first_time_without_context(self, mock_store, mock_claude, client):
        """POST first-time (no existing doc, no regenerate) creates job without context, 2 credits."""
        from bson import ObjectId
        auth_headers = _test_auth_headers()
        mock_store.db = MagicMock()
        mock_store.db.pain_points.find.return_value = [
            {"topic": "P", "description": "D", "severity": "high", "product": "hubspot", "user_id": "testuser"},
        ]
        mock_store.db.recommendations.find_one.return_value = None  # no existing
        mock_store.db.users.find_one.return_value = {"username": "testuser", "credits": 10}
        mock_store.db.users.find_one_and_update.return_value = {"username": "testuser"}
        mock_store.create_job = MagicMock(return_value=ObjectId())
        mock_store.update_job_status = MagicMock(return_value=True)
        mock_store.append_job_log = MagicMock()
        mock_store.save_recommendations = MagicMock(return_value=True)
        mock_claude.return_value.generate_recommendations.return_value = {"recommendations": [], "summary": ""}

        r = client.post(
            '/api/recommendations',
            json={"products": ["Hubspot"], "recommendation_type": "improve_product"},
            headers=auth_headers,
        )
        assert r.status_code == 200
        assert r.json.get("job_id") is not None
        params = mock_store.create_job.call_args[0][1]
        assert params.get("regenerate") is False
        assert "context" not in params or params.get("context") is None

    @patch('claude_analyzer.ClaudeAnalyzer')
    @patch('app.data_store')
    def test_post_recommendations_first_time_with_context(self, mock_store, mock_claude, client):
        """POST first-time with context sends context in job parameters."""
        from bson import ObjectId
        auth_headers = _test_auth_headers()
        mock_store.db = MagicMock()
        mock_store.db.pain_points.find.return_value = [
            {"topic": "P", "description": "D", "severity": "high", "product": "hubspot", "user_id": "testuser"},
        ]
        mock_store.db.recommendations.find_one.return_value = None
        mock_store.db.users.find_one.return_value = {"username": "testuser", "credits": 10}
        mock_store.db.users.find_one_and_update.return_value = {"username": "testuser"}
        mock_store.create_job = MagicMock(return_value=ObjectId())
        mock_store.update_job_status = MagicMock(return_value=True)
        mock_store.append_job_log = MagicMock()
        mock_store.save_recommendations = MagicMock(return_value=True)
        mock_claude.return_value.generate_recommendations.return_value = {"recommendations": [], "summary": ""}

        r = client.post(
            '/api/recommendations',
            json={
                "products": ["Hubspot"],
                "recommendation_type": "new_feature",
                "context": "Focus on mobile users",
            },
            headers=auth_headers,
        )
        assert r.status_code == 200
        params = mock_store.create_job.call_args[0][1]
        assert params.get("context") == "Focus on mobile users"

    @patch('claude_analyzer.ClaudeAnalyzer')
    @patch('app.data_store')
    def test_post_recommendations_regenerate_without_context(self, mock_store, mock_claude, client):
        """POST with regenerate=True and no context creates job with regenerate, no context (1 credit)."""
        from bson import ObjectId
        auth_headers = _test_auth_headers()
        mock_store.db = MagicMock()
        mock_store.db.pain_points.find.return_value = [
            {"topic": "P", "description": "D", "severity": "high", "product": "hubspot", "user_id": "testuser"},
        ]
        mock_store.db.recommendations.find_one.return_value = {
            "_id": "testuser:hubspot:improve_product",
            "product": "hubspot",
            "recommendations": [],
        }
        mock_store.db.users.find_one.return_value = {"username": "testuser", "credits": 10}
        mock_store.db.users.find_one_and_update.return_value = {"username": "testuser"}
        mock_store.create_job = MagicMock(return_value=ObjectId())
        mock_store.update_job_status = MagicMock(return_value=True)
        mock_store.append_job_log = MagicMock()
        mock_store.save_recommendations = MagicMock(return_value=True)
        mock_claude.return_value.generate_recommendations.return_value = {"recommendations": [], "summary": ""}

        r = client.post(
            '/api/recommendations',
            json={"products": ["Hubspot"], "recommendation_type": "improve_product", "regenerate": True},
            headers=auth_headers,
        )
        assert r.status_code == 200
        params = mock_store.create_job.call_args[0][1]
        assert params.get("regenerate") is True
        assert "context" not in params or params.get("context") is None

    @patch('claude_analyzer.ClaudeAnalyzer')
    @patch('app.data_store')
    def test_post_recommendations_regenerate_with_context(self, mock_store, mock_claude, client):
        """POST regenerate with context sends both in job parameters."""
        from bson import ObjectId
        auth_headers = _test_auth_headers()
        mock_store.db = MagicMock()
        mock_store.db.pain_points.find.return_value = [
            {"topic": "P", "description": "D", "severity": "high", "product": "hubspot", "user_id": "testuser"},
        ]
        mock_store.db.recommendations.find_one.return_value = {
            "_id": "testuser:hubspot:improve_product",
            "product": "hubspot",
            "recommendations": [],
        }
        mock_store.db.users.find_one.return_value = {"username": "testuser", "credits": 10}
        mock_store.db.users.find_one_and_update.return_value = {"username": "testuser"}
        mock_store.create_job = MagicMock(return_value=ObjectId())
        mock_store.update_job_status = MagicMock(return_value=True)
        mock_store.append_job_log = MagicMock()
        mock_store.save_recommendations = MagicMock(return_value=True)
        mock_claude.return_value.generate_recommendations.return_value = {"recommendations": [], "summary": ""}

        r = client.post(
            '/api/recommendations',
            json={
                "products": ["Hubspot"],
                "recommendation_type": "improve_product",
                "regenerate": True,
                "context": "Prioritize speed",
            },
            headers=auth_headers,
        )
        assert r.status_code == 200
        params = mock_store.create_job.call_args[0][1]
        assert params.get("regenerate") is True
        assert params.get("context") == "Prioritize speed"

    def test_post_recommendations_context_max_500(self, client):
        """POST with context longer than 500 characters returns 400."""
        auth_headers = _test_auth_headers()
        with patch('app.data_store') as mock_store:
            mock_store.db = MagicMock()
            mock_store.db.pain_points.find.return_value = [
                {"topic": "P", "product": "hubspot", "user_id": "testuser"},
            ]
            mock_store.db.recommendations.find_one.return_value = None
            mock_store.db.users.find_one.return_value = {"username": "testuser", "credits": 10}
            r = client.post(
                '/api/recommendations',
                json={
                    "products": ["Hubspot"],
                    "recommendation_type": "improve_product",
                    "context": "x" * 501,
                },
                headers=auth_headers,
            )
        assert r.status_code == 400
        assert "500" in (r.json.get("message") or "")

    @patch('app.data_store')
    def test_post_recommendations_no_pain_points(self, mock_store, client):
        """POST when no pain points exist returns 400."""
        auth_headers = _test_auth_headers()
        mock_store.db = MagicMock()
        mock_store.db.pain_points.find.return_value = []
        r = client.post(
            '/api/recommendations',
            json={"products": ["Hubspot"], "recommendation_type": "improve_product"},
            headers=auth_headers,
        )
        assert r.status_code == 400
        assert "pain points" in (r.json.get("message") or "").lower()

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
    
    @patch("app.data_store")
    def test_get_claude_analysis_success(self, mock_store, client):
        """Test successful get Claude analysis (user-scoped); accepts product or products[] and returns analyses array."""
        def _find_one(q):
            if q.get("user_id") and q.get("product") == "hubspot":
                return {"_id": "testuser:hubspot", "product": "hubspot", "analysis": {"common_pain_points": []}}
            if q.get("_id") == "hubspot" or q.get("product") == "hubspot":
                return {"_id": "hubspot", "product": "hubspot", "analysis": {"common_pain_points": []}}
            return None
        mock_store.db = MagicMock()
        mock_store.db.anthropic_analysis.find_one.side_effect = _find_one
        secret = os.getenv("JWT_SECRET_KEY")
        token = jwt.encode(
            {"username": "testuser", "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
            secret,
            algorithm="HS256",
        )
        headers = {"Authorization": f"Bearer {token}"}
        response = client.get("/api/claude-analysis?products[]=Hubspot", headers=headers)
        assert response.status_code == 200
        data = response.json
        assert data.get("status") == "success"
        assert "analyses" in data and len(data["analyses"]) == 1

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


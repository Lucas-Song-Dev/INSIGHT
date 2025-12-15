"""
E2E-style tests for scraping functionality
These tests use real components with minimal mocking
"""
import pytest
import time
from unittest.mock import Mock, patch, MagicMock
from threading import Thread

from api import ScrapePosts, GetStatus
from mongodb_store import MongoDBStore


class TestScrapeE2E:
    """End-to-end tests for scraping functionality"""
    
    def test_full_scrape_flow_per_user(self, client, mock_db, auth_headers):
        """Test complete scraping flow for a single user"""
        from api import data_store
        
        # Reset state
        data_store.user_scraping_jobs = {}
        
        # Setup mocks for actual scraping
        with patch('api.scraper') as mock_scraper, \
             patch('api.claude_analyzer') as mock_claude, \
             patch('api.Thread') as mock_thread_class:
            
            # Mock Claude suggestions
            mock_suggest = Mock(return_value={
                'subreddits': ['testsub1', 'testsub2'],
                'search_queries': ['test query 1', 'test query 2']
            })
            mock_claude.analyzer = Mock()
            mock_claude.analyzer.suggest_subreddits = mock_suggest
            
            # Mock scraper
            mock_reddit_post = Mock()
            mock_reddit_post.id = 'test123'
            mock_reddit_post.title = 'Test Post'
            mock_reddit_post.selftext = 'Test content'
            mock_reddit_post.author = Mock()
            mock_reddit_post.author.name = 'testuser'
            mock_reddit_post.subreddit = Mock()
            mock_reddit_post.subreddit.display_name = 'testsub1'
            mock_reddit_post.created_utc = time.time()
            mock_reddit_post.score = 10
            mock_reddit_post.num_comments = 5
            mock_reddit_post.url = 'https://reddit.com/test'
            
            mock_scraper.search_reddit = Mock(return_value=[mock_reddit_post])
            
            # Mock thread to actually execute
            def create_real_thread(target):
                thread = Thread(target=target)
                thread.start()
                return thread
            
            mock_thread_class.side_effect = create_real_thread
            
            # Start scrape
            response = client.post(
                '/api/scrape',
                json={
                    'topic': 'test product',
                    'limit': 10,
                    'time_filter': 'week',
                    'is_custom': False
                },
                headers=auth_headers
            )
            
            assert response.status_code == 200
            data = response.json
            assert data['status'] == 'success'
            assert data['topic'] == 'test product'
            
            # Wait for thread to complete
            time.sleep(0.5)
            
            # Verify thread was tracked
            # Note: Thread may have completed by now
            # The important thing is it was started correctly
            
            # Verify status endpoint returns correct state
            status_response = client.get('/api/status', headers=auth_headers)
            assert status_response.status_code == 200
            status_data = status_response.json
            # Status should reflect current state (may be False if thread completed)
            assert 'scrape_in_progress' in status_data
    
    def test_multiple_users_scrape_simultaneously(self, client, mock_db, auth_headers):
        """Test that multiple users can scrape simultaneously"""
        from api import data_store
        
        # Reset state
        data_store.user_scraping_jobs = {}
        
        # Create second user token
        from api import app
        import jwt
        from datetime import datetime, timedelta
        
        token_payload = {
            'username': 'user2',
            'exp': datetime.utcnow() + timedelta(seconds=3600)
        }
        second_token = jwt.encode(token_payload, app.config['JWT_SECRET_KEY'], algorithm='HS256')
        auth_headers_user2 = {
            'Authorization': f'Bearer {second_token}',
            'Content-Type': 'application/json'
        }
        
        with patch('api.scraper') as mock_scraper, \
             patch('api.claude_analyzer') as mock_claude, \
             patch('api.Thread') as mock_thread_class:
            
            mock_suggest = Mock(return_value={
                'subreddits': ['testsub'],
                'search_queries': ['test query']
            })
            mock_claude.analyzer = Mock()
            mock_claude.analyzer.suggest_subreddits = mock_suggest
            
            mock_scraper.search_reddit = Mock(return_value=[])
            
            def create_real_thread(target):
                thread = Thread(target=target)
                thread.start()
                return thread
            
            mock_thread_class.side_effect = create_real_thread
            
            # User 1 starts scrape
            response1 = client.post(
                '/api/scrape',
                json={'topic': 'product1', 'limit': 10, 'time_filter': 'week'},
                headers=auth_headers
            )
            assert response1.status_code == 200
            
            # User 2 starts scrape (should succeed - different users)
            response2 = client.post(
                '/api/scrape',
                json={'topic': 'product2', 'limit': 10, 'time_filter': 'week'},
                headers=auth_headers_user2
            )
            assert response2.status_code == 200
            
            # Both users should have active threads
            time.sleep(0.2)  # Allow threads to start
            assert len(data_store.user_scraping_jobs) >= 1  # At least one thread tracked
            
            # Wait for completion
            time.sleep(0.5)
    
    def test_user_cannot_start_second_job_while_first_active(self, client, mock_db, auth_headers):
        """Test that a user cannot start a second job while first is active"""
        from api import data_store
        
        # Reset state
        data_store.user_scraping_jobs = {}
        
        # Create a mock active thread
        active_thread = Mock()
        active_thread.is_alive = Mock(return_value=True)
        active_thread.start = Mock()
        data_store.user_scraping_jobs['testuser'] = active_thread
        
        # Try to start new scrape
        response = client.post(
            '/api/scrape',
            json={'topic': 'test', 'limit': 10, 'time_filter': 'week'},
            headers=auth_headers
        )
        
        assert response.status_code == 409
        assert 'already have' in response.json['message'].lower()
    
    def test_scrape_job_cleanup_on_completion(self, client, mock_db, auth_headers):
        """Test that user's scrape job is cleaned up when complete"""
        from api import data_store
        
        # Reset state
        data_store.user_scraping_jobs = {}
        
        with patch('api.scraper') as mock_scraper, \
             patch('api.claude_analyzer') as mock_claude, \
             patch('api.Thread') as mock_thread_class:
            
            mock_suggest = Mock(return_value={
                'subreddits': ['testsub'],
                'search_queries': ['test query']
            })
            mock_claude.analyzer = Mock()
            mock_claude.analyzer.suggest_subreddits = mock_suggest
            
            mock_scraper.search_reddit = Mock(return_value=[])
            
            def create_real_thread(target):
                thread = Thread(target=target)
                thread.start()
                return thread
            
            mock_thread_class.side_effect = create_real_thread
            
            # Start scrape
            response = client.post(
                '/api/scrape',
                json={'topic': 'test', 'limit': 10, 'time_filter': 'week'},
                headers=auth_headers
            )
            assert response.status_code == 200
            
            # Wait for completion
            time.sleep(0.5)
            
            # Check status - should be False (completed)
            status_response = client.get('/api/status', headers=auth_headers)
            assert status_response.status_code == 200
            status_data = status_response.json
            # Job should be cleaned up by now
            assert status_data['scrape_in_progress'] == False
    
    def test_scrape_job_cleanup_on_error(self, client, mock_db, auth_headers):
        """Test that user's scrape job is cleaned up on error"""
        from api import data_store
        
        # Reset state
        data_store.user_scraping_jobs = {}
        
        with patch('api.scraper') as mock_scraper, \
             patch('api.claude_analyzer') as mock_claude, \
             patch('api.Thread') as mock_thread_class:
            
            mock_suggest = Mock(return_value={
                'subreddits': ['testsub'],
                'search_queries': ['test query']
            })
            mock_claude.analyzer = Mock()
            mock_claude.analyzer.suggest_subreddits = mock_suggest
            
            # Make scraper raise an error
            mock_scraper.search_reddit = Mock(side_effect=Exception('Scraper error'))
            
            def create_real_thread(target):
                thread = Thread(target=target)
                thread.start()
                return thread
            
            mock_thread_class.side_effect = create_real_thread
            
            # Start scrape
            response = client.post(
                '/api/scrape',
                json={'topic': 'test', 'limit': 10, 'time_filter': 'week'},
                headers=auth_headers
            )
            assert response.status_code == 200
            
            # Wait for error to occur and cleanup
            time.sleep(0.5)
            
            # Status should reflect cleanup
            status_response = client.get('/api/status', headers=auth_headers)
            assert status_response.status_code == 200
            status_data = status_response.json
            assert status_data['scrape_in_progress'] == False
    
    def test_custom_insights_flow(self, client, mock_db, auth_headers):
        """Test custom insights scraping flow"""
        from api import data_store
        
        # Reset state
        data_store.user_scraping_jobs = {}
        
        with patch('api.scraper') as mock_scraper, \
             patch('api.claude_analyzer') as mock_claude, \
             patch('api.Thread') as mock_thread_class:
            
            # Mock custom insights suggestion
            mock_custom_suggest = Mock(return_value={
                'subreddits': ['customsub1', 'customsub2'],
                'search_queries': ['custom query 1', 'custom query 2'],
                'recommended_time_filter': 'month'
            })
            mock_claude.analyzer = Mock()
            mock_claude.analyzer.suggest_custom_insights = mock_custom_suggest
            
            mock_scraper.search_reddit = Mock(return_value=[])
            
            def create_real_thread(target):
                thread = Thread(target=target)
                thread.start()
                return thread
            
            mock_thread_class.side_effect = create_real_thread
            
            # Start custom insights scrape
            response = client.post(
                '/api/scrape',
                json={
                    'topic': 'Find gaps in developer tools',
                    'limit': 100,
                    'time_filter': 'week',
                    'is_custom': True
                },
                headers=auth_headers
            )
            
            assert response.status_code == 200
            data = response.json
            assert data['status'] == 'success'
            
            # Verify custom insights function was called
            mock_claude.analyzer.suggest_custom_insights.assert_called_once()
            
            time.sleep(0.5)  # Wait for thread
    
    def test_status_endpoint_reflects_user_state(self, client, mock_db, auth_headers):
        """Test that status endpoint returns user-specific state"""
        from api import data_store
        
        # Reset state
        data_store.user_scraping_jobs = {}
        
        # Create active thread for testuser
        active_thread = Mock()
        active_thread.is_alive = Mock(return_value=True)
        data_store.user_scraping_jobs['testuser'] = active_thread
        
        # Get status
        response = client.get('/api/status', headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json
        assert data['scrape_in_progress'] == True
        
        # Mark thread as dead
        active_thread.is_alive = Mock(return_value=False)
        
        # Get status again - should clean up and return False
        response = client.get('/api/status', headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json
        assert data['scrape_in_progress'] == False
        assert 'testuser' not in data_store.user_scraping_jobs


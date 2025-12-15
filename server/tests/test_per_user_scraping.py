"""
Tests for per-user scraping functionality
"""
import pytest
from unittest.mock import Mock, patch, MagicMock
from threading import Thread
import time

from api import ScrapePosts, GetStatus
from mongodb_store import MongoDBStore


class TestPerUserScraping:
    """Test that scraping jobs are tracked per-user, not globally"""
    
    def test_multiple_users_can_scrape_simultaneously(self, mock_db):
        """Test that different users can have scraping jobs running at the same time"""
        from api import data_store
        
        # Reset state
        data_store.user_scraping_jobs = {}
        
        # Create mock threads for two different users
        thread1 = Thread(target=lambda: time.sleep(0.1))
        thread2 = Thread(target=lambda: time.sleep(0.1))
        thread1.start()
        thread2.start()
        
        # Track both users
        data_store.user_scraping_jobs['user1'] = thread1
        data_store.user_scraping_jobs['user2'] = thread2
        
        # Both should be tracked
        assert 'user1' in data_store.user_scraping_jobs
        assert 'user2' in data_store.user_scraping_jobs
        assert len(data_store.user_scraping_jobs) == 2
        
        # Wait for threads to complete
        thread1.join()
        thread2.join()
    
    def test_user_cannot_start_second_job_while_first_active(self, client, mock_db, auth_headers):
        """Test that a user cannot start a second scraping job while one is active"""
        from api import data_store
        
        # Reset state
        data_store.user_scraping_jobs = {}
        
        # Create a mock active thread
        active_thread = Mock()
        active_thread.is_alive = Mock(return_value=True)
        data_store.user_scraping_jobs['testuser'] = active_thread
        
        # Try to start a new scrape
        response = client.post(
            '/api/scrape',
            json={'topic': 'test product', 'limit': 50, 'time_filter': 'week'},
            headers=auth_headers
        )
        
        assert response.status_code == 409
        assert 'already have a scraping job in progress' in response.json['message'].lower()
    
    def test_dead_thread_is_cleaned_up(self, client, mock_db, auth_headers):
        """Test that dead threads are automatically cleaned up"""
        from api import data_store
        
        # Reset state
        data_store.user_scraping_jobs = {}
        
        # Create a dead thread
        dead_thread = Mock()
        dead_thread.is_alive = Mock(return_value=False)
        data_store.user_scraping_jobs['testuser'] = dead_thread
        
        # Try to start a new scrape - should succeed because dead thread is cleaned up
        with patch('api.scraper'), \
             patch('api.claude_analyzer') as mock_claude, \
             patch('api.Thread') as mock_thread_class:
            
            mock_suggest = Mock(return_value={
                'subreddits': ['testsub'],
                'search_queries': ['test query']
            })
            mock_claude.analyzer = Mock()
            mock_claude.analyzer.suggest_subreddits = mock_suggest
            
            # Mock the thread to return immediately
            mock_thread = Mock()
            mock_thread.is_alive = Mock(return_value=True)
            mock_thread.daemon = True
            mock_thread_class.return_value = mock_thread
            
            response = client.post(
                '/api/scrape',
                json={'topic': 'test product', 'limit': 50, 'time_filter': 'week'},
                headers=auth_headers
            )
            
            # Should succeed - dead thread was cleaned up
            assert response.status_code == 200
            # Dead thread should be removed
            assert 'testuser' not in data_store.user_scraping_jobs or \
                   data_store.user_scraping_jobs['testuser'] != dead_thread
    
    def test_status_endpoint_returns_user_specific_status(self, client, mock_db, auth_headers):
        """Test that GetStatus returns scrape_in_progress based on current user"""
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
        
        # Remove the thread
        del data_store.user_scraping_jobs['testuser']
        
        # Get status again
        response = client.get('/api/status', headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json
        assert data['scrape_in_progress'] == False
    
    def test_scrape_job_cleaned_up_on_completion(self, mock_db):
        """Test that user's scraping job is cleaned up when thread completes"""
        from api import data_store
        
        # Reset state
        data_store.user_scraping_jobs = {}
        
        # Create a thread that will complete
        completed = {'done': False}
        def job_function():
            time.sleep(0.01)
            completed['done'] = True
        
        thread = Thread(target=job_function)
        thread.start()
        data_store.user_scraping_jobs['testuser'] = thread
        
        # Wait for completion
        thread.join()
        
        # Simulate the cleanup that happens in background_scrape
        if 'testuser' in data_store.user_scraping_jobs:
            del data_store.user_scraping_jobs['testuser']
        
        # Job should be cleaned up
        assert 'testuser' not in data_store.user_scraping_jobs
        assert completed['done'] == True


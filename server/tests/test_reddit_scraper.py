"""
Tests for RedditScraper
"""
import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime
from reddit_scraper import RedditScraper
from models import RedditPost

class TestRedditScraper:
    """Tests for RedditScraper class"""
    
    @pytest.fixture
    def scraper(self):
        """Create a RedditScraper instance for testing"""
        return RedditScraper()
    
    def test_init(self, scraper):
        """Test scraper initialization"""
        assert scraper.reddit is None
        assert scraper.target_products is not None
        assert scraper.default_subreddits is not None
        assert scraper.time_filters is not None
    
    def test_initialize_client_success(self, scraper):
        """Test successful Reddit client initialization"""
        with patch('reddit_scraper.praw.Reddit') as mock_reddit:
            mock_reddit.return_value = MagicMock()
            result = scraper.initialize_client('client_id', 'client_secret')
            assert result is True
            assert scraper.reddit is not None
    
    def test_initialize_client_no_credentials(self, scraper):
        """Test client initialization without credentials"""
        result = scraper.initialize_client(None, None)
        assert result is False
    
    def test_initialize_client_failure(self, scraper):
        """Test client initialization failure"""
        with patch('reddit_scraper.praw.Reddit', side_effect=Exception("Error")):
            result = scraper.initialize_client('client_id', 'client_secret')
            assert result is False
    
    @patch('reddit_scraper.praw.Reddit')
    def test_search_reddit_success(self, mock_reddit, scraper):
        """Test successful Reddit search"""
        # Setup mock Reddit client
        mock_submission = MagicMock()
        mock_submission.id = 'test_id'
        mock_submission.title = 'Test Post'
        mock_submission.selftext = 'Test content'
        mock_submission.author = Mock(__str__=lambda x: 'test_author')
        mock_submission.subreddit = Mock(__str__=lambda x: 'test_subreddit')
        mock_submission.url = 'https://example.com'
        mock_submission.created_utc = 1609459200.0
        mock_submission.score = 10
        mock_submission.num_comments = 5
        
        mock_subreddit = MagicMock()
        mock_subreddit.search.return_value = [mock_submission]
        
        mock_reddit_client = MagicMock()
        mock_reddit_client.subreddit.return_value = mock_subreddit
        mock_reddit.return_value = mock_reddit_client
        
        scraper.initialize_client('client_id', 'client_secret')
        posts = scraper.search_reddit('test query', ['test'], limit=10)
        
        assert len(posts) > 0
        assert isinstance(posts[0], RedditPost)
    
    @patch('reddit_scraper.praw.Reddit')
    def test_search_reddit_error_handling(self, mock_reddit, scraper):
        """Test Reddit search error handling"""
        mock_subreddit = MagicMock()
        mock_subreddit.search.side_effect = Exception("API Error")
        
        mock_reddit_client = MagicMock()
        mock_reddit_client.subreddit.return_value = mock_subreddit
        mock_reddit.return_value = mock_reddit_client
        
        scraper.initialize_client('client_id', 'client_secret')
        posts = scraper.search_reddit('test query', ['test'], limit=10)
        
        # Should return empty list or handle error gracefully
        assert isinstance(posts, list)
    
    @patch('reddit_scraper.praw.Reddit')
    def test_scrape_product_mentions(self, mock_reddit, scraper):
        """Test scraping product mentions"""
        mock_submission = MagicMock()
        mock_submission.id = 'test_id'
        mock_submission.title = 'Test Post'
        mock_submission.selftext = 'Test content'
        mock_submission.author = Mock(__str__=lambda x: 'test_author')
        mock_submission.subreddit = Mock(__str__=lambda x: 'test_subreddit')
        mock_submission.url = 'https://example.com'
        mock_submission.created_utc = 1609459200.0
        mock_submission.score = 10
        mock_submission.num_comments = 5
        
        mock_subreddit = MagicMock()
        mock_subreddit.search.return_value = [mock_submission]
        
        mock_reddit_client = MagicMock()
        mock_reddit_client.subreddit.return_value = mock_subreddit
        mock_reddit.return_value = mock_reddit_client
        
        scraper.initialize_client('client_id', 'client_secret')
        posts = scraper.scrape_product_mentions('test_product', limit=10)
        
        assert isinstance(posts, list)
    
    def test_time_filters(self, scraper):
        """Test time filter definitions"""
        assert 'hour' in scraper.time_filters
        assert 'day' in scraper.time_filters
        assert 'week' in scraper.time_filters
        assert 'month' in scraper.time_filters
        assert 'year' in scraper.time_filters
        assert 'all' in scraper.time_filters




















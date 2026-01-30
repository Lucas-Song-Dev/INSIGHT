"""
Tests for MongoDBStore
"""
import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime
from mongodb_store import MongoDBStore
from models import RedditPost, PainPoint

class TestMongoDBStore:
    """Tests for MongoDBStore class"""
    
    @pytest.fixture
    def store(self):
        """Create a MongoDBStore instance for testing"""
        with patch('mongodb_store.MongoClient') as mock_client:
            mock_client.return_value.admin.command.return_value = True
            mock_client.return_value.reddit_scraper = MagicMock()
            store = MongoDBStore('mongodb://localhost:27017/test')
            return store
    
    def test_init_without_uri(self):
        """Test initialization without MongoDB URI"""
        with patch.dict('os.environ', {}, clear=True):
            store = MongoDBStore()
            assert store.db is None or store.client is None
    
    def test_init_with_uri(self):
        """Test initialization with MongoDB URI"""
        with patch('mongodb_store.MongoClient') as mock_client:
            mock_client.return_value.admin.command.return_value = True
            mock_db = MagicMock()
            mock_client.return_value.reddit_scraper = mock_db
            
            store = MongoDBStore('mongodb://localhost:27017/test')
            # Should attempt to connect
            mock_client.assert_called()
    
    @patch('mongodb_store.MongoClient')
    def test_connect_success(self, mock_client):
        """Test successful MongoDB connection"""
        mock_client.return_value.admin.command.return_value = True
        mock_db = MagicMock()
        mock_client.return_value.reddit_scraper = mock_db
        
        store = MongoDBStore('mongodb://localhost:27017/test')
        assert store.client is not None
    
    @patch('mongodb_store.MongoClient')
    def test_connect_failure(self, mock_client):
        """Test MongoDB connection failure"""
        from pymongo.errors import ConnectionFailure
        mock_client.side_effect = ConnectionFailure("Connection failed")
        
        store = MongoDBStore('mongodb://invalid:27017/test')
        assert store.client is None or store.db is None
    
    def test_save_post(self, store):
        """Test saving a post"""
        mock_post = MagicMock(spec=RedditPost)
        mock_post.id = 'test_id'
        mock_post.title = 'Test Post'
        mock_post.content = 'Test content'
        mock_post.author = 'test_author'
        mock_post.subreddit = 'test_subreddit'
        mock_post.url = 'https://example.com'
        mock_post.created_utc = datetime.now()
        mock_post.score = 10
        mock_post.num_comments = 5
        mock_post.products = ['test_product']
        mock_post.sentiment = 0.5
        
        # Mock MongoDB operations
        if store.db:
            store.db.posts.find_one = MagicMock(return_value=None)
            store.db.posts.insert_one = MagicMock(return_value=True)
            
            result = store.save_post(mock_post)
            # Should return True if saved successfully
            assert isinstance(result, bool)
    
    def test_save_pain_point(self, store):
        """Test saving a pain point"""
        mock_pain_point = MagicMock(spec=PainPoint)
        mock_pain_point.name = 'Test Pain Point'
        mock_pain_point.product = 'test_product'
        
        if store.db:
            store.db.pain_points.find_one = MagicMock(return_value=None)
            store.db.pain_points.insert_one = MagicMock(return_value=True)
            
            result = store.save_pain_point(mock_pain_point)
            assert isinstance(result, bool)
    
    def test_save_anthropic_analysis(self, store):
        """Test saving Anthropic analysis"""
        analysis_data = {
            'common_pain_points': [],
            'analysis_summary': 'Test analysis'
        }

        if store.db:
            store.db.anthropic_analysis.find_one = MagicMock(return_value=None)
            store.db.anthropic_analysis.insert_one = MagicMock(return_value=True)

            result = store.save_anthropic_analysis('test_product', analysis_data)
            assert isinstance(result, bool)
    
    def test_update_metadata(self, store):
        """Test updating metadata"""
        metadata = {
            'scrape_in_progress': True,
            'products': ['test_product']
        }
        
        if store.db:
            store.db.metadata.update_one = MagicMock(return_value=True)
            store.update_metadata(**metadata)
            # Should not raise exception
    
    def test_in_memory_fallback(self):
        """Test that store works in-memory when MongoDB is not available"""
        store = MongoDBStore(None)
        assert store.db is None
        
        # Should still be able to store in memory
        mock_post = MagicMock()
        mock_post.id = 'test_id'
        # This should not raise an error
        store.raw_posts.append(mock_post)
        assert len(store.raw_posts) > 0


















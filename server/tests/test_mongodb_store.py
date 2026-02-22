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

    def test_delete_anthropic_analysis(self, store):
        """Oracle 3: Delete analysis for a product (for regenerate)."""
        if store.db is None:
            store.db = MagicMock()
        store.db.anthropic_analysis = MagicMock()
        store.db.anthropic_analysis.delete_one = MagicMock(return_value=MagicMock(deleted_count=1))
        store.anthropic_analyses["TestProduct"] = {}

        result = store.delete_anthropic_analysis("TestProduct")

        assert result is True
        store.db.anthropic_analysis.delete_one.assert_called_once()
        call_arg = store.db.anthropic_analysis.delete_one.call_args[0][0]
        assert call_arg["_id"] == "testproduct"
        assert "TestProduct" not in store.anthropic_analyses

    def test_delete_pain_points_by_product(self, store):
        """Oracle 3: Delete pain points for a product (for regenerate)."""
        if store.db is None:
            store.db = MagicMock()
        store.db.pain_points = MagicMock()
        store.db.pain_points.delete_many = MagicMock(return_value=MagicMock(deleted_count=3))

        result = store.delete_pain_points_by_product("HubSpot")

        assert result is True
        store.db.pain_points.delete_many.assert_called_once_with({"product": "hubspot"})

    def test_delete_recommendations_by_product(self, store):
        """Delete all recommendation docs for a product (all types)."""
        if store.db is None:
            store.db = MagicMock()
        store.db.recommendations = MagicMock()
        store.db.recommendations.delete_many = MagicMock(return_value=MagicMock(deleted_count=2))

        result = store.delete_recommendations_by_product("VS Code")

        assert result is True
        store.db.recommendations.delete_many.assert_called_once_with({"product": "vs code"})

    def test_save_recommendations_stores_by_type(self, store):
        """Saving improve_product and new_feature for the same product creates separate docs (different _id)."""
        if store.db is None:
            store.db = MagicMock()
        store.db.recommendations = MagicMock()
        store.db.recommendations.update_one = MagicMock(return_value=MagicMock(modified_count=1, upserted_id=None))

        store.save_recommendations("Hubspot", [{"title": "Improve A"}], user_id="alice", recommendation_type="improve_product")
        store.save_recommendations("Hubspot", [{"title": "New feature B"}], user_id="alice", recommendation_type="new_feature")

        assert store.db.recommendations.update_one.call_count == 2
        first_id = store.db.recommendations.update_one.call_args_list[0][0][0].get("_id")
        second_id = store.db.recommendations.update_one.call_args_list[1][0][0].get("_id")
        assert first_id == "alice:hubspot:improve_product"
        assert second_id == "alice:hubspot:new_feature"
        first_type = store.db.recommendations.update_one.call_args_list[0][0][1]["$set"].get("recommendation_type")
        second_type = store.db.recommendations.update_one.call_args_list[1][0][1]["$set"].get("recommendation_type")
        assert first_type == "improve_product"
        assert second_type == "new_feature"

    def test_create_indexes_includes_posts_product_subreddit_compound(self, store):
        """Oracle 9: Posts collection has compound index (product, subreddit) for analysis queries."""
        if store.db is None:
            store.db = MagicMock()
        store.db.posts.create_index = MagicMock()
        store.db.pain_points.create_index = MagicMock()
        store.db.users.create_index = MagicMock()
        store.db.anthropic_analysis.create_index = MagicMock()
        store.db.recommendations.create_index = MagicMock()
        store.db.jobs.create_index = MagicMock()

        store.create_indexes()

        compound_calls = [
            c for c in store.db.posts.create_index.call_args_list
            if c[0] and isinstance(c[0][0], list) and len(c[0][0]) >= 2
            and any(idx[0] == "product" for idx in c[0][0])
            and any(idx[0] == "subreddit" for idx in c[0][0])
        ]
        assert len(compound_calls) >= 1, "Expected compound index (product, subreddit) on posts"




















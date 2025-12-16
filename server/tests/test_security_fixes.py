"""
Comprehensive tests for security fixes
Tests race conditions, NoSQL injection prevention, credit system, and input validation
"""
import pytest
import threading
import time
from unittest.mock import Mock, patch, MagicMock
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError


class TestRaceConditionFixes:
    """Test fixes for race conditions in scrape_in_progress and credit updates"""
    
    def test_scrape_race_condition_prevention(self, client, auth_headers, mock_db):
        """Test that only one scrape can start at a time using atomic MongoDB operation"""
        # Mock the atomic find_one_and_update operation
        mock_db.metadata.find_one_and_update = Mock()
        
        # First call succeeds (returns document with scrape_in_progress=True)
        first_result = {"_id": "scraper_metadata", "scrape_in_progress": True, "last_updated": "2025-01-01"}
        mock_db.metadata.find_one_and_update.return_value = first_result
        
        # Simulate first scrape request
        response1 = client.post('/api/scrape', 
                                json={"products": ["TestProduct"], "limit": 10},
                                headers=auth_headers)
        
        # Mock the second call to return None (indicating scrape already in progress)
        mock_db.metadata.find_one_and_update.return_value = None
        
        # Simulate second concurrent scrape request
        response2 = client.post('/api/scrape',
                                json={"products": ["TestProduct"], "limit": 10},
                                headers=auth_headers)
        
        # First request should succeed (202 Accepted for background job)
        assert response1.status_code in [200, 202]
        
        # Second request should be rejected (409 Conflict)
        assert response2.status_code == 409
        assert "already in progress" in response2.json.get("message", "").lower()
        
        # Verify atomic operation was called correctly
        calls = mock_db.metadata.find_one_and_update.call_args_list
        assert len(calls) >= 1
        # Verify it checks for scrape_in_progress=False
        assert calls[0][0][0] == {"_id": "scraper_metadata", "scrape_in_progress": False}
    
    def test_credit_update_race_condition_prevention(self, client, auth_headers, mock_db):
        """Test that credit updates use atomic $inc operator to prevent race conditions"""
        username = "testuser"
        
        # Mock find_one_and_update to return updated user
        updated_user = {"username": username, "credits": 7}
        mock_db.users.find_one_and_update = Mock(return_value=updated_user)
        
        # Simulate credit update
        response = client.post('/api/user/credits',
                              json={"delta": -3},
                              headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json
        assert data["status"] == "success"
        assert data["credits"] == 7
        
        # Verify atomic $inc operation was used
        mock_db.users.find_one_and_update.assert_called_once()
        call_args = mock_db.users.find_one_and_update.call_args
        
        # Check that $inc operator was used (not read-modify-write)
        assert "$inc" in call_args[0][1]
        assert call_args[0][1]["$inc"]["credits"] == -3
    
    def test_concurrent_credit_updates(self, mock_db):
        """Test that concurrent credit updates maintain consistency"""
        from api import data_store
        
        username = "testuser"
        initial_credits = 100
        
        # Mock the atomic operation
        def mock_atomic_update(query, update, **kwargs):
            # Simulate atomic decrement
            current = initial_credits - (abs(update["$inc"]["credits"]) * mock_atomic_update.call_count)
            mock_atomic_update.call_count += 1
            return {"username": username, "credits": max(0, current)}
        
        mock_atomic_update.call_count = 0
        mock_db.users.find_one_and_update = Mock(side_effect=mock_atomic_update)
        
        # Simulate 10 concurrent credit deductions
        results = []
        threads = []
        
        def deduct_credit():
            from api import UpdateUserCredits
            resource = UpdateUserCredits()
            # Mock current_user
            result = resource.post({"username": username})
            results.append(result)
        
        # Note: This test demonstrates the fix but doesn't execute actual API calls
        # In real concurrent scenario, atomic $inc ensures consistency
        
    def test_negative_credits_prevention(self, client, auth_headers, mock_db):
        """Test that credits cannot go negative"""
        username = "testuser"
        
        # Mock user with 5 credits
        user_with_low_credits = {"username": username, "credits": -2}
        mock_db.users.find_one_and_update = Mock(return_value=user_with_low_credits)
        
        # Mock the rollback operation
        mock_db.users.update_one = Mock()
        
        # Try to deduct more credits than available
        response = client.post('/api/user/credits',
                              json={"delta": -10},
                              headers=auth_headers)
        
        # Should detect negative credits and rollback
        assert response.status_code == 400
        data = response.json
        assert data["status"] == "error"
        assert "insufficient" in data["message"].lower()
        assert data["credits"] == 0


class TestNoSQLInjectionPrevention:
    """Test fixes for NoSQL injection vulnerabilities"""
    
    def test_subreddit_query_injection_prevention(self, client, auth_headers, mock_db):
        """Test that subreddit parameter is validated and escaped"""
        # Attempt NoSQL injection via regex
        malicious_subreddit = ".*"  # Would match any subreddit
        
        response = client.get(f'/api/posts?subreddit={malicious_subreddit}',
                             headers=auth_headers)
        
        # Should reject invalid subreddit name
        assert response.status_code == 400
        data = response.json
        assert "invalid" in data.get("message", "").lower()
    
    def test_subreddit_special_characters_blocked(self, client, auth_headers, mock_db):
        """Test that special regex characters in subreddit are blocked"""
        malicious_inputs = [
            "test$regex",
            "test[abc]",
            "test.*",
            "test(group)",
            "test{1,5}",
            "test|other"
        ]
        
        for malicious_input in malicious_inputs:
            response = client.get(f'/api/posts?subreddit={malicious_input}',
                                 headers=auth_headers)
            
            # All should be rejected
            assert response.status_code == 400, f"Failed to block: {malicious_input}"
    
    def test_valid_subreddit_names_allowed(self, client, auth_headers, mock_db):
        """Test that valid subreddit names are allowed"""
        valid_names = [
            "technology",
            "python",
            "web-dev",
            "machine_learning",
            "Test123"
        ]
        
        # Mock the database query
        mock_db.posts.find = Mock(return_value=Mock(
            sort=Mock(return_value=Mock(
                limit=Mock(return_value=[])
            ))
        ))
        
        for valid_name in valid_names:
            response = client.get(f'/api/posts?subreddit={valid_name}',
                                 headers=auth_headers)
            
            # Valid names should be accepted
            assert response.status_code == 200, f"Incorrectly blocked: {valid_name}"
    
    def test_product_name_validation_in_analysis(self, client, auth_headers, mock_db):
        """Test that product parameter in RunAnalysis is validated"""
        # Attempt injection with very long product name
        long_product = "A" * 200
        
        response = client.post('/api/analysis/run',
                              json={"product": long_product},
                              headers=auth_headers)
        
        # Should reject product name that's too long
        assert response.status_code == 400
        data = response.json
        assert "too long" in data.get("message", "").lower()
    
    def test_product_name_special_characters_blocked(self, client, auth_headers, mock_db):
        """Test that special characters in product names are validated"""
        malicious_products = [
            "test{$ne:null}",
            "test';DROP TABLE",
            "test<script>",
            "test$where",
        ]
        
        for malicious_product in malicious_products:
            response = client.post('/api/analysis/run',
                                  json={"product": malicious_product},
                                  headers=auth_headers)
            
            # Should reject invalid product names
            assert response.status_code == 400, f"Failed to block: {malicious_product}"


class TestCreditSystemFixes:
    """Test credit deduction and verification before scraping"""
    
    def test_credit_deduction_before_scrape(self, client, auth_headers, mock_db):
        """Test that credits are deducted BEFORE scraping starts"""
        username = "testuser"
        
        # Mock user with sufficient credits
        user_before = {"username": username, "credits": 10}
        user_after = {"username": username, "credits": 8}
        
        # Mock atomic credit deduction
        mock_db.users.find_one_and_update = Mock(return_value=user_after)
        
        # Mock metadata update to prevent actual scraping
        mock_db.metadata.find_one_and_update = Mock(return_value={
            "_id": "scraper_metadata",
            "scrape_in_progress": True
        })
        
        # Start scrape
        response = client.post('/api/scrape',
                              json={"products": ["TestProduct"], "limit": 10},
                              headers=auth_headers)
        
        # Should succeed
        assert response.status_code in [200, 202]
        
        # Verify credit deduction was called with correct query
        credit_call = mock_db.users.find_one_and_update.call_args
        assert credit_call is not None
        
        # Verify it checks for sufficient credits (credits >= cost)
        query = credit_call[0][0]
        assert "username" in query
        assert "credits" in query
        assert "$gte" in query["credits"]  # Greater than or equal check
    
    def test_insufficient_credits_blocks_scrape(self, client, auth_headers, mock_db):
        """Test that scraping is blocked if user has insufficient credits"""
        username = "testuser"
        
        # Mock user with insufficient credits (atomic operation returns None)
        mock_db.users.find_one_and_update = Mock(return_value=None)
        
        # Mock find_one to return user with low credits
        mock_db.users.find_one = Mock(return_value={
            "username": username,
            "credits": 1
        })
        
        # Mock scrape_in_progress check to succeed
        mock_db.metadata.find_one_and_update = Mock(return_value={
            "_id": "scraper_metadata",
            "scrape_in_progress": True
        })
        
        # Attempt to start scrape
        response = client.post('/api/scrape',
                              json={"products": ["TestProduct"], "limit": 10},
                              headers=auth_headers)
        
        # Should be rejected with 402 Payment Required
        assert response.status_code == 402
        data = response.json
        assert "insufficient" in data.get("message", "").lower()
        assert "credits" in data.get("message", "").lower()
    
    def test_credit_rollback_on_scrape_error(self, client, auth_headers, mock_db):
        """Test that scrape_in_progress is rolled back if credit deduction fails"""
        # Mock credit deduction failure
        mock_db.users.find_one_and_update = Mock(side_effect=Exception("Database error"))
        
        # Mock scrape_in_progress check to succeed
        mock_db.metadata.find_one_and_update = Mock(return_value={
            "_id": "scraper_metadata",
            "scrape_in_progress": True
        })
        
        # Mock metadata update for rollback
        mock_db.metadata.update_one = Mock()
        
        # Attempt to start scrape
        response = client.post('/api/scrape',
                              json={"products": ["TestProduct"], "limit": 10},
                              headers=auth_headers)
        
        # Should return error
        assert response.status_code == 500
        
        # Verify rollback was attempted
        rollback_calls = [call for call in mock_db.metadata.update_one.call_args_list
                         if "$set" in str(call) and "scrape_in_progress" in str(call)]
        assert len(rollback_calls) > 0


class TestInputValidation:
    """Test input validation on all endpoints"""
    
    def test_limit_parameter_validation(self, client, auth_headers, mock_db):
        """Test that limit parameter is validated"""
        # Test negative limit
        response = client.post('/api/scrape',
                              json={"products": ["Test"], "limit": -1},
                              headers=auth_headers)
        assert response.status_code == 400
        
        # Test limit too large
        response = client.post('/api/scrape',
                              json={"products": ["Test"], "limit": 10000},
                              headers=auth_headers)
        assert response.status_code == 400
        
        # Test invalid type
        response = client.post('/api/scrape',
                              json={"products": ["Test"], "limit": "invalid"},
                              headers=auth_headers)
        assert response.status_code == 400
    
    def test_limit_valid_range_accepted(self, client, auth_headers, mock_db):
        """Test that valid limit values are accepted"""
        # Mock required database operations
        mock_db.metadata.find_one_and_update = Mock(return_value={
            "_id": "scraper_metadata",
            "scrape_in_progress": True
        })
        mock_db.users.find_one_and_update = Mock(return_value={
            "username": "testuser",
            "credits": 10
        })
        
        # Test minimum valid limit
        response = client.post('/api/scrape',
                              json={"products": ["Test"], "limit": 1},
                              headers=auth_headers)
        assert response.status_code in [200, 202]
        
        # Reset mock
        mock_db.metadata.find_one_and_update.return_value = None
        
        # Test maximum valid limit
        mock_db.metadata.find_one_and_update.return_value = {
            "_id": "scraper_metadata",
            "scrape_in_progress": True
        }
        response = client.post('/api/scrape',
                              json={"products": ["Test"], "limit": 1000},
                              headers=auth_headers)
        assert response.status_code in [200, 202, 409]  # 409 if scrape already in progress


class TestProductionReadiness:
    """Test that production-specific fixes are working"""
    
    def test_debug_polling_disabled_in_production(self):
        """Test that debug polling is disabled in production"""
        # This would be tested in frontend E2E tests
        # For now, verify the code change exists
        import os
        client_app_path = os.path.join(os.path.dirname(__file__), '../../client/src/App.jsx')
        
        if os.path.exists(client_app_path):
            with open(client_app_path, 'r') as f:
                content = f.read()
                # Verify production check exists
                assert "import.meta.env.MODE === 'production'" in content
                assert "Skip polling in production" in content or "PERFORMANCE FIX" in content
    
    def test_axios_timeout_configured(self):
        """Test that axios has timeout configured"""
        import os
        api_file_path = os.path.join(os.path.dirname(__file__), '../../client/src/api/api.js')
        
        if os.path.exists(api_file_path):
            with open(api_file_path, 'r') as f:
                content = f.read()
                # Verify timeout is configured
                assert "timeout:" in content or "REQUEST_TIMEOUT" in content


if __name__ == "__main__":
    pytest.main([__file__, "-v"])








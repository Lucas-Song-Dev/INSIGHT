import pytest
import json
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock
import bcrypt
import jwt
import os

from app import app, data_store
from api import calculate_insight_cost, deduct_user_credits


class TestUserSystem:
    """Comprehensive tests for the user system including registration, authentication, and credits"""
    
    @pytest.fixture
    def client(self):
        """Create a test client"""
        app.config['TESTING'] = True
        with app.test_client() as client:
            yield client
    
    @pytest.fixture
    def mock_db(self):
        """Mock MongoDB database"""
        mock_db = MagicMock()
        mock_users = MagicMock()
        mock_db.users = mock_users
        
        with patch.object(data_store, 'db', mock_db):
            yield mock_db
    
    @pytest.fixture
    def sample_user(self):
        """Sample user data for testing"""
        return {
            'username': 'testuser',
            'password': 'TestPassword123!',
            'email': 'test@example.com'
        }
    
    @pytest.fixture
    def sample_user_db_record(self, sample_user):
        """Sample user database record"""
        salt = bcrypt.gensalt()
        hashed_password = bcrypt.hashpw(sample_user['password'].encode('utf-8'), salt)
        
        return {
            'username': sample_user['username'],
            'password': hashed_password.decode('utf-8'),
            'email': sample_user['email'],
            'credits': 5,
            'created_at': datetime.utcnow(),
            'last_login': None
        }

    def test_user_registration_success(self, client, mock_db, sample_user):
        """Test successful user registration"""
        # Mock database operations
        mock_db.users.find_one.return_value = None  # User doesn't exist
        mock_db.users.insert_one.return_value = MagicMock()
        
        response = client.post('/api/register', 
                             data=json.dumps(sample_user),
                             content_type='application/json')
        
        assert response.status_code == 201
        data = json.loads(response.data)
        assert data['status'] == 'success'
        assert 'User registered successfully' in data['message']
        
        # Verify database calls
        mock_db.users.find_one.assert_called_once_with({'username': sample_user['username']})
        mock_db.users.insert_one.assert_called_once()
        
        # Verify user record has credits
        inserted_user = mock_db.users.insert_one.call_args[0][0]
        assert inserted_user['credits'] == 5
        assert inserted_user['username'] == sample_user['username']
        assert inserted_user['email'] == sample_user['email']
        assert 'password' in inserted_user
        assert inserted_user['password'] != sample_user['password']  # Should be hashed

    def test_user_registration_duplicate_username(self, client, mock_db, sample_user, sample_user_db_record):
        """Test registration with existing username"""
        # Mock user already exists
        mock_db.users.find_one.return_value = sample_user_db_record
        
        response = client.post('/api/register',
                             data=json.dumps(sample_user),
                             content_type='application/json')
        
        assert response.status_code == 409
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'Username already exists' in data['message']

    def test_user_registration_weak_password(self, client, mock_db, sample_user):
        """Test registration with weak password"""
        mock_db.users.find_one.return_value = None
        
        weak_user = sample_user.copy()
        weak_user['password'] = '123'  # Too weak
        
        response = client.post('/api/register',
                             data=json.dumps(weak_user),
                             content_type='application/json')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'password' in data['message'].lower()

    def test_user_registration_invalid_input(self, client, mock_db):
        """Test registration with invalid input"""
        invalid_user = {
            'username': '',  # Empty username
            'password': 'ValidPassword123!',
            'email': 'invalid-email'  # Invalid email format
        }
        
        response = client.post('/api/register',
                             data=json.dumps(invalid_user),
                             content_type='application/json')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['status'] == 'error'

    def test_user_login_success(self, client, mock_db, sample_user, sample_user_db_record):
        """Test successful user login"""
        # Mock user exists in database
        mock_db.users.find_one.return_value = sample_user_db_record
        mock_db.users.update_one.return_value = MagicMock()
        
        login_data = {
            'username': sample_user['username'],
            'password': sample_user['password']
        }
        
        response = client.post('/api/login',
                             data=json.dumps(login_data),
                             content_type='application/json')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['status'] == 'success'
        assert 'Authentication successful' in data['message']
        
        # Check that cookie is set
        set_cookie_headers = response.headers.getlist('Set-Cookie')
        assert any('access_token' in cookie for cookie in set_cookie_headers)
        
        # Verify last_login was updated
        mock_db.users.update_one.assert_called_once()

    def test_user_login_invalid_credentials(self, client, mock_db, sample_user):
        """Test login with invalid credentials"""
        # Mock user doesn't exist
        mock_db.users.find_one.return_value = None
        
        login_data = {
            'username': sample_user['username'],
            'password': 'wrongpassword'
        }
        
        response = client.post('/api/login',
                             data=json.dumps(login_data),
                             content_type='application/json')
        
        assert response.status_code == 401
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'Invalid credentials' in data['message']

    def test_user_login_wrong_password(self, client, mock_db, sample_user, sample_user_db_record):
        """Test login with wrong password"""
        # Mock user exists but password is wrong
        mock_db.users.find_one.return_value = sample_user_db_record
        
        login_data = {
            'username': sample_user['username'],
            'password': 'wrongpassword'
        }
        
        response = client.post('/api/login',
                             data=json.dumps(login_data),
                             content_type='application/json')
        
        assert response.status_code == 401
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'Invalid credentials' in data['message']

    def test_user_logout(self, client):
        """Test user logout"""
        response = client.post('/api/logout')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['status'] == 'success'
        assert 'Logout successful' in data['message']
        
        # Check that cookie is cleared
        set_cookie_headers = response.headers.getlist('Set-Cookie')
        access_token_cookie = next((cookie for cookie in set_cookie_headers if 'access_token' in cookie), None)
        assert access_token_cookie is not None
        assert 'Expires=' in access_token_cookie  # Cookie should be expired

    def create_authenticated_request(self, client, username='testuser'):
        """Helper to create an authenticated request"""
        # Create a valid JWT token
        jwt_secret = os.getenv('JWT_SECRET_KEY', 'test_jwt_secret_key_that_is_at_least_32_chars_long_for_testing')
        token_payload = {
            'username': username,
            'exp': datetime.utcnow() + timedelta(hours=1)
        }
        token = jwt.encode(token_payload, jwt_secret, algorithm='HS256')
        
        # Set the token as a cookie (Flask test client syntax)
        client.set_cookie(domain='localhost', key='access_token', value=token)
        return token

    def test_get_user_profile_success(self, client, mock_db, sample_user_db_record):
        """Test getting user profile successfully"""
        # Create authenticated request
        self.create_authenticated_request(client, sample_user_db_record['username'])
        
        # Mock database response
        mock_db.users.find_one.return_value = sample_user_db_record
        
        response = client.get('/api/user/profile')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['status'] == 'success'
        assert 'user' in data
        
        user_data = data['user']
        assert user_data['username'] == sample_user_db_record['username']
        assert user_data['email'] == sample_user_db_record['email']
        assert user_data['credits'] == sample_user_db_record['credits']
        assert 'created_at' in user_data
        
        # Verify password is not included
        assert 'password' not in user_data

    def test_get_user_profile_unauthenticated(self, client):
        """Test getting user profile without authentication"""
        response = client.get('/api/user/profile')
        
        assert response.status_code == 401
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'Authentication token is missing' in data['message']

    def test_get_user_profile_user_not_found(self, client, mock_db):
        """Test getting profile for non-existent user"""
        # Create authenticated request
        self.create_authenticated_request(client, 'nonexistentuser')
        
        # Mock user not found
        mock_db.users.find_one.return_value = None
        
        response = client.get('/api/user/profile')
        
        assert response.status_code == 404
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'User not found' in data['message']

    def test_update_user_credits_success(self, client, mock_db, sample_user_db_record):
        """Test updating user credits successfully"""
        # Create authenticated request
        self.create_authenticated_request(client, sample_user_db_record['username'])
        
        # Mock database operations
        mock_db.users.find_one.return_value = sample_user_db_record
        mock_db.users.update_one.return_value = MagicMock()
        
        update_data = {
            'username': sample_user_db_record['username'],
            'credits': 3,
            'operation': 'deduct'
        }
        
        response = client.post('/api/user/credits',
                             data=json.dumps(update_data),
                             content_type='application/json')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['status'] == 'success'
        assert data['old_credits'] == 5
        assert data['new_credits'] == 2  # 5 - 3 = 2

    def test_update_user_credits_unauthorized(self, client, mock_db, sample_user_db_record):
        """Test updating credits for different user (should fail)"""
        # Create authenticated request for different user
        self.create_authenticated_request(client, 'differentuser')
        
        update_data = {
            'username': sample_user_db_record['username'],
            'credits': 10,
            'operation': 'add'
        }
        
        response = client.post('/api/user/credits',
                             data=json.dumps(update_data),
                             content_type='application/json')
        
        assert response.status_code == 403
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'Unauthorized' in data['message']

    def test_calculate_insight_cost(self):
        """Test credit cost calculation"""
        # Test small analysis
        cost = calculate_insight_cost(50, 'week')
        assert cost == 2  # 1 * 1 * 2 = 2
        
        # Test medium analysis
        cost = calculate_insight_cost(100, 'month')
        assert cost == 6  # 1 * 2 * 3 = 6
        
        # Test large analysis
        cost = calculate_insight_cost(200, 'year')
        assert cost == 12  # 1 * 3 * 4 = 12
        
        # Test comprehensive analysis
        cost = calculate_insight_cost(300, 'all')
        assert cost == 20  # 1 * 4 * 5 = 20
        
        # Test minimum cost
        cost = calculate_insight_cost(10, 'hour')
        assert cost == 1  # Minimum cost

    def test_deduct_user_credits_success(self, mock_db):
        """Test successful credit deduction"""
        # Mock user with sufficient credits
        user_record = {
            'username': 'testuser',
            'credits': 10
        }
        mock_db.users.find_one.return_value = user_record
        mock_db.users.update_one.return_value = MagicMock()
        
        result = deduct_user_credits('testuser', 3)
        
        assert result is True
        mock_db.users.update_one.assert_called_once_with(
            {'username': 'testuser'},
            {'$set': {'credits': 7}}
        )

    def test_deduct_user_credits_insufficient(self, mock_db):
        """Test credit deduction with insufficient credits"""
        # Mock user with insufficient credits
        user_record = {
            'username': 'testuser',
            'credits': 2
        }
        mock_db.users.find_one.return_value = user_record
        
        result = deduct_user_credits('testuser', 5)
        
        assert result is False
        # Should not update database
        mock_db.users.update_one.assert_not_called()

    def test_deduct_user_credits_user_not_found(self, mock_db):
        """Test credit deduction for non-existent user"""
        mock_db.users.find_one.return_value = None
        
        result = deduct_user_credits('nonexistentuser', 1)
        
        assert result is False

    def test_scrape_endpoint_with_credits(self, client, mock_db, sample_user_db_record):
        """Test scrape endpoint deducts credits properly"""
        # Create authenticated request
        self.create_authenticated_request(client, sample_user_db_record['username'])
        
        # Mock user with sufficient credits
        user_with_credits = sample_user_db_record.copy()
        user_with_credits['credits'] = 10
        mock_db.users.find_one.return_value = user_with_credits
        mock_db.users.update_one.return_value = MagicMock()
        
        # Mock Reddit and Claude API keys
        with patch.dict(os.environ, {
            'REDDIT_CLIENT_ID': 'test_client_id',
            'REDDIT_CLIENT_SECRET': 'test_client_secret',
            'ANTHROPIC_API_KEY': 'test_anthropic_key'
        }):
            scrape_data = {
                'topic': 'react',
                'limit': 50,
                'time_filter': 'week'
            }
            
            response = client.post('/api/scrape',
                                 data=json.dumps(scrape_data),
                                 content_type='application/json')
            
            assert response.status_code == 200
            data = json.loads(response.data)
            assert data['status'] == 'success'
            assert 'credit_cost' in data
            assert data['credit_cost'] == 2  # Expected cost for this operation

    def test_scrape_endpoint_insufficient_credits(self, client, mock_db, sample_user_db_record):
        """Test scrape endpoint with insufficient credits"""
        # Create authenticated request
        self.create_authenticated_request(client, sample_user_db_record['username'])
        
        # Mock user with insufficient credits
        user_with_low_credits = sample_user_db_record.copy()
        user_with_low_credits['credits'] = 1
        mock_db.users.find_one.return_value = user_with_low_credits
        
        # Mock Reddit and Claude API keys
        with patch.dict(os.environ, {
            'REDDIT_CLIENT_ID': 'test_client_id',
            'REDDIT_CLIENT_SECRET': 'test_client_secret',
            'ANTHROPIC_API_KEY': 'test_anthropic_key'
        }):
            scrape_data = {
                'topic': 'react',
                'limit': 100,  # This will cost more than 1 credit
                'time_filter': 'month'
            }
            
            response = client.post('/api/scrape',
                                 data=json.dumps(scrape_data),
                                 content_type='application/json')
            
            assert response.status_code == 402  # Payment Required
            data = json.loads(response.data)
            assert data['status'] == 'error'
            assert 'Insufficient credits' in data['message']
            assert 'required_credits' in data
            assert 'available_credits' in data

    def test_jwt_token_expiration(self, client, mock_db):
        """Test that expired JWT tokens are rejected"""
        # Create an expired token
        jwt_secret = os.getenv('JWT_SECRET_KEY', 'test_secret_key_for_testing_purposes_only')
        expired_payload = {
            'username': 'testuser',
            'exp': datetime.utcnow() - timedelta(hours=1)  # Expired 1 hour ago
        }
        expired_token = jwt.encode(expired_payload, jwt_secret, algorithm='HS256')
        
        # Set the expired token as a cookie
        client.set_cookie(domain='localhost', key='access_token', value=expired_token)
        
        response = client.get('/api/user/profile')
        
        assert response.status_code == 401
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'Token has expired' in data['message']

    def test_invalid_jwt_token(self, client):
        """Test that invalid JWT tokens are rejected"""
        # Set an invalid token
        client.set_cookie(domain='localhost', key='access_token', value='invalid_token')
        
        response = client.get('/api/user/profile')
        
        assert response.status_code == 401
        data = json.loads(response.data)
        assert data['status'] == 'error'
        assert 'Invalid token' in data['message']

    def test_database_unavailable_scenarios(self, client):
        """Test behavior when database is unavailable"""
        # Mock database as None
        with patch.object(data_store, 'db', None):
            # Test registration
            sample_user = {
                'username': 'testuser',
                'password': 'TestPassword123!',
                'email': 'test@example.com'
            }
            
            response = client.post('/api/register',
                                 data=json.dumps(sample_user),
                                 content_type='application/json')
            
            assert response.status_code == 500
            data = json.loads(response.data)
            assert data['status'] == 'error'
            assert 'Database not available' in data['message']
            
            # Test profile retrieval
            self.create_authenticated_request(client)
            response = client.get('/api/user/profile')
            
            assert response.status_code == 500
            data = json.loads(response.data)
            assert data['status'] == 'error'
            assert 'Database not available' in data['message']
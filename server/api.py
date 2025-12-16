import logging
import json
import os
from flask import jsonify, request, Blueprint, current_app, make_response
from flask_restful import Resource
from datetime import datetime, timedelta, timezone
from threading import Thread
import re
import praw

from dotenv import load_dotenv
from functools import wraps
import jwt
import bcrypt
from security import (
    validate_input, sanitize_input, rate_limit, 
    validate_password_strength, sanitize_error_message
)

class CORSResource(Resource):
    """Base resource class that handles OPTIONS for CORS preflight"""
    def options(self):
        """Handle CORS preflight OPTIONS request"""
        # Get the origin from the request
        origin = request.headers.get('Origin', '')
        
        # Allowed origins (must match app.py CORS configuration)
        allowed_origins = [
            "https://iinsightss.com",
            "https://www.iinsightss.com",
            "https://reddit-painpoint-4nx9b.ondigitalocean.app",
            "http://localhost:5173"
        ]
        
        # Create response with proper CORS headers
        response = make_response('', 200)
        
        # Add CORS headers - Flask-CORS will also add headers via after_request hook
        # but we add them here to ensure they're present for the preflight check
        if origin in allowed_origins:
            response.headers['Access-Control-Allow-Origin'] = origin
        elif origin:
            # For development, allow localhost origins
            if 'localhost' in origin or '127.0.0.1' in origin:
                response.headers['Access-Control-Allow-Origin'] = origin
        
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With'
        response.headers['Access-Control-Max-Age'] = '3600'
        
        return response

# Import data_store from app
from app import data_store
from reddit_scraper import RedditScraper
from nlp_analyzer import NLPAnalyzer
from advanced_nlp_analyzer import AdvancedNLPAnalyzer
from anthropic_analyzer import AnthropicAnalyzer
load_dotenv()
logger = logging.getLogger(__name__)

# Load environment variables
# Get API credentials from environment variables
REDDIT_CLIENT_ID = os.getenv("REDDIT_CLIENT_ID")
REDDIT_CLIENT_SECRET = os.getenv("REDDIT_CLIENT_SECRET")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
# Validate JWT secret on startup
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
if not JWT_SECRET_KEY:
    raise ValueError("JWT_SECRET_KEY environment variable is required")
if JWT_SECRET_KEY in ["your-secret-key-change-in-production", "dev_secret_key", "secret"]:
    raise ValueError("JWT_SECRET_KEY must be changed from default value")
if len(JWT_SECRET_KEY) < 32:
    raise ValueError("JWT_SECRET_KEY must be at least 32 characters long")
JWT_ACCESS_TOKEN_EXPIRES = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRES", 3600))  # 1 hour default


# Initialize scraper and analyzers
scraper = RedditScraper()
analyzer = NLPAnalyzer()  # Legacy analyzer for backward compatibility
advanced_analyzer = AdvancedNLPAnalyzer()  # Advanced NLP with 94% accuracy target
anthropic_analyzer = AnthropicAnalyzer()
# In api_resources.py - no need to create a new MongoDB store here since we're using the one from app.py
mongodb_uri = os.getenv("MONGODB_URI")

# Initialize Reddit and Anthropic clients if credentials are available
if REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET:
    scraper.initialize_client(REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET)
    
if ANTHROPIC_API_KEY:
    anthropic_analyzer.initialize_client(ANTHROPIC_API_KEY)


class Register(CORSResource):
    """API endpoint for user registration"""
    @rate_limit(max_requests=5, window=300)  # 5 registrations per 5 minutes
    def post(self):
        """
        Register a new user
        
        POST parameters:
        - username (str): Username
        - password (str): Password
        - email (str): Email (optional)
        - full_name (str): Full name (required)
        - preferred_name (str): Preferred name (required)
        - birthday (str): Birthday in YYYY-MM-DD format (required)
        
        Returns:
            JSON response confirming registration
        """
        logger.info("[REGISTER] ========== REGISTRATION REQUEST RECEIVED ==========")
        data = request.get_json() or {}
        logger.info(f"[REGISTER] Request data keys: {list(data.keys())}")
        
        username = sanitize_input(data.get('username', ''))
        password = data.get('password', '')
        email = sanitize_input(data.get('email', '')) if data.get('email') else None
        full_name = sanitize_input(data.get('full_name', '')) if data.get('full_name') else None
        preferred_name = sanitize_input(data.get('preferred_name', '')) if data.get('preferred_name') else None
        birthday = data.get('birthday', '') if data.get('birthday') else None
        
        logger.info(f"[REGISTER] Extracted fields - username: {username}, has_password: {bool(password)}, email: {email}, full_name: {full_name}, preferred_name: {preferred_name}, birthday: {birthday}")
        
        # Validate input with security rules
        validation_rules = {
            'username': {
                'type': str,
                'required': True,
                'min_len': 3,
                'max_len': 50,
                'pattern': r'^[a-zA-Z0-9_]+$'
            },
            'password': {
                'type': str,
                'required': True,
                'min_len': 8,
                'max_len': 128
            },
            'email': {
                'type': str,
                'required': False,
                'max_len': 255,
                'pattern': r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$' if email else None
            },
            'full_name': {
                'type': str,
                'required': True,
                'min_len': 1,
                'max_len': 100
            },
            'preferred_name': {
                'type': str,
                'required': True,
                'min_len': 1,
                'max_len': 50
            },
            'birthday': {
                'type': str,
                'required': True,
                'pattern': r'^\d{4}-\d{2}-\d{2}$'  # YYYY-MM-DD format
            }
        }
        
        # Validate required fields
        validation_data = {
            'username': username,
            'password': password,
            'email': email,
            'full_name': full_name,
            'preferred_name': preferred_name,
            'birthday': birthday
        }
        
        logger.info("[REGISTER] Step 1: Validating input fields...")
        is_valid, errors = validate_input(validation_data, validation_rules)
        if not is_valid:
            logger.warning(f"[REGISTER] Validation failed: {errors}")
            return {"status": "error", "message": "; ".join(errors)}, 400
        
        logger.info("[REGISTER] Step 2: Input validation passed")
        
        # Validate password strength
        logger.info("[REGISTER] Step 3: Validating password strength...")
        is_strong, pwd_error = validate_password_strength(password)
        if not is_strong:
            logger.warning(f"[REGISTER] Password strength validation failed: {pwd_error}")
            return {"status": "error", "message": pwd_error}, 400
        
        logger.info("[REGISTER] Step 4: Password strength validation passed")
        
        # Validate birthday format
        if birthday:
            try:
                from datetime import datetime as dt
                dt.strptime(birthday, '%Y-%m-%d')
                logger.info(f"[REGISTER] Birthday format valid: {birthday}")
            except ValueError:
                logger.warning(f"[REGISTER] Invalid birthday format: {birthday}")
                return {"status": "error", "message": "Invalid birthday format. Use YYYY-MM-DD"}, 400
        
        # Check if username already exists in MongoDB
        if data_store.db is not None:
            logger.info("[REGISTER] Step 5: Checking if username already exists...")
            # Check if user already exists
            existing_user = data_store.db.users.find_one({"username": username})
            if existing_user:
                logger.warning(f"[REGISTER] Username already exists: {username}")
                return {"status": "error", "message": "Username already exists"}, 409
            
            logger.info("[REGISTER] Step 6: Username is available, hashing password...")
            # Hash password using bcrypt
            salt = bcrypt.gensalt()
            hashed_password = bcrypt.hashpw(password.encode('utf-8'), salt)
            
            logger.info("[REGISTER] Step 7: Creating user document...")
            # Create user document
            user = {
                "username": username,
                "password": hashed_password.decode('utf-8'),  # Store as string
                "email": email,
                "full_name": full_name,
                "preferred_name": preferred_name,
                "birthday": birthday,
                "credits": 5,  # Default credits for new users
                "created_at": datetime.now(timezone.utc),
                "last_login": None
            }
            
            logger.info(f"[REGISTER] Step 8: User document created with fields: {list(user.keys())}")
            logger.info(f"[REGISTER] User data (excluding password): username={username}, email={email}, full_name={full_name}, preferred_name={preferred_name}, birthday={birthday}")
            
            # Insert into database
            try:
                logger.info("[REGISTER] Step 9: Inserting user into database...")
                result = data_store.db.users.insert_one(user)
                logger.info(f"[REGISTER] Step 10: User inserted successfully with ID: {result.inserted_id}")
                logger.info("[REGISTER] ========== REGISTRATION SUCCESS ==========")
                return {"status": "success", "message": "User registered successfully"}, 201
            except Exception as e:
                logger.error(f"[REGISTER] ========== REGISTRATION ERROR ==========")
                logger.error(f"[REGISTER] Error creating user: {str(e)}", exc_info=True)
                return {"status": "error", "message": "Failed to create user"}, 500
        else:
            logger.error("[REGISTER] ========== REGISTRATION ERROR ==========")
            logger.error("[REGISTER] Database not available")
            return {"status": "error", "message": "Database not available"}, 500

# JWT Authentication helper
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        logger.info(f"[TOKEN_CHECK] ========== TOKEN CHECK START ==========")
        logger.info(f"[TOKEN_CHECK] Function: {f.__name__}")
        logger.info(f"[TOKEN_CHECK] Path: {request.path}")
        logger.info(f"[TOKEN_CHECK] Method: {request.method}")
        logger.info(f"[TOKEN_CHECK] Headers: {dict(request.headers)}")
        logger.info(f"[TOKEN_CHECK] Cookies present: {list(request.cookies.keys())}")
        logger.info(f"[TOKEN_CHECK] Authorization header: {request.headers.get('Authorization', 'Not present')}")
        
        token = None

        # Try to get token from Authorization header first (for SPA compatibility)
        auth_header = request.headers.get('Authorization')
        logger.info(f"[TOKEN_CHECK] Authorization header: {'Present' if auth_header else 'Not present'}")
        if auth_header:
            logger.info(f"[TOKEN_CHECK] Authorization header preview: {auth_header[:50]}...")
            if auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]
                logger.info(f"[TOKEN_CHECK] Token extracted from header: Found (length: {len(token)})")

        # If not in header, try to get token from cookies (fallback)
        if not token:
            token = request.cookies.get('access_token')
            logger.info(f"[TOKEN_CHECK] Token from cookies: {'Found' if token else 'Not found'}")
            if token:
                logger.info(f"[TOKEN_CHECK] Token length: {len(token)} characters")
        
        if not token:
            logger.warning(f"[TOKEN_CHECK] ERROR: No token found - returning 401")
            logger.warning(f"[TOKEN_CHECK] ========== TOKEN CHECK FAILED ==========")
            return {"status": "error", "message": "Authentication token is missing"}, 401
        
        try:
            logger.info(f"[TOKEN_CHECK] Decoding token...")
            # Decode the token
            payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=["HS256"])
            current_user = payload
            username = payload.get('username', 'unknown')
            logger.info(f"[TOKEN_CHECK] Token valid! User: {username}")
            logger.info(f"[TOKEN_CHECK] Token payload: {payload}")
            logger.info(f"[TOKEN_CHECK] Authentication successful for {request.path} - User: {username}")
        except jwt.ExpiredSignatureError:
            logger.warning(f"[TOKEN_CHECK] ERROR: Token expired")
            logger.warning(f"[TOKEN_CHECK] ========== TOKEN CHECK FAILED ==========")
            return {"status": "error", "message": "Token has expired"}, 401
        except jwt.InvalidTokenError as e:
            logger.warning(f"[TOKEN_CHECK] ERROR: Invalid token - {str(e)}")
            logger.warning(f"[TOKEN_CHECK] ========== TOKEN CHECK FAILED ==========")
            return {"status": "error", "message": "Invalid token"}, 401
        except Exception as e:
            logger.error(f"[TOKEN_CHECK] ERROR: Unexpected error - {str(e)}", exc_info=True)
            logger.error(f"[TOKEN_CHECK] ========== TOKEN CHECK ERROR ==========")
            return {"status": "error", "message": "Authentication error"}, 401
        
        # Preserve self (first argument) and pass current_user as second argument
        # Flask-RESTful passes self as first arg, so we need to preserve it
        logger.info(f"[TOKEN_CHECK] Calling {f.__name__} with self={args[0] if args else 'None'}, current_user={current_user}")
        logger.info(f"[TOKEN_CHECK] ========== TOKEN CHECK SUCCESS ==========")
        if args:
            # Preserve self (first arg) and add current_user as second arg
            return f(args[0], current_user, *args[1:], **kwargs)
        else:
            # No self (shouldn't happen with Resource methods, but handle it)
            return f(current_user, **kwargs)
    
    return decorated
class Login(CORSResource):
    """API endpoint for user authentication"""
    @rate_limit(max_requests=10, window=300)  # 10 login attempts per 5 minutes
    def post(self):
        """
        Authenticate user and return JWT token
        
        POST parameters:
        - username (str): Username
        - password (str): Password
        
        Returns:
            JSON response with JWT token
        """
        try:
            data = request.get_json() or {}
            username = sanitize_input(data.get('username', ''))
            password = data.get('password', '')
            
            # Validate input with security rules
            validation_rules = {
                'username': {
                    'type': str,
                    'required': True,
                    'min_len': 1,
                    'max_len': 50
                },
                'password': {
                    'type': str,
                    'required': True,
                    'min_len': 1,
                    'max_len': 128
                }
            }
            
            is_valid, errors = validate_input({'username': username, 'password': password}, validation_rules)
            if not is_valid:
                return {"status": "error", "message": "; ".join(errors)}, 400
            
            # Check MongoDB for user authentication
            if data_store.db is not None:
                user = data_store.db.users.find_one({"username": username})
                
                if user and bcrypt.checkpw(password.encode('utf-8'), user['password'].encode('utf-8')):
                    # Update last login time
                    data_store.db.users.update_one(
                        {"username": username},
                        {"$set": {"last_login": datetime.now(timezone.utc)}}
                    )
                    
                    # Generate JWT token
                    token_expiry = datetime.now(timezone.utc) + timedelta(seconds=JWT_ACCESS_TOKEN_EXPIRES)
                    token_payload = {
                        'username': username,
                        'exp': token_expiry
                    }
                    token = jwt.encode(token_payload, JWT_SECRET_KEY, algorithm="HS256")
                    
                    # IMPROVEMENT: Include user data in login response for better UX
                    # This eliminates the need for an additional API call
                    user_data = {
                        "username": user.get("username"),
                        "email": user.get("email"),
                        "full_name": user.get("full_name"),
                        "preferred_name": user.get("preferred_name"),
                        "birthday": user.get("birthday"),
                        "created_at": user.get("created_at").isoformat() if user.get("created_at") else None,
                        "last_login": user.get("last_login").isoformat() if user.get("last_login") else None,
                        "credits": user.get("credits", 0)
                    }
                    
                    # Create response WITH user data AND token for SPA compatibility
                    response_data = {
                        "status": "success",
                        "message": "Authentication successful",
                        "expires": token_expiry.isoformat(),
                        "user": user_data,  # Include user data for immediate use
                        "token": token  # Include token for SPA storage
                    }

                    logger.info(f"[LOGIN] Response data keys: {list(response_data.keys())}")
                    logger.info(f"[LOGIN] Token length: {len(token) if token else 0}")
                    logger.info(f"[LOGIN] Token preview: {token[:20] if token else 'None'}...")
                    logger.info(f"[LOGIN] Response data has token field: {'token' in response_data}")

                    # Manually create JSON response to ensure token is included
                    import json
                    response_json = json.dumps(response_data)
                    response = make_response(response_json)
                    response.headers['Content-Type'] = 'application/json'

                    logger.info(f"[LOGIN] Manual JSON response created")
                    logger.info(f"[LOGIN] Response content type: {response.headers.get('Content-Type')}")
                    logger.info(f"[LOGIN] Response data length: {len(response_json)}")
                    logger.info(f"[LOGIN] Response contains token: {'token' in response_json}")

                    # Set secure cookie with token
                    response.set_cookie(
                        'access_token',
                        token,
                        httponly=True,
                        secure=request.is_secure,  # True in production with HTTPS
                        samesite='Lax',  # Changed from 'Strict' to 'Lax' for better compatibility
                        max_age=JWT_ACCESS_TOKEN_EXPIRES
                    )

                    logger.info(f"[LOGIN] User {username} logged in successfully with user data included")
                    logger.info(f"[LOGIN] Cookie set - httponly=True, secure={request.is_secure}, samesite=Lax")
                    logger.info(f"[LOGIN] Response will include set-cookie header")
                    return response
                else:
                    return {"status": "error", "message": "Invalid credentials"}, 401
            else:
                # Fallback to environment variable check if database not available
                if username == os.getenv("ADMIN_USERNAME", "admin") and password == os.getenv("ADMIN_PASSWORD", "password"):
                    # Generate JWT token
                    token_expiry = datetime.now(timezone.utc) + timedelta(seconds=JWT_ACCESS_TOKEN_EXPIRES)
                    token_payload = {
                        'username': username,
                        'exp': token_expiry
                    }
                    token = jwt.encode(token_payload, JWT_SECRET_KEY, algorithm="HS256")
                    
                    # Create response WITHOUT token in body (security: token only in HTTP-only cookie)
                    response = make_response(jsonify({
                        "status": "success",
                        "message": "Authentication successful",
                        "expires": token_expiry.isoformat()
                    }))
                    
                    # Set secure cookie with token
                    response.set_cookie(
                        'access_token', 
                        token,
                        httponly=True,
                        secure=request.is_secure,  # True in production with HTTPS
                        samesite='Lax',  # Changed from 'Strict' to 'Lax'
                        max_age=JWT_ACCESS_TOKEN_EXPIRES
                    )
                    
                    return response
                else:
                    return {"status": "error", "message": "Invalid credentials"}, 401
        except Exception as e:
            error_msg = sanitize_error_message(e)
            logger.error(f"Login error: {str(e)}")
            return {"status": "error", "message": error_msg}, 500

class Logout(CORSResource):
    """API endpoint for user logout"""
    def post(self):
        """
        Logout user by clearing JWT cookie
        
        Returns:
            JSON response confirming logout
        """
        response = make_response(jsonify({
            "status": "success",
            "message": "Logout successful"
        }))
        
        # Clear the auth cookie with same attributes as when it was set
        response.set_cookie(
            'access_token',
            '',
            expires=0,
            httponly=True,
            secure=request.is_secure,
            samesite='Lax'
        )
        
        return response
class ScrapePosts(CORSResource):
    """API endpoint to trigger Reddit scraping"""
    @token_required
    def post(self, current_user):
        """
        Start a scraping job for Reddit posts
        
        POST parameters:
        - products (list): List of product names to scrape (optional)
        - limit (int): Maximum number of posts to scrape per product (optional)
        - subreddits (list): List of subreddits to search (optional)
        - time_filter (str): Time period to search ('day', 'week', 'month', 'year', 'all') (optional)
        - use_openai (bool): Whether to use Anthropic to analyze common pain points (optional)
        
        Returns:
            JSON response with status of the scraping job
        """
        print("\n" + "=" * 60)
        print("SCRAPE POST ENDPOINT CALLED")
        print("=" * 60)
        logger.info("ScrapePosts POST endpoint called")
        
        # CRITICAL FIX: Use atomic MongoDB operation to prevent race condition
        # This ensures only one scraping job can start at a time
        from pymongo import ReturnDocument
        if data_store.db is not None:
            result = data_store.db.metadata.find_one_and_update(
                {"_id": "scraper_metadata", "scrape_in_progress": False},
                {"$set": {"scrape_in_progress": True, "last_updated": datetime.now(timezone.utc)}},
                upsert=True,
                return_document=ReturnDocument.AFTER
            )
            if not result or result.get("scrape_in_progress") != True:
                print("ERROR: Scrape already in progress!")
                return {"status": "error", "message": "A scraping job is already in progress"}, 409
            data_store.scrape_in_progress = True
        else:
            # Fallback for no database (less safe)
            if data_store.scrape_in_progress:
                print("ERROR: Scrape already in progress!")
                return {"status": "error", "message": "A scraping job is already in progress"}, 409
            data_store.scrape_in_progress = True
        
        # Get parameters
        data = request.get_json() or {}
        print(f"Request data: {data}")
        products = data.get('products', scraper.target_products)
        
        # SECURITY FIX: Validate limit parameter to prevent DoS
        try:
            limit = int(data.get('limit', 100))
            if limit < 1 or limit > 1000:
                return {"status": "error", "message": "Limit must be between 1 and 1000"}, 400
        except (ValueError, TypeError):
            return {"status": "error", "message": "Invalid limit parameter"}, 400
        
        subreddits = data.get('subreddits')
        time_filter = data.get('time_filter', 'month')
        use_openai = data.get('use_openai', False)
        
        print(f"Parsed parameters:")
        print(f"  - products: {products}")
        print(f"  - limit: {limit}")
        print(f"  - subreddits: {subreddits}")
        print(f"  - time_filter: {time_filter}")
        print(f"  - use_openai: {use_openai}")
        logger.info(f"Scrape parameters - products: {products}, limit: {limit}, subreddits: {subreddits}, time_filter: {time_filter}, use_openai: {use_openai}")
        
        # Validate Reddit credentials
        if not REDDIT_CLIENT_ID or not REDDIT_CLIENT_SECRET:
            return {"status": "error", "message": "Reddit API credentials not configured on server"}, 500
            
        # Initialize Reddit client
        if not scraper.initialize_client(REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET):
            return {"status": "error", "message": "Failed to initialize Reddit client"}, 500
            
        # Initialize OpenAI client if needed
        if use_openai:
            if not ANTHROPIC_API_KEY:
                return {"status": "error", "message": "Anthropic API key not configured on server"}, 500
                
            if not anthropic_analyzer.initialize_client(ANTHROPIC_API_KEY):
                return {"status": "error", "message": "Failed to initialize Anthropic client"}, 500
        
        # Validate time filter
        if time_filter not in scraper.time_filters.keys():
            return {"status": "error", "message": f"Invalid time_filter. Must be one of: {', '.join(scraper.time_filters.keys())}"}, 400
        
        # CRITICAL FIX: Check and deduct credits BEFORE starting scrape
        username = current_user.get('username')
        scrape_cost = 2  # Cost in credits for scraping
        
        if data_store.db is not None:
            try:
                # Atomically check and deduct credits
                from pymongo import ReturnDocument
                user_result = data_store.db.users.find_one_and_update(
                    {"username": username, "credits": {"$gte": scrape_cost}},
                    {"$inc": {"credits": -scrape_cost}},
                    return_document=ReturnDocument.AFTER
                )
                
                if not user_result:
                    # Either user not found or insufficient credits
                    user = data_store.db.users.find_one({"username": username})
                    if not user:
                        # Rollback scrape_in_progress
                        data_store.db.metadata.update_one(
                            {"_id": "scraper_metadata"},
                            {"$set": {"scrape_in_progress": False}}
                        )
                        data_store.scrape_in_progress = False
                        return {"status": "error", "message": "User not found"}, 404
                    
                    # Insufficient credits
                    current_credits = user.get("credits", 0)
                    data_store.db.metadata.update_one(
                        {"_id": "scraper_metadata"},
                        {"$set": {"scrape_in_progress": False}}
                    )
                    data_store.scrape_in_progress = False
                    return {
                        "status": "error", 
                        "message": f"Insufficient credits. You have {current_credits} credits but need {scrape_cost}."
                    }, 402
                
                logger.info(f"Credits deducted: {scrape_cost}. User {username} has {user_result.get('credits', 0)} credits remaining")
            except Exception as e:
                logger.error(f"Error deducting credits: {str(e)}")
                # Rollback scrape_in_progress
                if data_store.db is not None:
                    data_store.db.metadata.update_one(
                        {"_id": "scraper_metadata"},
                        {"$set": {"scrape_in_progress": False}}
                    )
                data_store.scrape_in_progress = False
                return {"status": "error", "message": "Failed to process credit payment"}, 500
        
        # Update metadata in MongoDB -- need added
        data_store.update_metadata(
            scrape_in_progress=True,
            products=products,
            subreddits=subreddits if subreddits else scraper.default_subreddits,
            time_filter=time_filter
        )
        def background_scrape():
            try:
                # Scrape posts
                print("=" * 50)
                print("=== STARTING SCRAPE ===")
                print(f"Products: {products}")
                print(f"Subreddits: {subreddits}")
                print(f"Limit: {limit}")
                print(f"Time filter: {time_filter}")
                print(f"Use Anthropic: {use_openai}")
                print("=" * 50)
                logger.info(f"=== STARTING SCRAPE ===")
                logger.info(f"Products: {products}")
                logger.info(f"Subreddits: {subreddits}")
                logger.info(f"Limit: {limit}")
                logger.info(f"Time filter: {time_filter}")
                logger.info(f"Use OpenAI: {use_openai}")
                all_posts = []
                
                # Use the updated scraper method with filters
                print("Calling scraper.scrape_all_products...")
                logger.info(f"Calling scraper.scrape_all_products...")
                result = scraper.scrape_all_products(
                    limit=limit,
                    subreddits=subreddits,
                    time_filter=time_filter,
                    products=products
                )
                print(f"Scraper returned {len(result)} product groups")
                logger.info(f"Scraper returned {len(result)} product groups")
                
                # Flatten the results
                for product_name, product_posts in result.items():
                    print(f"Product '{product_name}': {len(product_posts)} posts")
                    logger.info(f"Product '{product_name}': {len(product_posts)} posts")
                    all_posts.extend(product_posts)
                
                print(f"Total posts scraped: {len(all_posts)}")
                logger.info(f"Total posts scraped: {len(all_posts)}")
                
                if len(all_posts) == 0:
                    print("WARNING: No posts were scraped!")
                    logger.warning("No posts were scraped!")
                
                # USER REQUEST: Filter posts to only analyze those with explicit pain points, dislikes, or improvement ideas
                def has_pain_point_indicators(post):
                    """Check if post explicitly mentions pain points, dislikes, or improvements"""
                    text = f"{getattr(post, 'title', '')} {getattr(post, 'content', '')}".lower()
                    
                    # Pain point indicators
                    pain_indicators = [
                        'problem', 'issue', 'bug', 'broken', "doesn't work", 'not working',
                        'error', 'crash', 'frustrating', 'annoying', 'difficult', 'hard to',
                        "can't", 'cannot', 'impossible', 'hate', 'bad', 'terrible', 'horrible',
                        'slow', 'laggy', 'unusable', 'unstable', 'inconsistent', 'disappointed',
                        'disappointing', 'sucks', 'worst', 'awful', 'poor', 'weak', 'fails'
                    ]
                    
                    # Improvement/feature request indicators
                    improvement_indicators = [
                        'wish', 'should', 'would be nice', 'feature request', 'improvement',
                        'improve', 'better', 'add', 'need', 'want', 'suggest', 'recommend',
                        'hope', 'please add', 'missing', 'lack', 'could be', 'should have'
                    ]
                    
                    # Dislike indicators
                    dislike_indicators = [
                        'dislike', "don't like", 'hate', 'disappointed', 'frustrated',
                        'annoyed', 'upset', 'angry', 'complaint', 'complain'
                    ]
                    
                    all_indicators = pain_indicators + improvement_indicators + dislike_indicators
                    
                    # Check if any indicator is in the text
                    return any(indicator in text for indicator in all_indicators)
                
                # Filter posts before analysis
                posts_with_indicators = [post for post in all_posts if has_pain_point_indicators(post)]
                posts_without_indicators = [post for post in all_posts if not has_pain_point_indicators(post)]
                
                print(f"Filtered posts: {len(posts_with_indicators)} with pain points/improvements, {len(posts_without_indicators)} without")
                logger.info(f"Post filtering: {len(posts_with_indicators)} posts with explicit pain points/dislikes/improvements, {len(posts_without_indicators)} filtered out")
                
                # Only analyze posts with indicators
                if len(posts_with_indicators) == 0:
                    print("WARNING: No posts found with explicit pain points, dislikes, or improvement ideas!")
                    logger.warning("No posts with pain point indicators found - all posts filtered out")
                
                # Use advanced NLP analyzer ONLY on filtered posts
                print(f"Running advanced NLP analysis on {len(posts_with_indicators)} filtered posts")
                logger.info(f"Running advanced NLP analysis on {len(posts_with_indicators)} filtered posts (with pain points/dislikes/improvements)")
                nlp_results = advanced_analyzer.analyze_batch(posts_with_indicators) if posts_with_indicators else {'total_words': 0, 'avg_sentiment': 0, 'pain_points': []}
                print(f"NLP Analysis complete: {nlp_results['total_words']} words, Avg sentiment: {nlp_results['avg_sentiment']:.3f}")
                print(f"NLP pain points found: {len(nlp_results.get('pain_points', []))}")
                logger.info(f"NLP Analysis complete: {nlp_results['total_words']} words, "
                          f"Avg sentiment: {nlp_results['avg_sentiment']:.3f}")
                logger.info(f"NLP pain points found: {len(nlp_results.get('pain_points', []))}")
                
                # Also run legacy analyzer for product detection and categorization (on filtered posts only)
                print(f"Running legacy analyzer.analyze_posts on filtered posts...")
                logger.info(f"Running legacy analyzer.analyze_posts on {len(posts_with_indicators)} filtered posts...")
                if posts_with_indicators:
                    analyzer.analyze_posts(posts_with_indicators, products)
                print(f"Legacy analyzer complete")
                logger.info(f"Legacy analyzer complete")
                
                # Save all posts to MongoDB, but mark which ones have pain points
                posts_saved = 0
                print(f"Saving {len(all_posts)} posts to MongoDB (marked with has_pain_points flag)...")
                for post in all_posts:
                    # Get detected products
                    detected_products = analyzer.get_product_from_post(post, products)
                    # Set products for this post
                    post.products = detected_products
                    
                    # Mark if post has pain point indicators
                    post.has_pain_points = has_pain_point_indicators(post)
                    
                    logger.debug(f"Post '{post.title[:50]}...' -> products: {detected_products}, has_pain_points: {post.has_pain_points}, sentiment: {getattr(post, 'sentiment', 'N/A')}")
                    # Save to MongoDB with advanced NLP results
                    if data_store.save_post(post):
                        posts_saved += 1
                        # Only add to analyzed_posts if it has pain points
                        if post.has_pain_points:
                            data_store.analyzed_posts.append(post)
                    # Get detected products
                    detected_products = analyzer.get_product_from_post(post, products)
                    # Set products for this post
                    post.products = detected_products
                    logger.debug(f"Post '{post.title[:50]}...' -> products: {detected_products}, sentiment: {getattr(post, 'sentiment', 'N/A')}")
                    # Save to MongoDB with advanced NLP results
                    if data_store.save_post(post):
                        posts_saved += 1
                        # Add to analyzed_posts list
                        data_store.analyzed_posts.append(post)
                
                print(f"Saved {posts_saved}/{len(all_posts)} posts to MongoDB")
                print(f"Analyzed posts count: {len(data_store.analyzed_posts)}")
                logger.info(f"Saved {posts_saved}/{len(all_posts)} posts to MongoDB")
                logger.info(f"Analyzed posts count: {len(data_store.analyzed_posts)}")
                
                # Use advanced analyzer pain points if available, otherwise fallback
                logger.info(f"Processing pain points...")
                if nlp_results.get('pain_points'):
                    logger.info(f"Using advanced analyzer pain points: {len(nlp_results['pain_points'])} found")
                    # Convert advanced analyzer pain points to PainPoint objects
                    pain_points = {}
                    for pp in nlp_results['pain_points']:
                        from models import PainPoint
                        key = f"{pp['category']}:{pp['indicator']}"
                        pain_point_obj = PainPoint(
                            name=pp['indicator'],
                            description=f"{pp['category']} issue: {pp['indicator']}",
                            frequency=pp['frequency'],
                            avg_sentiment=pp['avg_sentiment'],
                            product=products[0] if products else None
                        )
                        pain_point_obj.severity = pp['severity_score']
                        pain_points[key] = pain_point_obj
                    logger.info(f"Converted {len(pain_points)} pain points to PainPoint objects")
                else:
                    logger.info("No advanced analyzer pain points, using legacy analyzer")
                    # Fallback to legacy analyzer
                    pain_points = analyzer.categorize_pain_points(all_posts, products)
                    logger.info(f"Legacy analyzer returned {len(pain_points)} pain points")
                
                pain_points_saved = 0
                for key, pain_point in pain_points.items():
                    # Check if it's already a list or a single object
                    if isinstance(pain_point, list):
                        # If it's a list, iterate through it
                        for pp in pain_point:
                            if data_store.save_pain_point(pp):
                                pain_points_saved += 1
                    else:
                        # If it's a single object, save it directly
                        if data_store.save_pain_point(pain_point):
                            pain_points_saved += 1
                
                logger.info(f"Saved {pain_points_saved} pain points to MongoDB")
                logger.info(f"Total pain points in store: {len(data_store.pain_points)}")
                
                # Note: Anthropic analysis is now manual - users can trigger it from the product detail page
                print("Scrape complete. Posts saved. Analysis can be run manually from the product detail page.")
                logger.info("Scrape complete. Posts saved. Analysis can be run manually from the product detail page.")
                
                # Update metadata to indicate scrape is finished
                print("Updating metadata: scrape_in_progress=False")
                logger.info("Updating metadata: scrape_in_progress=False")
                data_store.update_metadata(scrape_in_progress=False)
                
                print("=" * 50)
                print("=== SCRAPE COMPLETE ===")
                print(f"Total posts: {len(all_posts)}")
                print(f"Raw posts in store: {len(data_store.raw_posts)}")
                print(f"Analyzed posts in store: {len(data_store.analyzed_posts)}")
                print(f"Pain points in store: {len(data_store.pain_points)}")
                print(f"Anthropic analyses in store: {len(data_store.anthropic_analyses)}")
                print("=" * 50)
                logger.info(f"=== SCRAPE COMPLETE ===")
                logger.info(f"Total posts: {len(all_posts)}")
                logger.info(f"Raw posts in store: {len(data_store.raw_posts)}")
                logger.info(f"Analyzed posts in store: {len(data_store.analyzed_posts)}")
                logger.info(f"Pain points in store: {len(data_store.pain_points)}")
                logger.info(f"Anthropic analyses in store: {len(data_store.anthropic_analyses)}")
            except praw.exceptions.RedditAPIException as e:
                print("=" * 50)
                print("=== REDDIT API ERROR IN BACKGROUND SCRAPING ===")
                print(f"Error: {str(e)}")
                print("=" * 50)
                logger.error(f"Reddit API error in background scraping: {str(e)}", exc_info=True)
                # Update status and refund credits
                data_store.update_metadata(scrape_in_progress=False)
                # Refund credits to user
                if data_store.db is not None:
                    try:
                        data_store.db.users.update_one(
                            {"username": username},
                            {"$inc": {"credits": scrape_cost}}
                        )
                        logger.info(f"Refunded {scrape_cost} credits to {username} due to Reddit API error")
                    except Exception as refund_error:
                        logger.error(f"Failed to refund credits: {str(refund_error)}")
            except praw.exceptions.RedditAPIException as e:
                # CRITICAL FIX: Specific handling for Reddit API errors
                error_type = "Reddit API Error"
                logger.error(f"=== {error_type} IN BACKGROUND SCRAPING ===")
                logger.error(f"Error: {str(e)}", exc_info=True)
                
                # Categorize error for appropriate handling
                if "rate limit" in str(e).lower() or "429" in str(e):
                    error_category = "rate_limit"
                    user_message = "Reddit API rate limit exceeded. Please try again later."
                elif "403" in str(e) or "forbidden" in str(e).lower():
                    error_category = "authentication"
                    user_message = "Reddit API authentication failed. Please check credentials."
                else:
                    error_category = "api_error"
                    user_message = "Reddit API error occurred. Please try again later."
                
                # Update status and refund credits
                data_store.update_metadata(scrape_in_progress=False)
                
                # Refund credits to user
                if data_store.db is not None:
                    try:
                        result = data_store.db.users.update_one(
                            {"username": username},
                            {"$inc": {"credits": scrape_cost}}
                        )
                        if result.modified_count > 0:
                            logger.info(f"Refunded {scrape_cost} credits to {username} due to {error_category}")
                        else:
                            logger.warning(f"Failed to refund credits: user {username} not found")
                    except Exception as refund_error:
                        logger.error(f"Failed to refund credits: {str(refund_error)}", exc_info=True)
                
                # TODO: Send notification to user about failure
                
            except praw.exceptions.RequestException as e:
                # CRITICAL FIX: Network/connection errors
                error_type = "Network Error"
                logger.error(f"=== {error_type} IN BACKGROUND SCRAPING ===")
                logger.error(f"Error: {str(e)}", exc_info=True)
                
                # Network errors are often transient - could retry
                error_category = "network_error"
                user_message = "Network error occurred. Please check your connection and try again."
                
                # Update status and refund credits
                data_store.update_metadata(scrape_in_progress=False)
                
                # Refund credits
                if data_store.db is not None:
                    try:
                        data_store.db.users.update_one(
                            {"username": username},
                            {"$inc": {"credits": scrape_cost}}
                        )
                        logger.info(f"Refunded {scrape_cost} credits to {username} due to {error_category}")
                    except Exception as refund_error:
                        logger.error(f"Failed to refund credits: {str(refund_error)}", exc_info=True)
                
            except Exception as e:
                # CRITICAL FIX: Generic error handling with proper categorization
                error_type = type(e).__name__
                logger.error(f"=== UNEXPECTED ERROR IN BACKGROUND SCRAPING ===")
                logger.error(f"Error Type: {error_type}")
                logger.error(f"Error: {str(e)}", exc_info=True)
                
                # Categorize error
                if isinstance(e, (ValueError, TypeError, AttributeError)):
                    error_category = "validation_error"
                    user_message = "Invalid input or configuration error."
                elif isinstance(e, (ConnectionError, TimeoutError)):
                    error_category = "connection_error"
                    user_message = "Connection error occurred. Please try again."
                else:
                    error_category = "unexpected_error"
                    user_message = "An unexpected error occurred. Please contact support."
                
                # Update status and refund credits
                data_store.update_metadata(scrape_in_progress=False)
                
                # Refund credits to user
                if data_store.db is not None:
                    try:
                        result = data_store.db.users.update_one(
                            {"username": username},
                            {"$inc": {"credits": scrape_cost}}
                        )
                        if result.modified_count > 0:
                            logger.info(f"Refunded {scrape_cost} credits to {username} due to {error_category}")
                        else:
                            logger.warning(f"Failed to refund credits: user {username} not found")
                    except Exception as refund_error:
                        logger.error(f"Failed to refund credits: {str(refund_error)}", exc_info=True)
                
                # Log error details for debugging (but don't expose to user)
                logger.error(f"Error details - Type: {error_type}, Category: {error_category}, User: {username}")
        
        # Start the background thread
        print(f"Starting background scrape thread...")
        logger.info("Starting background scrape thread...")
        scrape_thread = Thread(target=background_scrape)
        scrape_thread.daemon = True
        scrape_thread.start()
        print(f"Background thread started (daemon={scrape_thread.daemon})")
        logger.info(f"Background thread started")
        
        return {
            "status": "success", 
            "message": "Scraping job started", 
            "products": products, 
            "limit": limit,
            "subreddits": subreddits if subreddits else scraper.default_subreddits,
            "time_filter": time_filter,
            "use_openai": use_openai
        }
class Recommendations(CORSResource):
    """API endpoint to handle recommendations (get and generate)"""
    @token_required
    def get(self, current_user):
        """
        Get previously saved recommendations from the database
        
        GET parameters:
        - products[] (list): List of product names to get recommendations for
        
        Returns:
            JSON response with saved recommendations
        """
        # Get query parameters
        products_param = request.args.getlist('products[]')
        logger.info(f"Requested saved recommendations for products: {products_param}")
        
        # Initialize empty results
        all_recommendations = []
        
        # If database is connected, try to get recommendations from MongoDB
        if data_store.db is not None:
            try:
                # Get recommendations for requested products or all products if none specified
                query = {}
                if products_param:
                    # Create case-insensitive queries for product names
                    product_queries = []
                    for product in products_param:
                        if product.strip():
                            product_queries.append({
                                "_id": {"$regex": f"^{re.escape(product.strip())}$", "$options": "i"}
                            })
                    
                    if product_queries:
                        query = {"$or": product_queries}
                
                logger.info(f"MongoDB query for recommendations: {query}")
                recommendations_cursor = data_store.db.recommendations.find(query)
                
                # Process each recommendation
                for rec_doc in recommendations_cursor:
                    recommendations = rec_doc.get('recommendations', {})
                    if recommendations:
                        all_recommendations.append(recommendations)
                    else:
                        logger.warning(f"No recommendations found for product: {rec_doc.get('_id')}")
                
                if all_recommendations:
                    return {
                        "status": "success",
                        "recommendations": all_recommendations
                    }
                else:
                    return {
                        "status": "info",
                        "message": "No saved recommendations found for the requested products",
                        "recommendations": []
                    }
                
            except Exception as e:
                logger.error(f"Error retrieving recommendations from MongoDB: {str(e)}")
                return {
                    "status": "error",
                    "message": f"Error retrieving recommendations: {str(e)}",
                    "recommendations": []
                }, 500
        
        # If database is not connected
        return {
            "status": "error",
            "message": "Database connection not established or no recommendations found",
            "recommendations": []
        }, 500
    
    @token_required
    def post(self, current_user):
        """
        Generate and save new recommendations based on analyses
        
        POST parameters (JSON):
        - products (list): List of product names to generate recommendations for
        
        Returns:
            JSON response with generated recommendations
        """
        # Get request data
        request_data = request.get_json() or {}
        products_param = request_data.get('products', [])
        logger.info(f"Requested to generate recommendations for products: {products_param}")
        
        # Ensure OpenAI is initialized
        if not ANTHROPIC_API_KEY:
            return {
                "status": "error",
                "message": "Anthropic API key not configured on server",
                "anthropic_enabled": False
            }, 500

        if not anthropic_analyzer.api_key:
            if not anthropic_analyzer.initialize_client(ANTHROPIC_API_KEY):
                return {
                    "status": "error",
                    "message": "Failed to initialize Anthropic client",
                    "anthropic_enabled": False
                }, 500
        
        # Store recommendations for each product
        all_recommendations = []
        
        # If database is connected, try to get analyses from MongoDB first
        if data_store.db is not None:
            try:
                # Get analyses for requested products or all products if none specified
                query = {}
                if products_param:
                    # Create case-insensitive queries for product names
                    product_queries = []
                    for product in products_param:
                        if isinstance(product, str) and product.strip():
                            product_queries.append({
                                "_id": {"$regex": f"^{re.escape(product.strip())}$", "$options": "i"}
                            })
                    
                    if product_queries:
                        query = {"$or": product_queries}
                
                logger.info(f"MongoDB query for analyses: {query}")
                analyses_cursor = data_store.db.anthropic_analysis.find(query)
                
                # Process each analysis
                for analysis_doc in analyses_cursor:
                    product_name = analysis_doc.get('_id')
                    analysis = analysis_doc.get('analysis', {})
                    
                    if not analysis:
                        logger.warning(f"No analysis data found for {product_name}")
                        continue
                    
                    # Extract pain points from the analysis
                    pain_points = analysis.get('common_pain_points', [])
                    
                    if not pain_points:
                        logger.warning(f"No pain points found in analysis for {product_name}")
                        continue
                    
                    logger.info(f"Generating recommendations for {product_name} based on {len(pain_points)} pain points")
                    
                    # Generate recommendations for this product's pain points
                    recommendations = anthropic_analyzer.generate_recommendations(pain_points, product_name)
                    
                    # Save the recommendations to MongoDB
                    save_result = data_store.save_recommendations(product_name, recommendations)
                    if save_result:
                        logger.info(f"Saved recommendations for {product_name} to MongoDB")
                    else:
                        logger.warning(f"Failed to save recommendations for {product_name}")
                    
                    all_recommendations.append(recommendations)
                
                # Return the recommendations
                return {
                    "status": "success",
                    "anthropic_enabled": True,
                    "recommendations": all_recommendations
                }
                
            except Exception as e:
                logger.error(f"Error retrieving analyses from MongoDB: {str(e)}")
                # Fall back to in-memory data if MongoDB query fails
        
        # Fall back to in-memory data if database is not connected or query failed
        # Get all analyses from in-memory cache
        if not data_store.anthropic_analyses:
            return {
                "status": "info",
                "message": "No Anthropic analyses available. Use the scrape endpoint with use_openai=true to generate analysis.",
                "anthropic_enabled": True,
                "recommendations": []
            }, 400
        
        # Process requested products or all products if none specified
        product_keys = list(data_store.anthropic_analyses.keys())
        if products_param:
            # Filter to only requested products (case-insensitive)
            requested_products = [p.strip().lower() for p in products_param if isinstance(p, str) and p.strip()]
            product_keys = [
                key for key in product_keys 
                if any(key.lower() == req_prod for req_prod in requested_products)
            ]
        
        # Generate recommendations for each product
        for product_key in product_keys:
            analysis = data_store.anthropic_analyses[product_key]
            pain_points = analysis.get('common_pain_points', [])
            
            if pain_points:
                # Generate recommendations for this product's pain points
                recommendations = anthropic_analyzer.generate_recommendations(pain_points, product_key)
                all_recommendations.append(recommendations)
        
        return {
            "status": "success",
            "anthropic_enabled": True,
            "recommendations": all_recommendations
        }
    
class GetPainPoints(CORSResource):
    """API endpoint to get analyzed pain points"""
    @token_required
    def get(self, current_user):
        """
        Get all identified pain points
        
        GET parameters:
        - product (str): Filter by product name (optional)
        - limit (int): Limit number of results (optional)
        - min_severity (float): Minimum severity score (optional)
        
        Returns:
            JSON response with pain points data
        """
        # Get parameters
        product = request.args.get('product')
        limit = request.args.get('limit', type=int)
        min_severity = request.args.get('min_severity', type=float, default=0)
        
        # Get all pain points
        pain_points = list(data_store.pain_points.values())
        
        # Apply filters
        if product:
            pain_points = [p for p in pain_points if p.product and p.product.lower() == product.lower()]
        
        if min_severity > 0:
            pain_points = [p for p in pain_points if p.severity >= min_severity]
        
        # Sort by severity
        pain_points.sort(key=lambda x: x.severity, reverse=True)
        
        # Apply limit
        if limit and limit > 0:
            pain_points = pain_points[:limit]
        
        # Convert to dictionaries
        result = [p.to_dict() for p in pain_points]
        
        return {
            "status": "success",
            "count": len(result),
            "pain_points": result,
            "last_updated": data_store.last_scrape_time.isoformat() if data_store.last_scrape_time else None
        }
class GetPosts(CORSResource):
    """API endpoint to get scraped posts"""
    @token_required
    def get(self, current_user):
        """
        Get all scraped posts
        
        GET parameters:
        - product (str): Filter by product name (optional)
        - limit (int): Limit number of results (optional)
        - has_pain_points (bool): Only return posts with identified pain points (optional)
        - subreddit (str): Filter by subreddit name (optional)
        - min_score (int): Minimum score threshold (optional)
        - min_comments (int): Minimum comments threshold (optional)
        - sort_by (str): Field to sort by ('date', 'score', 'comments', 'sentiment') (optional, default: 'date')
        - sort_order (str): Sort order ('asc' or 'desc') (optional, default: 'desc')
        
        Returns:
            JSON response with posts data
        """
        # Get parameters
        product = request.args.get('product')
        limit = request.args.get('limit', type=int)
        has_pain_points = request.args.get('has_pain_points', type=bool, default=False)
        subreddit = request.args.get('subreddit')
        min_score = request.args.get('min_score', type=int, default=0)
        min_comments = request.args.get('min_comments', type=int, default=0)
        sort_by = request.args.get('sort_by', default='date')
        sort_order = request.args.get('sort_order', default='desc')
        
        # Validate sort parameters
        valid_sort_fields = {'date': 'created_utc', 'score': 'score', 'comments': 'num_comments', 'sentiment': 'sentiment'}
        if sort_by not in valid_sort_fields:
            return {"status": "error", "message": f"Invalid sort_by parameter. Must be one of: {', '.join(valid_sort_fields.keys())}"}, 400
        
        if sort_order not in ['asc', 'desc']:
            return {"status": "error", "message": "Invalid sort_order parameter. Must be 'asc' or 'desc'"}, 400
        
        # Check if MongoDB is connected
        if data_store.db is None:
            logger.error("MongoDB not connected, using in-memory data")
            # Fallback to in-memory data
            posts = data_store.analyzed_posts if data_store.analyzed_posts else data_store.raw_posts
        else:
            try:
                # Build MongoDB query
                query = {}
                
                if product:
                    query["products"] = product
                
                if has_pain_points:
                    query["pain_points"] = {"$exists": True, "$ne": []}
                    
                if subreddit:
                    # SECURITY FIX: Validate and escape subreddit name to prevent NoSQL injection
                    if not re.match(r'^[a-zA-Z0-9_-]+$', subreddit):
                        return {"status": "error", "message": "Invalid subreddit name format"}, 400
                    query["subreddit"] = {"$regex": f"^{re.escape(subreddit)}$", "$options": "i"}
                    
                if min_score > 0:
                    query["score"] = {"$gte": min_score}
                    
                if min_comments > 0:
                    query["num_comments"] = {"$gte": min_comments}
                
                # Set up sorting
                mongo_sort_field = valid_sort_fields[sort_by]
                mongo_sort_direction = -1 if sort_order == 'desc' else 1
                
                # Query MongoDB
                cursor = data_store.db.posts.find(query).sort(mongo_sort_field, mongo_sort_direction)
                
                # Apply limit if specified
                if limit and limit > 0:
                    cursor = cursor.limit(limit)
                
                # Convert cursor to list
                posts = list(cursor)
                logger.info(f"Retrieved {len(posts)} posts from MongoDB")
                
            except Exception as e:
                logger.error(f"Error querying MongoDB: {str(e)}")
                # Fallback to in-memory data
                posts = data_store.analyzed_posts if data_store.analyzed_posts else data_store.raw_posts
                
                # Apply filters
                if product:
                    # Filter posts that mention the specified product
                    posts = [p for p in posts if hasattr(p, 'products') and product in p.products]
                
                if has_pain_points:
                    posts = [p for p in posts if hasattr(p, 'pain_points') and p.pain_points]
                    
                if subreddit:
                    posts = [p for p in posts if hasattr(p, 'subreddit') and p.subreddit.lower() == subreddit.lower()]
                    
                if min_score > 0:
                    posts = [p for p in posts if hasattr(p, 'score') and p.score >= min_score]
                    
                if min_comments > 0:
                    posts = [p for p in posts if hasattr(p, 'num_comments') and p.num_comments >= min_comments]
                
                # Sort by specified field
                sort_field = valid_sort_fields[sort_by]
                
                # For sentiment sorting, handle posts that don't have sentiment
                if sort_field == 'sentiment':
                    # Default sentiment to 0 if not available
                    posts.sort(key=lambda x: getattr(x, sort_field, 0) or 0, reverse=(sort_order == 'desc'))
                else:
                    posts.sort(key=lambda x: getattr(x, sort_field, 0), reverse=(sort_order == 'desc'))
                
                # Apply limit
                if limit and limit > 0:
                    posts = posts[:limit]
        
        # Convert to dictionaries for response
        result = []
        for post in posts:
            # Handle both MongoDB documents and custom objects
            if isinstance(post, dict):
                post_dict = {
                    "id": post.get("_id") or post.get("id"),
                    "title": post.get("title"),
                    "author": post.get("author"),
                    "subreddit": post.get("subreddit"),
                    "url": post.get("url"),
                    "created_utc": post.get("created_utc"),
                    "score": post.get("score"),
                    "num_comments": post.get("num_comments"),
                    "sentiment": post.get("sentiment"),
                    "topics": post.get("topics", []),
                    "pain_points": post.get("pain_points", []),
                    "products": post.get("products", [])
                }
            else:
                # Handle custom objects
                post_dict = {
                    "id": getattr(post, "id", None),
                    "title": getattr(post, "title", None),
                    "author": getattr(post, "author", None),
                    "subreddit": getattr(post, "subreddit", None),
                    "url": getattr(post, "url", None),
                    "created_utc": getattr(post, "created_utc", None),
                    "score": getattr(post, "score", None),
                    "num_comments": getattr(post, "num_comments", None),
                }
                
                # Add analysis results if available
                if hasattr(post, 'sentiment') and post.sentiment is not None:
                    post_dict["sentiment"] = post.sentiment
                
                if hasattr(post, 'topics') and post.topics:
                    post_dict["topics"] = post.topics
                    
                if hasattr(post, 'pain_points') and post.pain_points:
                    post_dict["pain_points"] = post.pain_points
                
                if hasattr(post, 'products') and post.products:
                    post_dict["products"] = post.products
            
            # Convert datetime objects to ISO format strings
            if isinstance(post_dict["created_utc"], datetime):
                post_dict["created_utc"] = post_dict["created_utc"].isoformat()
                
            result.append(post_dict)
        
        # Get last_updated timestamp
        last_updated = None
        if data_store.last_scrape_time:
            last_updated = data_store.last_scrape_time.isoformat() if isinstance(data_store.last_scrape_time, datetime) else data_store.last_scrape_time
        
        return {
            "status": "success",
            "count": len(result),
            "posts": result,
            "filters_applied": {
                "product": product,
                "has_pain_points": has_pain_points,
                "subreddit": subreddit,
                "min_score": min_score,
                "min_comments": min_comments
            },
            "sort": {
                "field": sort_by,
                "order": sort_order
            },
            "last_updated": last_updated,
            "data_source": "mongodb" if data_store.db is not None else "memory"
        }
class GetStatus(CORSResource):
    """API endpoint to get current scraper status"""
    def get(self):
        """
        Get current status of the scraper
        
        Returns:
            JSON response with status information
        """
        # Get connection status from initialized clients
        reddit_status = "connected" if scraper.reddit else "not_configured"
        anthropic_status = "connected" if anthropic_analyzer.api_key else "not_configured"
        
        # Get counts from MongoDB if available, otherwise use in-memory cache
        raw_posts_count = len(data_store.raw_posts)
        analyzed_posts_count = len(data_store.analyzed_posts)
        pain_points_count = len(data_store.pain_points)
        anthropic_analyses_count = len(data_store.anthropic_analyses)
        
        if data_store.db is not None:
            try:
                # Get counts from MongoDB
                raw_posts_count = data_store.db.posts.count_documents({})
                # Analyzed posts are posts that have sentiment analysis
                analyzed_posts_count = data_store.db.posts.count_documents({"sentiment": {"$exists": True}})
                pain_points_count = data_store.db.pain_points.count_documents({})
                anthropic_analyses_count = data_store.db.anthropic_analysis.count_documents({})
                
                logger.debug(f"Status counts from MongoDB - Posts: {raw_posts_count}, Analyzed: {analyzed_posts_count}, Pain Points: {pain_points_count}, OpenAI: {anthropic_analyses_count}")
            except Exception as e:
                logger.error(f"Error counting from MongoDB: {str(e)}")
                # Fallback to in-memory cache
                logger.debug(f"Using in-memory counts - Posts: {raw_posts_count}, Analyzed: {analyzed_posts_count}, Pain Points: {pain_points_count}, OpenAI: {anthropic_analyses_count}")
                
        return {
            "status": "success",
            "scrape_in_progress": data_store.scrape_in_progress,
            "last_scrape_time": data_store.last_scrape_time.isoformat() if data_store.last_scrape_time else None,
            "raw_posts_count": raw_posts_count,
            "analyzed_posts_count": analyzed_posts_count,
            "pain_points_count": pain_points_count,
            "subreddits_scraped": list(data_store.subreddits_scraped),
            "has_anthropic_analyses": anthropic_analyses_count > 0,
            "anthropic_analyses_count": anthropic_analyses_count,
            "apis": {
                "reddit": reddit_status,
                "anthropic": anthropic_status
            }
        }
    
class ResetScrapeStatus(CORSResource):
    """API endpoint to reset scraper status"""
    @token_required
    def post(self, current_user):
        """Reset the scrape_in_progress flag"""
        data_store.scrape_in_progress = False
        data_store.update_metadata(scrape_in_progress=False)
        return {
            "status": "success",
            "message": "Scrape status reset successfully"
        }

class GetAnthropicAnalysis(CORSResource):
    """API endpoint to get Anthropic analysis results"""
    @token_required
    def get(self, current_user):
        """
        Get the Anthropic analysis of pain points

        GET parameters:
        - product (str): Single product name (optional, for backward compatibility)
        - products (str): Comma-separated list of product names (optional)

        Returns:
            JSON response with Anthropic analysis data
        """
        # Get query parameters
        products_param = request.args.getlist('products[]')
        logger.info(f"Requested products: {products_param}")
        
        # Check if MongoDB is connected
        if data_store.db is None:
            # Fallback to in-memory data
            if not data_store.anthropic_analyses:
                return {
                    "status": "info",
                    "message": "No Anthropic analyses available. Use the scrape endpoint with use_openai=true to generate analysis.",
                    "anthropic_enabled": True,
                    "analyses": []
                }
    
        # Using MongoDB for data retrieval
        try:
            # Parse multiple products from MongoDB
            if len(products_param) > 0:
                requested_products = [p.strip().lower() for p in products_param if p.strip()]
                matched_analyses = []
                
                # Use MongoDB's $in operator to find matching products in one query
                query = {"product": {"$in": requested_products}}
                cursor = data_store.db.anthropic_analysis.find(query)
                
                for doc in cursor:
                    # Transform to the expected response format
                    if "analysis" in doc:
                        matched_analyses.append(doc["analysis"])
                    else:
                        matched_analyses.append(doc)  # Include the entire document if no analysis field
                
                return {
                    "status": "success",
                    "anthropic_enabled": True,
                    "analyses": matched_analyses
                }
            
            # Return all analyses from MongoDB if no filters are applied
            all_analyses = []
            cursor = data_store.db.anthropic_analysis.find({})
            
            for doc in cursor:
                if "analysis" in doc:
                    all_analyses.append(doc["analysis"])
                else:
                    all_analyses.append(doc)
            
            return {
                "status": "success",
                "anthropic_enabled": True,
                "analyses": all_analyses
            }
            
        except Exception as e:
            logger.error(f"Error retrieving Anthropic analyses from MongoDB: {str(e)}")

            # Fallback to in-memory data if MongoDB query fails
            return {
                "status": "error",
                "message": f"Database error: {str(e)}",
                "anthropic_enabled": True,
                "analyses": list(data_store.anthropic_analyses.values())
            }

class GetAllProducts(CORSResource):
    """API endpoint to get list of all products that have posts (whether analyzed or not)"""
    @token_required
    def get(self, current_user):
        """
        Get list of all products that have posts in the database
        
        Returns:
            JSON response with list of product names and their analysis status
        """
        try:
            if data_store.db is None:
                # Fallback to in-memory data
                products = []
                for post in data_store.raw_posts:
                    if hasattr(post, 'products') and post.products:
                        products.extend(post.products)
                products = list(set(products))
            else:
                # Get all unique products from posts collection
                products_with_posts = data_store.db.posts.distinct("products")
                # Flatten the list (products is an array field)
                products = []
                seen_products = set()
                for product_list in products_with_posts:
                    if isinstance(product_list, list):
                        for product in product_list:
                            if product and product.strip().lower() not in seen_products:
                                products.append(product.strip())
                                seen_products.add(product.strip().lower())
                    elif product_list and product_list.strip().lower() not in seen_products:
                        products.append(product_list.strip())
                        seen_products.add(product_list.strip().lower())
            
            # Get analysis status for each product
            products_with_status = []
            for product in products:
                has_analysis = False
                has_recommendations = False
                
                if data_store.db is not None:
                    # Check if analysis exists
                    analysis_doc = data_store.db.anthropic_analysis.find_one({
                        "$or": [
                            {"_id": product.strip().lower()},
                            {"product": product.strip().lower()}
                        ]
                    })
                    has_analysis = analysis_doc is not None
                    
                    # Check if recommendations exist
                    rec_doc = data_store.db.recommendations.find_one({
                        "$or": [
                            {"_id": product.strip().lower()},
                            {"product": product.strip().lower()}
                        ]
                    })
                    has_recommendations = rec_doc is not None
                else:
                    # Fallback to in-memory
                    has_analysis = product in data_store.anthropic_analyses
                    has_recommendations = product in data_store.recommendations if hasattr(data_store, 'recommendations') else False
                
                products_with_status.append({
                    "name": product,
                    "has_analysis": has_analysis,
                    "has_recommendations": has_recommendations
                })
            
            return {
                "status": "success",
                "products": products_with_status
            }
        except Exception as e:
            logger.error(f"Error retrieving all products: {str(e)}")
            return {
                "status": "error",
                "message": f"Database error: {str(e)}",
                "products": []
            }, 500

class RunAnalysis(CORSResource):
    """API endpoint to manually run Anthropic analysis for a product"""
    @token_required
    def post(self, current_user):
        """
        Run Anthropic analysis for a specific product
        
        POST parameters:
        - product (str): Product name to analyze
        
        Returns:
            JSON response with analysis results
        """
        try:
            data = request.get_json() or {}
            product = data.get('product', '').strip()
            
            if not product:
                return {"status": "error", "message": "Product name is required"}, 400
            
            # SECURITY FIX: Validate product name format
            if len(product) > 100:
                return {"status": "error", "message": "Product name too long (max 100 characters)"}, 400
            if not re.match(r'^[a-zA-Z0-9\s\-_.]+$', product):
                return {"status": "error", "message": "Invalid product name format"}, 400
            
            print(f"\n[RUN_ANALYSIS] Starting analysis for product: '{product}'")
            logger.info(f"Starting manual analysis for product: '{product}'")
            
            # USER REQUEST: Filter posts to only analyze those with explicit pain points, dislikes, or improvement ideas
            def has_pain_point_indicators(post):
                """Check if post explicitly mentions pain points, dislikes, or improvements"""
                if isinstance(post, dict):
                    text = f"{post.get('title', '')} {post.get('content', '')}".lower()
                else:
                    text = f"{getattr(post, 'title', '')} {getattr(post, 'content', '')}".lower()
                
                # Pain point indicators
                pain_indicators = [
                    'problem', 'issue', 'bug', 'broken', "doesn't work", 'not working',
                    'error', 'crash', 'frustrating', 'annoying', 'difficult', 'hard to',
                    "can't", 'cannot', 'impossible', 'hate', 'bad', 'terrible', 'horrible',
                    'slow', 'laggy', 'unusable', 'unstable', 'inconsistent', 'disappointed',
                    'disappointing', 'sucks', 'worst', 'awful', 'poor', 'weak', 'fails'
                ]
                
                # Improvement/feature request indicators
                improvement_indicators = [
                    'wish', 'should', 'would be nice', 'feature request', 'improvement',
                    'improve', 'better', 'add', 'need', 'want', 'suggest', 'recommend',
                    'hope', 'please add', 'missing', 'lack', 'could be', 'should have'
                ]
                
                # Dislike indicators
                dislike_indicators = [
                    'dislike', "don't like", 'hate', 'disappointed', 'frustrated',
                    'annoyed', 'upset', 'angry', 'complaint', 'complain'
                ]
                
                all_indicators = pain_indicators + improvement_indicators + dislike_indicators
                return any(indicator in text for indicator in all_indicators)
            
            # Fetch posts for this product
            if data_store.db is None:
                product_posts = [p for p in data_store.raw_posts if hasattr(p, 'products') and product in p.products]
            else:
                # Query MongoDB for posts with this product
                cursor = data_store.db.posts.find({"products": product})
                from models import RedditPost
                product_posts = []
                for doc in cursor:
                    post = RedditPost(
                        id=doc.get('_id') or doc.get('id', ''),
                        title=doc.get('title', ''),
                        content=doc.get('content', '') or doc.get('selftext', ''),
                        author=doc.get('author', ''),
                        subreddit=doc.get('subreddit', ''),
                        url=doc.get('url', ''),
                        created_utc=doc.get('created_utc'),
                        score=doc.get('score', 0),
                        num_comments=doc.get('num_comments', 0)
                    )
                    post.products = doc.get('products', [])
                    product_posts.append(post)
            
            if not product_posts:
                return {"status": "error", "message": f"No posts found for product '{product}'"}, 404
            
            # USER REQUEST: Filter to only posts with explicit pain points/dislikes/improvements
            filtered_posts = [post for post in product_posts if has_pain_point_indicators(post)]
            
            if not filtered_posts:
                return {
                    "status": "error", 
                    "message": f"No posts with explicit pain points, dislikes, or improvement ideas found for product '{product}'. Analysis only runs on posts that mention problems, issues, or suggestions."
                }, 404
            
            print(f"[RUN_ANALYSIS] Found {len(product_posts)} total posts, {len(filtered_posts)} with pain points/improvements for '{product}'")
            logger.info(f"Found {len(product_posts)} total posts, {len(filtered_posts)} with explicit pain points/dislikes/improvements for '{product}'")
            
            # Run Anthropic analysis ONLY on filtered posts
            analysis = anthropic_analyzer.analyze_common_pain_points(filtered_posts, product)
            
            if 'error' in analysis:
                print(f"[RUN_ANALYSIS] Analysis failed: {analysis.get('error')}")
                logger.error(f"Analysis failed for '{product}': {analysis.get('error')}")
                return {
                    "status": "error",
                    "message": analysis.get('error', 'Analysis failed'),
                    "analysis": None
                }, 500
            
            # Save analysis to MongoDB
            save_result = data_store.save_anthropic_analysis(product, analysis)
            print(f"[RUN_ANALYSIS] Analysis saved: {save_result}")
            logger.info(f"Analysis saved for '{product}': {save_result}")
            
            return {
                "status": "success",
                "message": f"Analysis completed for '{product}'",
                "analysis": analysis,
                "pain_points_count": len(analysis.get('common_pain_points', []))
            }
        except Exception as e:
            logger.error(f"Error running analysis: {str(e)}", exc_info=True)
            return {
                "status": "error",
                "message": f"Error running analysis: {str(e)}"
            }, 500

class HealthCheck(CORSResource):
    """API endpoint for health check"""
    def get(self):
        """
        Health check endpoint to verify API is running
        
        Returns:
            JSON response with API status
        """
        return {
            "status": "success",
            "message": "API is running",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

# Alias for GetAnthropicAnalysis (backward compatibility)
GetClaudeAnalysis = GetAnthropicAnalysis

class GetUserProfile(CORSResource):
    """API endpoint to get user profile"""
    @token_required
    def get(self, current_user):
        """
        Get current user's profile information
        
        Returns:
            JSON response with user profile data
        """
        logger.info("[USER PROFILE] ========== GET USER PROFILE REQUEST ==========")
        username = current_user.get('username')
        logger.info(f"[USER PROFILE] Requested profile for username: {username}")
        
        if not username:
            logger.warning("[USER PROFILE] No username in token - invalid token")
            return {"status": "error", "message": "Invalid token"}, 401
        
        if data_store.db is not None:
            try:
                logger.info("[USER PROFILE] Step 1: Querying database for user...")
                user = data_store.db.users.find_one({"username": username})
                
                if user:
                    logger.info(f"[USER PROFILE] Step 2: User found in database")
                    logger.info(f"[USER PROFILE] User fields in database: {list(user.keys())}")
                    
                    # Extract user data (excluding password)
                    user_data = {
                        "username": user.get("username"),
                        "email": user.get("email"),
                        "full_name": user.get("full_name"),
                        "preferred_name": user.get("preferred_name"),
                        "birthday": user.get("birthday"),
                        "created_at": user.get("created_at").isoformat() if user.get("created_at") else None,
                        "last_login": user.get("last_login").isoformat() if user.get("last_login") else None,
                        "credits": user.get("credits", 0)
                    }
                    
                    logger.info(f"[USER PROFILE] Step 3: User data prepared:")
                    logger.info(f"[USER PROFILE]   - username: {user_data.get('username')}")
                    logger.info(f"[USER PROFILE]   - email: {user_data.get('email')}")
                    logger.info(f"[USER PROFILE]   - full_name: {user_data.get('full_name')}")
                    logger.info(f"[USER PROFILE]   - preferred_name: {user_data.get('preferred_name')}")
                    logger.info(f"[USER PROFILE]   - birthday: {user_data.get('birthday')}")
                    logger.info(f"[USER PROFILE]   - credits: {user_data.get('credits')}")
                    logger.info(f"[USER PROFILE]   - created_at: {user_data.get('created_at')}")
                    logger.info(f"[USER PROFILE]   - last_login: {user_data.get('last_login')}")
                    logger.info("[USER PROFILE] ========== GET USER PROFILE SUCCESS ==========")
                    
                    return {
                        "status": "success",
                        "user": user_data
                    }
                else:
                    logger.warning(f"[USER PROFILE] User not found in database: {username}")
                    logger.error("[USER PROFILE] ========== GET USER PROFILE ERROR ==========")
                    return {"status": "error", "message": "User not found"}, 404
            except Exception as e:
                logger.error("[USER PROFILE] ========== GET USER PROFILE ERROR ==========")
                logger.error(f"[USER PROFILE] Error retrieving user profile: {str(e)}", exc_info=True)
                return {"status": "error", "message": "Database error"}, 500
        else:
            logger.error("[USER PROFILE] ========== GET USER PROFILE ERROR ==========")
            logger.error("[USER PROFILE] Database not available")
            return {"status": "error", "message": "Database not available"}, 500

class UpdateUserCredits(CORSResource):
    """API endpoint to update user credits"""
    @token_required
    def post(self, current_user):
        """
        Update user credits
        
        POST parameters:
        - credits (int): New credit amount (optional, for admin use)
        - delta (int): Change in credits (add/subtract)
        
        Returns:
            JSON response with updated credit amount
        """
        username = current_user.get('username')
        if not username:
            return {"status": "error", "message": "Invalid token"}, 401
        
        data = request.get_json() or {}
        credits = data.get('credits')
        delta = data.get('delta', 0)
        
        if data_store.db is not None:
            try:
                from pymongo import ReturnDocument
                
                if credits is not None:
                    # Set absolute value (admin use only)
                    # TODO: Add admin permission check
                    result = data_store.db.users.find_one_and_update(
                        {"username": username},
                        {"$set": {"credits": int(credits)}},
                        return_document=ReturnDocument.AFTER
                    )
                else:
                    # CRITICAL FIX: Use atomic $inc operator to prevent race condition
                    delta_value = int(delta)
                    result = data_store.db.users.find_one_and_update(
                        {"username": username},
                        {"$inc": {"credits": delta_value}},
                        return_document=ReturnDocument.AFTER
                    )
                
                if not result:
                    return {"status": "error", "message": "User not found"}, 404
                
                new_credits = result.get("credits", 0)
                
                # Prevent negative credits
                if new_credits < 0:
                    # Rollback by adding back the negative amount
                    data_store.db.users.update_one(
                        {"username": username},
                        {"$set": {"credits": 0}}
                    )
                    return {
                        "status": "error",
                        "message": "Insufficient credits",
                        "credits": 0
                    }, 400
                
                return {
                    "status": "success",
                    "message": "Credits updated",
                    "credits": new_credits
                }
            except Exception as e:
                logger.error(f"Error updating user credits: {str(e)}")
                return {"status": "error", "message": "Database error"}, 500
        else:
            return {"status": "error", "message": "Database not available"}, 500

class DeleteAccount(CORSResource):
    """API endpoint to delete user account"""
    @token_required
    def delete(self, current_user):
        """
        Delete current user's account
        
        Returns:
            JSON response confirming account deletion
        """
        username = current_user.get('username')
        if not username:
            return {"status": "error", "message": "Invalid token"}, 401
        
        if data_store.db is not None:
            try:
                result = data_store.db.users.delete_one({"username": username})
                if result.deleted_count > 0:
                    return {
                        "status": "success",
                        "message": "Account deleted successfully"
                    }
                else:
                    return {"status": "error", "message": "User not found"}, 404
            except Exception as e:
                logger.error(f"Error deleting user account: {str(e)}")
                return {"status": "error", "message": "Database error"}, 500
        else:
            return {"status": "error", "message": "Database not available"}, 500


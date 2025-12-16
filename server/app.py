import os
import logging
from flask import Flask, request
from flask_cors import CORS
from flask_restful import Api
import nltk
from dotenv import load_dotenv
from security import secure_headers, validate_jwt_secret

# Load environment variables
load_dotenv()

# Safe download if not already available
try:
    nltk.data.find("tokenizers/punkt")
except LookupError:
    nltk.download("punkt")

# Set up logging - CRITICAL FIX: Use appropriate log level based on environment
log_level = os.getenv("LOG_LEVEL", "INFO" if os.getenv("FLASK_ENV") == "production" else "DEBUG")
logging.basicConfig(
    level=getattr(logging, log_level.upper(), logging.INFO),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
logging.getLogger("pymongo").setLevel(logging.WARNING)
logging.getLogger("pymongo.connection").setLevel(logging.WARNING)
logging.getLogger("pymongo.topology").setLevel(logging.WARNING)

# Initialize Flask app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "dev_secret_key")

# Enable CORS with security restrictions
default_origins = [
    "http://localhost:5173",  # Local development
    "https://www.iinsightss.com",  # Production domain
    "https://iinsightss.com",  # Production domain (without www)
    "https://reddit-painpoint-4nx9b.ondigitalocean.app"  # DigitalOcean deployment
]
allowed_origins_env = os.getenv("ALLOWED_ORIGINS")
if allowed_origins_env:
    allowed_origins = [origin.strip() for origin in allowed_origins_env.split(",")]
else:
    allowed_origins = default_origins

logger.info(f"CORS configured for origins: {allowed_origins}")

CORS(app, resources={r"/api/*": {
    "origins": allowed_origins,
    "supports_credentials": True,
    "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    "allow_headers": ["Content-Type", "Authorization", "X-Requested-With"],
    "expose_headers": ["X-Request-ID"]
}})

# Initialize Flask-RESTful API
api = Api(app)

# Import and initialize MongoDB store
from mongodb_store import MongoDBStore

# Create a MongoDB store instance
data_store = MongoDBStore(os.getenv("MONGODB_URI"))
data_store.scrape_in_progress = False
data_store.update_metadata(scrape_in_progress=False)

# Import and register routes
from routes import initialize_routes
initialize_routes(api)

# Validate security configuration
if not validate_jwt_secret():
    logger.warning("JWT_SECRET_KEY validation failed - check your configuration")

# Add request ID tracking
import uuid
from flask import g

@app.before_request
def add_request_id():
    """Add unique request ID to all requests"""
    g.request_id = str(uuid.uuid4())
    logger.info(f"[{g.request_id}] {request.method} {request.path}")

@app.before_request
def handle_options_request():
    """Handle OPTIONS requests for CORS preflight"""
    if request.method == 'OPTIONS':
        logger.info(f"[{g.request_id}] Handling OPTIONS preflight request for {request.path}")
        response = make_response()
        response.headers['Access-Control-Allow-Origin'] = request.headers.get('Origin', '*')
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With'
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        return response

@app.before_request
def log_request_info():
    """Log incoming requests with security considerations"""
    request_id = getattr(g, 'request_id', 'N/A')
    
    # CRITICAL FIX: Only log in development, sanitize sensitive data
    is_development = os.getenv("FLASK_ENV") != "production"
    
    if is_development:
        # In development, log more details but still sanitize
        logger.debug(f"[{request_id}] {request.method} {request.path}")
        
        # Sanitize headers - remove sensitive information
        headers = dict(request.headers)
        sensitive_headers = ['authorization', 'cookie', 'x-api-key', 'x-auth-token']
        sanitized_headers = {k: '***REDACTED***' if k.lower() in sensitive_headers else v 
                            for k, v in headers.items()}
        logger.debug(f"[{request_id}] Headers: {sanitized_headers}")
        
        # Sanitize request body - remove passwords and tokens
        if request.is_json:
            body = request.get_json() or {}
            sanitized_body = sanitize_sensitive_data(body)
            logger.debug(f"[{request_id}] JSON Body: {sanitized_body}")
        elif request.form:
            form_data = dict(request.form)
            sanitized_form = sanitize_sensitive_data(form_data)
            logger.debug(f"[{request_id}] Form Data: {sanitized_form}")
        elif request.args:
            logger.debug(f"[{request_id}] Query Params: {dict(request.args)}")
    else:
        # In production, only log minimal info
        logger.info(f"[{request_id}] {request.method} {request.path}")


def sanitize_sensitive_data(data):
    """Remove sensitive fields from data for logging"""
    if not isinstance(data, dict):
        return data
    
    sensitive_fields = ['password', 'token', 'secret', 'api_key', 'access_token', 
                       'refresh_token', 'authorization', 'auth']
    sanitized = {}
    
    for key, value in data.items():
        key_lower = key.lower()
        if any(sensitive in key_lower for sensitive in sensitive_fields):
            sanitized[key] = '***REDACTED***'
        elif isinstance(value, dict):
            sanitized[key] = sanitize_sensitive_data(value)
        elif isinstance(value, list) and value and isinstance(value[0], dict):
            sanitized[key] = [sanitize_sensitive_data(item) for item in value]
        else:
            sanitized[key] = value
    
    return sanitized

# Add security headers and request ID to all responses
@app.after_request
def add_security_headers(response):
    # Add request ID to response headers
    if hasattr(g, 'request_id'):
        response.headers['X-Request-ID'] = g.request_id
    return secure_headers(response)

logger.info("App initialized successfully")
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

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)
logging.getLogger("pymongo").setLevel(logging.WARNING)
logging.getLogger("pymongo.connection").setLevel(logging.WARNING)
logging.getLogger("pymongo.topology").setLevel(logging.WARNING)

# Initialize Flask app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "dev_secret_key")

# Enable CORS with security restrictions
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
CORS(app, resources={r"/api/*": {
    "origins": allowed_origins,
    "supports_credentials": True,
    "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    "allow_headers": ["Content-Type", "Authorization"]
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
def log_request_info():
    """Log all incoming requests for debugging"""
    request_id = getattr(g, 'request_id', 'N/A')
    print(f"\n[REQUEST {request_id}] {request.method} {request.path}")
    print(f"[REQUEST {request_id}] Headers: {dict(request.headers)}")
    if request.is_json:
        print(f"[REQUEST {request_id}] JSON Body: {request.get_json()}")
    elif request.form:
        print(f"[REQUEST {request_id}] Form Data: {dict(request.form)}")
    elif request.args:
        print(f"[REQUEST {request_id}] Query Params: {dict(request.args)}")
    logger.debug(f"[{request_id}] Request: {request.method} {request.path}")

# Add security headers and request ID to all responses
@app.after_request
def add_security_headers(response):
    # Add request ID to response headers
    if hasattr(g, 'request_id'):
        response.headers['X-Request-ID'] = g.request_id
    return secure_headers(response)

logger.info("App initialized successfully")
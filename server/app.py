import os
import logging
import uuid
import time
from threading import Thread
from flask import Flask, request, g, jsonify, make_response
from flask_cors import CORS
from flask_restful import Api
from flask_socketio import SocketIO, join_room, leave_room
import nltk
from dotenv import load_dotenv
from security import secure_headers, validate_jwt_secret

# Load environment variables
load_dotenv()

# Use NLTK data from buildpack path when present (DO/Heroku download to this dir at build time)
_nltk_data = os.environ.get("NLTK_DATA", "/app/.heroku/python/nltk_data")
if os.path.isdir(_nltk_data):
    nltk.data.path.insert(0, _nltk_data)

# Safe download if not already available
try:
    nltk.data.find("tokenizers/punkt")
except LookupError:
    nltk.download("punkt")

# Set up logging
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

# Configure CORS origins
cors_origins = [
    "https://iinsightss.com",
    "https://www.iinsightss.com",
    "https://reddit-painpoint-4nx9b.ondigitalocean.app",
    "http://localhost:5173"
]

logger.info(f"Setting up CORS for origins: {cors_origins}")

# Configure CORS - single, clean configuration
CORS(app,
    resources={r"/*": {"origins": cors_origins}},
    supports_credentials=True,
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
    expose_headers=["Content-Type", "X-Request-ID"]
)

# Initialize Flask-RESTful API
api = Api(app)

# Initialize SocketIO for real-time pipeline logs (CORS same as REST API)
# eventlet when installed (production/gunicorn); threading for local dev when eventlet not installed
try:
    import eventlet  # noqa: F401
    _socketio_async_mode = "eventlet"
except ImportError:
    _socketio_async_mode = "threading"
socketio = SocketIO(app, cors_allowed_origins=cors_origins, async_mode=_socketio_async_mode)

# Import and initialize MongoDB store
from mongodb_store import MongoDBStore

# Create a MongoDB store instance
data_store = MongoDBStore(os.getenv("MONGODB_URI"))
data_store.scrape_in_progress = False
data_store.update_metadata(scrape_in_progress=False)


def _emit_job_log(job_id, entry):
    """Emit a job log entry to clients subscribed to this job (room = job_id)."""
    try:
        socketio.emit("job_log", {"job_id": str(job_id), "log": entry}, room=str(job_id))
    except Exception as e:
        logger.debug("SocketIO emit job_log: %s", e)


data_store.on_job_log = _emit_job_log


@socketio.on("subscribe_job")
def handle_subscribe_job(data):
    """Add this client to the room for job_id so they receive job_log events."""
    job_id = data.get("job_id") if isinstance(data, dict) else None
    if job_id:
        join_room(str(job_id))
        logger.debug("Socket joined room job_id=%s", job_id)


@socketio.on("unsubscribe_job")
def handle_unsubscribe_job(data):
    """Remove this client from the room for job_id."""
    job_id = data.get("job_id") if isinstance(data, dict) else None
    if job_id:
        leave_room(str(job_id))
        logger.debug("Socket left room job_id=%s", job_id)


# Import and register routes
from routes import initialize_routes
initialize_routes(api)

# Validate security configuration
if not validate_jwt_secret():
    logger.warning("JWT_SECRET_KEY validation failed - check your configuration")

# Add request ID tracking
@app.before_request
def add_request_id():
    """Add unique request ID to all requests"""
    g.request_id = str(uuid.uuid4())
    origin = request.headers.get('Origin', 'No Origin')
    logger.info(f"[{g.request_id}] {request.method} {request.path} (Origin: {origin})")

@app.before_request
def log_request_info():
    """Log incoming requests with security considerations"""
    request_id = getattr(g, 'request_id', 'N/A')
    
    # Only log in development, sanitize sensitive data
    is_development = os.getenv("FLASK_ENV") != "production"
    
    if is_development:
        logger.debug(f"[{request_id}] {request.method} {request.path}")
        
        # Sanitize headers - remove sensitive information
        headers = dict(request.headers)
        sensitive_headers = ['authorization', 'cookie', 'x-api-key', 'x-auth-token']
        sanitized_headers = {k: '***REDACTED***' if k.lower() in sensitive_headers else v 
                            for k, v in headers.items()}
        logger.debug(f"[{request_id}] Headers: {sanitized_headers}")
        
        # Sanitize request body
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


@app.errorhandler(500)
def handle_500(error):
    """Return 500 with CORS headers so the frontend receives the error instead of a CORS block."""
    response = make_response(
        jsonify({"status": "error", "message": "Internal server error"}),
        500
    )
    origin = request.headers.get("Origin")
    if origin and origin in cors_origins:
        response.headers["Access-Control-Allow-Origin"] = origin
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
    if hasattr(g, "request_id"):
        response.headers["X-Request-ID"] = g.request_id
    response = secure_headers(response)
    return response


def check_stuck_jobs_periodically():
    """Background thread to periodically check for stuck jobs"""
    check_interval = 300  # Check every 5 minutes
    timeout_minutes = 30  # Mark jobs as failed if stuck for >30 minutes
    
    logger.info(f"Started background job timeout checker (checking every {check_interval}s, timeout: {timeout_minutes} minutes)")
    
    while True:
        try:
            time.sleep(check_interval)
            
            if data_store.db is not None:
                marked_count = data_store.check_stuck_jobs(timeout_minutes=timeout_minutes)
                if marked_count > 0:
                    logger.warning(f"Job timeout checker marked {marked_count} stuck job(s) as failed")
            else:
                logger.debug("Job timeout checker skipped - database not connected")
                
        except Exception as e:
            logger.error(f"Error in job timeout checker: {str(e)}", exc_info=True)
            # Continue running even if there's an error

# Start background thread for checking stuck jobs
job_timeout_thread = Thread(target=check_stuck_jobs_periodically, daemon=True)
job_timeout_thread.start()
logger.info("Background job timeout checker thread started")

logger.info("App initialized successfully")
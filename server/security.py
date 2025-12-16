"""
Security utilities and middleware for the application.
"""
import os
import re
import logging
from functools import wraps
from flask import request, jsonify
from datetime import datetime, timezone, timedelta
import jwt

logger = logging.getLogger(__name__)

# Rate limiting storage (in-memory, use Redis in production)
_rate_limit_store = {}
_rate_limit_window = 60  # seconds
_rate_limit_max_requests = 100


def validate_input(data, rules):
    """
    Validate input data against rules.
    
    Args:
        data: Dictionary of data to validate
        rules: Dictionary of validation rules
            Example: {
                'username': {'type': str, 'min_len': 3, 'max_len': 50, 'pattern': r'^[a-zA-Z0-9_]+$'},
                'password': {'type': str, 'min_len': 8, 'max_len': 128}
            }
    
    Returns:
        tuple: (is_valid, errors)
    """
    errors = []
    
    for field, rule in rules.items():
        value = data.get(field)
        
        # Check required
        if rule.get('required', False) and (value is None or value == ''):
            errors.append(f"{field} is required")
            continue
        
        if value is None:
            continue
        
        # Type check
        if 'type' in rule and not isinstance(value, rule['type']):
            errors.append(f"{field} must be of type {rule['type'].__name__}")
            continue
        
        # Length checks
        if isinstance(value, str):
            if 'min_len' in rule and len(value) < rule['min_len']:
                errors.append(f"{field} must be at least {rule['min_len']} characters")
            if 'max_len' in rule and len(value) > rule['max_len']:
                errors.append(f"{field} must be at most {rule['max_len']} characters")
            
            # Pattern check
            if 'pattern' in rule:
                if not re.match(rule['pattern'], value):
                    errors.append(f"{field} format is invalid")
        
        # Range checks for numbers
        if isinstance(value, (int, float)):
            if 'min' in rule and value < rule['min']:
                errors.append(f"{field} must be at least {rule['min']}")
            if 'max' in rule and value > rule['max']:
                errors.append(f"{field} must be at most {rule['max']}")
    
    return len(errors) == 0, errors


def sanitize_input(text):
    """
    Sanitize user input to prevent injection attacks.
    
    Args:
        text: Input string to sanitize
    
    Returns:
        str: Sanitized string
    """
    if not isinstance(text, str):
        return text
    
    # Remove null bytes
    text = text.replace('\x00', '')
    
    # Remove control characters except newlines and tabs
    text = ''.join(char for char in text if ord(char) >= 32 or char in '\n\t')
    
    # Limit length to prevent DoS
    max_length = 10000
    if len(text) > max_length:
        text = text[:max_length]
    
    return text.strip()


def rate_limit(max_requests=None, window=None):
    """
    Rate limiting decorator.
    
    Args:
        max_requests: Maximum requests per window (default: 100)
        window: Time window in seconds (default: 60)
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            max_req = max_requests or _rate_limit_max_requests
            win = window or _rate_limit_window
            
            # Get client identifier
            client_id = request.remote_addr
            if request.headers.get('X-Forwarded-For'):
                client_id = request.headers.get('X-Forwarded-For').split(',')[0].strip()
            
            # Check rate limit
            now = datetime.now(timezone.utc)
            key = f"{client_id}:{f.__name__}"
            
            if key in _rate_limit_store:
                requests, first_request = _rate_limit_store[key]
                
                # Reset if window expired
                if (now - first_request).total_seconds() > win:
                    _rate_limit_store[key] = ([], now)
                    requests = []
                else:
                    # Remove old requests outside window
                    requests = [req_time for req_time in requests 
                               if (now - req_time).total_seconds() <= win]
                
                # Check if limit exceeded
                if len(requests) >= max_req:
                    logger.warning(f"Rate limit exceeded for {client_id}")
                    return {
                        "status": "error",
                        "message": "Rate limit exceeded. Please try again later."
                    }, 429
                
                # Add current request
                requests.append(now)
                _rate_limit_store[key] = (requests, first_request)
            else:
                _rate_limit_store[key] = ([now], now)
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator


def validate_jwt_secret():
    """
    Validate that JWT secret is properly configured.
    
    Returns:
        bool: True if secret is secure, False otherwise
    """
    secret = os.getenv("JWT_SECRET_KEY")
    
    if not secret:
        logger.error("JWT_SECRET_KEY not set")
        return False
    
    # Check for weak defaults
    weak_secrets = [
        "your-secret-key-change-in-production",
        "dev_secret_key",
        "secret",
        "password",
        "123456"
    ]
    
    if secret in weak_secrets:
        logger.warning("JWT_SECRET_KEY is using a weak default value")
        return False
    
    # Check minimum length
    if len(secret) < 32:
        logger.warning("JWT_SECRET_KEY should be at least 32 characters")
        return False
    
    return True


def secure_headers(response):
    """
    Add security headers to response.
    
    Args:
        response: Flask response object
    
    Returns:
        response: Response with security headers
    """
    # Prevent clickjacking
    response.headers['X-Frame-Options'] = 'DENY'
    
    # Prevent MIME type sniffing
    response.headers['X-Content-Type-Options'] = 'nosniff'
    
    # XSS protection
    response.headers['X-XSS-Protection'] = '1; mode=block'
    
    # Content Security Policy
    response.headers['Content-Security-Policy'] = "default-src 'self'"
    
    # Strict Transport Security (only if HTTPS)
    if request.is_secure:
        response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    
    return response


def validate_password_strength(password):
    """
    Validate password strength.
    
    Args:
        password: Password string to validate
    
    Returns:
        tuple: (is_valid, error_message)
    """
    if not password:
        return False, "Password is required"
    
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    
    if len(password) > 128:
        return False, "Password must be at most 128 characters long"
    
    # Check for at least one number
    if not re.search(r'\d', password):
        return False, "Password must contain at least one number"
    
    # Check for at least one letter
    if not re.search(r'[a-zA-Z]', password):
        return False, "Password must contain at least one letter"
    
    return True, None


def sanitize_error_message(error):
    """
    Sanitize error messages to prevent information leakage.
    
    Args:
        error: Exception or error message
    
    Returns:
        str: Safe error message for client
    """
    error_str = str(error)
    
    # Don't expose internal paths
    error_str = re.sub(r'/[^\s]+\.py', '[file]', error_str)
    
    # Don't expose stack traces in production
    if os.getenv("FLASK_ENV") == "production":
        if "Traceback" in error_str or "File" in error_str:
            return "An internal error occurred. Please contact support."
    
    # Remove sensitive patterns
    sensitive_patterns = [
        r'password[=:]\s*\S+',
        r'secret[=:]\s*\S+',
        r'api[_-]?key[=:]\s*\S+',
        r'token[=:]\s*\S+',
    ]
    
    for pattern in sensitive_patterns:
        error_str = re.sub(pattern, '[redacted]', error_str, flags=re.IGNORECASE)
    
    return error_str


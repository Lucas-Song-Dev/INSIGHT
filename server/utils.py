"""
Utility functions for error handling, retries, and common operations
"""
import time
import logging
from functools import wraps
from datetime import datetime

logger = logging.getLogger(__name__)

def retry_on_failure(max_retries=3, delay=1, backoff=2, exceptions=(Exception,)):
    """
    Decorator to retry function on failure
    
    Args:
        max_retries: Maximum number of retry attempts
        delay: Initial delay between retries (seconds)
        backoff: Multiplier for delay on each retry
        exceptions: Tuple of exceptions to catch
    
    Example:
        @retry_on_failure(max_retries=3, delay=1, exceptions=(ConnectionError,))
        def call_external_api():
            ...
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            retries = 0
            current_delay = delay
            
            while retries < max_retries:
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    retries += 1
                    if retries >= max_retries:
                        logger.error(f"{func.__name__} failed after {max_retries} attempts: {str(e)}")
                        raise
                    
                    logger.warning(
                        f"{func.__name__} failed (attempt {retries}/{max_retries}): {str(e)}. "
                        f"Retrying in {current_delay}s..."
                    )
                    time.sleep(current_delay)
                    current_delay *= backoff
            
            return None
        return wrapper
    return decorator

def error_response(message, status_code=400, error_code=None, details=None):
    """
    Standardized error response format
    
    Args:
        message: Human-readable error message
        status_code: HTTP status code
        error_code: Machine-readable error code (optional)
        details: Additional error details (optional)
    
    Returns:
        Tuple of (response_dict, status_code)
    """
    from flask import g
    
    response = {
        "status": "error",
        "message": message,
        "timestamp": datetime.utcnow().isoformat()
    }
    
    # Add request ID if available
    if hasattr(g, 'request_id'):
        response["request_id"] = g.request_id
    
    if error_code:
        response["error_code"] = error_code
    
    if details:
        response["details"] = details
    
    return response, status_code

def success_response(data=None, message=None, status_code=200):
    """
    Standardized success response format
    
    Args:
        data: Response data dictionary (optional)
        message: Success message (optional)
        status_code: HTTP status code
    
    Returns:
        Tuple of (response_dict, status_code)
    """
    from flask import g
    
    response = {
        "status": "success",
        "timestamp": datetime.utcnow().isoformat()
    }
    
    # Add request ID if available
    if hasattr(g, 'request_id'):
        response["request_id"] = g.request_id
    
    if message:
        response["message"] = message
    
    if data:
        if isinstance(data, dict):
            response.update(data)
        else:
            response["data"] = data
    
    return response, status_code


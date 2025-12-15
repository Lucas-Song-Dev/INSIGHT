/**
 * Centralized error handling utility for API errors
 */
export const handleApiError = (error) => {
  if (error.response) {
    // Server responded with error
    const { status, data } = error.response;
    
    switch (status) {
      case 401:
        return { 
          message: data?.message || "Authentication required", 
          action: "logout",
          errorCode: data?.error_code || "AUTH_REQUIRED"
        };
      case 403:
        return { 
          message: data?.message || "Access denied", 
          action: "none",
          errorCode: data?.error_code || "FORBIDDEN"
        };
      case 404:
        return { 
          message: data?.message || "Resource not found", 
          action: "none",
          errorCode: data?.error_code || "NOT_FOUND"
        };
      case 409:
        return { 
          message: data?.message || "Conflict. Please try again.", 
          action: "retry",
          errorCode: data?.error_code || "CONFLICT"
        };
      case 429:
        return { 
          message: data?.message || "Too many requests. Please try again later.", 
          action: "retry",
          errorCode: data?.error_code || "RATE_LIMIT"
        };
      case 500:
        return { 
          message: data?.message || "Server error. Please try again later.", 
          action: "retry",
          errorCode: data?.error_code || "SERVER_ERROR"
        };
      case 503:
        return { 
          message: data?.message || "Service unavailable. Please try again later.", 
          action: "retry",
          errorCode: data?.error_code || "SERVICE_UNAVAILABLE"
        };
      default:
        return { 
          message: data?.message || "An error occurred", 
          action: "none",
          errorCode: data?.error_code || "UNKNOWN_ERROR"
        };
    }
  } else if (error.request) {
    // Request made but no response
    return { 
      message: "Network error. Please check your connection.", 
      action: "retry",
      errorCode: "NETWORK_ERROR"
    };
  } else {
    // Error in request setup
    return { 
      message: error.message || "An unexpected error occurred", 
      action: "none",
      errorCode: "REQUEST_ERROR"
    };
  }
};

/**
 * Create an AbortController for request cancellation
 */
export const createAbortController = () => {
  return new AbortController();
};

/**
 * Check if error is a cancellation
 */
export const isCancelledError = (error) => {
  return error.name === 'AbortError' || error.message === 'Request cancelled';
};


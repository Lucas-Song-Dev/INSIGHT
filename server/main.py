from app import app

if __name__ == "__main__":
    # CRITICAL FIX: Use environment variable for debug mode, default to False for security
    # Never enable debug mode in production - it exposes stack traces and enables interactive debugger
    import os
    debug_mode = os.getenv("FLASK_DEBUG", "False").lower() in ("true", "1", "yes")
    
    # Security check: Warn if debug is enabled in production-like environment
    if debug_mode and os.getenv("FLASK_ENV") == "production":
        print("WARNING: Debug mode is enabled in production environment!")
        print("This is a security risk. Set FLASK_DEBUG=False in production.")
        debug_mode = False  # Force disable in production
    
    app.run(host="0.0.0.0", port=5000, debug=debug_mode)

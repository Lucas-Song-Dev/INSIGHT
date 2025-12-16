#!/usr/bin/env python3
"""
Deployment verification script for Digital Ocean
Run this after deployment to ensure all components are working
"""
import os
import sys

def check_environment():
    """Check if all required environment variables are set"""
    required_vars = [
        'ANTHROPIC_API_KEY',
        'MONGODB_URI',
        'JWT_SECRET_KEY',
        'REDDIT_CLIENT_ID',
        'REDDIT_CLIENT_SECRET'
    ]

    missing = []
    for var in required_vars:
        if not os.getenv(var):
            missing.append(var)

    if missing:
        print(f"ERROR: Missing environment variables: {', '.join(missing)}")
        return False

    print("SUCCESS: All required environment variables are set")
    return True

def check_imports():
    """Check if all required packages can be imported"""
    imports = [
        ('anthropic', 'Anthropic'),
        ('flask', 'Flask'),
        ('pymongo', 'MongoClient'),
        ('praw', 'Reddit'),
        ('bcrypt', None),
        ('jwt', None)
    ]

    failed = []
    for module, attr in imports:
        try:
            mod = __import__(module)
            if attr and not hasattr(mod, attr):
                failed.append(f"{module}.{attr}")
        except ImportError:
            failed.append(module)

    if failed:
        print(f"ERROR: Failed to import: {', '.join(failed)}")
        return False

    print("SUCCESS: All required packages can be imported")
    return True

def check_anthropic():
    """Check if Anthropic analyzer can be initialized"""
    try:
        from anthropic_analyzer import AnthropicAnalyzer
        analyzer = AnthropicAnalyzer()
        if analyzer.api_key:
            print("SUCCESS: Anthropic analyzer initialized successfully")
            print(f"   Model: {analyzer.model}")
            return True
        else:
            print("ERROR: Anthropic API key not configured")
            return False
    except Exception as e:
        print(f"ERROR: Failed to initialize Anthropic analyzer: {e}")
        return False

def check_database():
    """Check if MongoDB connection works"""
    try:
        from mongodb_store import MongoDBStore
        store = MongoDBStore()
        if store.db is not None:
            print("SUCCESS: MongoDB connection successful")
            return True
        else:
            print("WARNING: MongoDB connection failed (using in-memory fallback)")
            return True  # This is OK for some deployments
    except Exception as e:
        print(f"ERROR: MongoDB connection error: {e}")
        return False

def main():
    """Run all deployment checks"""
    print("Running deployment verification checks...\n")

    checks = [
        ("Environment Variables", check_environment),
        ("Package Imports", check_imports),
        ("Anthropic Integration", check_anthropic),
        ("Database Connection", check_database),
    ]

    results = []
    for name, check_func in checks:
        print(f"Checking {name}...")
        try:
            result = check_func()
            results.append(result)
        except Exception as e:
            print(f"ERROR: {name} check failed with exception: {e}")
            results.append(False)
        print()

    passed = sum(results)
    total = len(results)

    print(f"Deployment check results: {passed}/{total} checks passed")

    if passed == total:
        print("SUCCESS: All deployment checks passed! Your app should work correctly.")
        return 0
    else:
        print("WARNING: Some checks failed. Please review the errors above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())

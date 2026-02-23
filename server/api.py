"""
API endpoints for the Reddit Painpoint Analyzer application.
"""
import logging
import os
from threading import Thread
from datetime import datetime, timezone
from flask import request, jsonify, make_response
from flask_restful import Resource
from flask_cors import cross_origin

# Import necessary modules (lazy imports to avoid circular dependencies)
logger = logging.getLogger(__name__)

# CORSResource base class for API endpoints
class CORSResource(Resource):
    """Base resource class that handles CORS for all API endpoints"""
    @cross_origin(supports_credentials=True)
    def options(self, *args, **kwargs):
        """Handle OPTIONS requests for CORS preflight"""
        return {}, 200

# Import token_required from security
from security import token_required

# Note: data_store is imported lazily in functions to avoid circular imports


def calculate_insight_cost(limit, time_filter):
    """Calculate credit cost for an insight run based on limit and time_filter. Used by tests."""
    if limit <= 10:
        return 1
    time_mult = {"hour": 1, "day": 1, "week": 1, "month": 2, "year": 3, "all": 4}.get(time_filter, 1)
    limit_tier = 1 if limit <= 50 else (2 if limit <= 100 else (3 if limit <= 200 else 4))
    return limit_tier * (time_mult + 1)


def deduct_user_credits(username, amount):
    """Deduct credits from a user. Returns True if successful, False otherwise. Used by tests."""
    from app import data_store
    if data_store.db is None:
        return False
    user = data_store.db.users.find_one({"username": username})
    if not user:
        return False
    available = user.get("credits", 0)
    if available < amount:
        return False
    result = data_store.db.users.update_one(
        {"username": username},
        {"$set": {"credits": available - amount}},
    )
    return result.modified_count == 1


def serialize_datetime(obj):
    """
    Recursively convert datetime objects to ISO format strings for JSON serialization.
    Handles dicts, lists, and nested structures.
    """
    from datetime import datetime
    
    if isinstance(obj, datetime):
        return obj.isoformat()
    elif isinstance(obj, dict):
        return {key: serialize_datetime(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [serialize_datetime(item) for item in obj]
    else:
        return obj

# ============================================================================
# Authentication Endpoints
# ============================================================================

class HealthCheck(CORSResource):
    """API endpoint for health check"""
    def get(self):
        """Health check endpoint"""
        return {"status": "ok", "message": "Server is running"}, 200

class Register(CORSResource):
    """API endpoint for user registration"""
    def post(self):
        """Register a new user"""
        import re
        import bcrypt
        from app import data_store
        data = request.get_json() or {}
        
        username = data.get('username', '').strip()
        password = data.get('password', '')
        email = (data.get('email') or '').strip()
        birthday = (data.get('birthday') or '').strip()
        full_name = (data.get('full_name') or '').strip()
        preferred_name = (data.get('preferred_name') or '').strip()
        
        if not username or not password:
            return {"status": "error", "message": "Username and password are required"}, 400
        
        if not full_name:
            return {"status": "error", "message": "Full name is required"}, 400
        
        if len(password) < 8:
            return {"status": "error", "message": "Password must be at least 8 characters long"}, 400
        
        if email and not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', email):
            return {"status": "error", "message": "Please enter a valid email address."}, 400
        
        # Preferred name optional; default to full name
        preferred_name = preferred_name or full_name
        
        if data_store.db is None:
            return {"status": "error", "message": "Database not available"}, 500
        
        existing_user = data_store.db.users.find_one({"username": username})
        if existing_user:
            return {"status": "error", "message": "Username already exists"}, 409
        
        hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        user_doc = {
            "username": username,
            "password": hashed.decode('utf-8'),
            "credits": 5,
            "created_at": datetime.utcnow(),
        }
        user_doc["full_name"] = full_name
        user_doc["preferred_name"] = preferred_name
        if email:
            user_doc["email"] = email
        if birthday:
            user_doc["birthday"] = birthday
        
        data_store.db.users.insert_one(user_doc)
        return {"status": "success", "message": "User registered successfully"}, 201

class Login(CORSResource):
    """API endpoint for user login"""
    def post(self):
        """Authenticate user and return JWT token"""
        from app import data_store, app
        import jwt
        import bcrypt
        from datetime import datetime, timedelta
        
        data = request.get_json() or {}
        username = data.get('username', '').strip()
        password = data.get('password', '')
        
        if not username or not password:
            return {"status": "error", "message": "Username and password are required"}, 400
        
        # Find user
        if data_store.db is None:
            return {"status": "error", "message": "Database not available"}, 500
        
        user = data_store.db.users.find_one({"username": username})
        if not user:
            return {"status": "error", "message": "Invalid credentials"}, 401
        
        # Verify password
        if not bcrypt.checkpw(password.encode('utf-8'), user['password'].encode('utf-8')):
            return {"status": "error", "message": "Invalid credentials"}, 401
        
        # Generate JWT token
        jwt_secret = os.getenv("JWT_SECRET_KEY")
        if not jwt_secret:
            return {"status": "error", "message": "JWT secret not configured"}, 500
        
        token_payload = {
            'username': username,
            'exp': datetime.utcnow() + timedelta(hours=24)
        }
        token = jwt.encode(token_payload, jwt_secret, algorithm='HS256')
        
        # Create response with token in cookie
        response = make_response({"status": "success", "message": "Login successful", "access_token": token})
        response.set_cookie(
            'access_token',
            token,
            httponly=True,
            secure=os.getenv("FLASK_ENV") == "production",
            samesite='Lax',
            max_age=86400  # 24 hours
        )
        
        return response

class Logout(CORSResource):
    """API endpoint for user logout"""
    @token_required
    def post(self, current_user):
        """Logout user by clearing token cookie"""
        response = make_response({"status": "success", "message": "Logged out successfully"})
        response.set_cookie('access_token', '', expires=0)
        return response

# ============================================================================
# Data Retrieval Endpoints
# ============================================================================

class GetStatus(CORSResource):
    """API endpoint to get scraping status"""
    @token_required
    def get(self, current_user):
        """Get current scraping status"""
        from app import data_store
        username = current_user.get('username')
        
        # Check if user has any active scraping jobs
        has_active_job = False
        if username in data_store.user_scraping_jobs:
            user_jobs = data_store.user_scraping_jobs[username]
            # Handle both old format (single dict/thread) and new format (list)
            if isinstance(user_jobs, list):
                # New format: list of job dicts
                for job_data in user_jobs:
                    thread = job_data.get('thread') if isinstance(job_data, dict) else job_data
                    if thread and thread.is_alive():
                        has_active_job = True
                        break
            else:
                # Old format: single thread or dict
                if isinstance(user_jobs, dict):
                    thread = user_jobs.get('thread')
                else:
                    thread = user_jobs
                has_active_job = thread and thread.is_alive()
        
        return {
            "status": "success",
            "scrape_in_progress": has_active_job
        }, 200

class GetPosts(CORSResource):
    """API endpoint to get scraped posts"""
    @token_required
    def get(self, current_user):
        """Get posts with optional filters"""
        from app import data_store
        
        # Get query parameters
        product = request.args.get('product')
        limit = int(request.args.get('limit', 100))
        sort_by = request.args.get('sort_by', 'date')
        
        posts = []
        if data_store.db is not None:
            query = {}
            if product:
                query['product'] = product
            
            posts_cursor = data_store.db.posts.find(query).limit(limit)
            posts = list(posts_cursor)
            
            # Convert ObjectId to string and serialize datetimes for JSON
            for post in posts:
                post['_id'] = str(post['_id'])
            posts = serialize_datetime(posts)
        else:
            # Fallback to in-memory storage
            posts = data_store.raw_posts[:limit]
            posts = [post.__dict__ if hasattr(post, '__dict__') else post for post in posts]
            posts = serialize_datetime(posts)
        
        return {"status": "success", "posts": posts}, 200

class GetPainPoints(CORSResource):
    """API endpoint to get pain points"""
    @token_required
    def get(self, current_user):
        """Get pain points with optional filters"""
        from app import data_store
        
        product = request.args.get('product')
        min_severity = float(request.args.get('min_severity', 0.0))
        
        pain_points = []
        if data_store.db is not None:
            query = {}
            if product:
                query['product'] = product
            if min_severity > 0:
                query['severity'] = {"$gte": min_severity}
            
            pain_points = list(data_store.db.pain_points.find(query))
            for pp in pain_points:
                pp['_id'] = str(pp['_id'])
        else:
            # Fallback to in-memory storage
            pain_points = list(data_store.pain_points.values())
        
        return {"status": "success", "pain_points": pain_points}, 200

class Recommendations(CORSResource):
    """API endpoint for recommendations (user-scoped). GET returns product-level doc(s). POST generates with type and credits."""
    @token_required
    def get(self, current_user):
        """Get recommendations for current user and product. Accepts product or products[], and recommendation_type."""
        from app import data_store

        product = request.args.get("product")
        if not product:
            product = request.args.get("products[]") or request.args.get("products")
        if not product and (request.args.getlist("products[]") or request.args.getlist("products")):
            product = (request.args.getlist("products[]") or request.args.getlist("products"))[0]
        if not product:
            return {"status": "success", "recommendations": []}, 200

        if isinstance(product, list):
            product = product[0] if product else None
        if not product:
            return {"status": "success", "recommendations": []}, 200

        recommendation_type = (request.args.get("recommendation_type") or "improve_product").strip().lower()
        if recommendation_type not in ("improve_product", "new_feature", "competing_product"):
            recommendation_type = "improve_product"

        username = current_user.get("username")
        product_key = product.strip().lower()
        doc = None
        if data_store.db is not None:
            doc_id_typed = f"{username}:{product_key}:{recommendation_type}" if username else f"{product_key}:{recommendation_type}"
            doc = data_store.db.recommendations.find_one({"_id": doc_id_typed})
            if not doc and recommendation_type == "improve_product":
                legacy_doc = data_store.db.recommendations.find_one({"_id": f"{username}:{product_key}"} if username else {"_id": product_key})
                if legacy_doc:
                    doc = legacy_doc
            if doc:
                # Never return a doc that was stored under a different type (e.g. wrong collection state)
                stored_type = (doc.get("recommendation_type") or "improve_product").strip().lower()
                if stored_type != recommendation_type:
                    doc = None
                else:
                    doc = serialize_datetime(doc)
                    doc.setdefault("recommendation_type", recommendation_type)
                    doc.pop("_id", None)

        out = [doc] if doc else []
        return {"status": "success", "recommendations": out}, 200

    @token_required
    def post(self, current_user):
        """Start a recommendations job: returns job_id immediately; generation runs in background (same flow as analysis)."""
        from app import data_store

        data = request.get_json() or {}
        products = data.get("products") or []
        if isinstance(products, str):
            products = [products] if products.strip() else []
        if not products or not isinstance(products, list):
            return {"status": "error", "message": "products array is required"}, 400

        product = (products[0] or "").strip() if products else ""
        if not product:
            return {"status": "error", "message": "At least one product is required"}, 400

        recommendation_type = (data.get("recommendation_type") or "improve_product").strip().lower()
        if recommendation_type not in ("improve_product", "new_feature", "competing_product"):
            return {"status": "error", "message": "recommendation_type must be improve_product, new_feature, or competing_product"}, 400

        context = data.get("context")
        if context is not None and isinstance(context, str) and len(context) > 500:
            return {"status": "error", "message": "context must be at most 500 characters"}, 400
        context = (context or "").strip()[:500] if context else None

        regenerate = bool(data.get("regenerate", False))
        username = current_user.get("username")
        product_key = product.strip().lower()

        if data_store.db is None:
            return {"status": "error", "message": "Database not available"}, 500

        # Check pain points exist (required for generation)
        pain_points_cursor = data_store.db.pain_points.find({"product": product_key, "user_id": username})
        pain_points = list(pain_points_cursor)
        if not pain_points:
            return {"status": "error", "message": "Run analysis first to generate pain points"}, 400

        # Decide first-time vs regenerate for credit cost
        doc_id_typed = f"{username}:{product_key}:{recommendation_type}"
        existing = data_store.db.recommendations.find_one({"_id": doc_id_typed})
        is_regenerate = existing is not None and regenerate
        required_credits = 1 if is_regenerate else 2

        user_doc = data_store.db.users.find_one({"username": username})
        available = (user_doc or {}).get("credits", 0)
        if available < required_credits:
            return {
                "status": "error",
                "message": f"Insufficient credits. Required: {required_credits}, available: {available}",
                "required_credits": required_credits,
                "available_credits": available,
            }, 402

        # Deduct credits before creating job (same as RunAnalysis)
        result = data_store.db.users.find_one_and_update(
            {"username": username, "credits": {"$gte": required_credits}},
            {"$inc": {"credits": -required_credits}},
            return_document=True,
        )
        if not result:
            return {
                "status": "error",
                "message": "Insufficient credits",
                "required_credits": required_credits,
                "available_credits": available,
            }, 402

        job_parameters = {
            "type": "recommendations",
            "product": product,
            "recommendation_type": recommendation_type,
            "regenerate": regenerate,
        }
        if context:
            job_parameters["context"] = context
        job_id = data_store.create_job(username, job_parameters)
        if not job_id:
            data_store.db.users.find_one_and_update(
                {"username": username},
                {"$inc": {"credits": required_credits}},
            )
            return {"status": "error", "message": "Failed to create job"}, 500

        def background_recommendations():
            try:
                # Use type and product from the job document so we always save to the correct slot (improve vs new_feature vs competing_product)
                job_doc = data_store.get_job(job_id)
                params = (job_doc or {}).get("parameters") or {}
                job_recommendation_type = (params.get("recommendation_type") or "improve_product").strip().lower()
                if job_recommendation_type not in ("improve_product", "new_feature", "competing_product"):
                    job_recommendation_type = "improve_product"
                job_product = (params.get("product") or product or "").strip() or product
                job_context = params.get("context") if params.get("context") else context

                data_store.update_job_status(job_id, "in_progress")
                data_store.append_job_log(job_id, "load_pain_points", f"Loaded {len(pain_points)} pain points for {job_product}", len(pain_points))

                pain_list = []
                for pp in pain_points:
                    pain_list.append({
                        "name": pp.get("topic") or pp.get("name") or "Unnamed",
                        "description": pp.get("description") or "",
                        "severity": pp.get("severity") or "medium",
                    })

                data_store.append_job_log(job_id, "generate", f"Generating {job_recommendation_type} recommendations with Claude", None)
                from claude_analyzer import ClaudeAnalyzer
                analyzer = ClaudeAnalyzer()
                rec_result = analyzer.generate_recommendations(
                    pain_list, job_product, recommendation_type=job_recommendation_type, context=job_context
                )

                if rec_result.get("error"):
                    err_msg = rec_result.get("error", "Recommendation generation failed")
                    data_store.append_job_log(job_id, "failed", err_msg, None)
                    data_store.update_job_status(job_id, "failed", error=err_msg, credits_used=required_credits)
                    data_store.db.users.find_one_and_update(
                        {"username": username},
                        {"$inc": {"credits": required_credits}},
                    )
                    logger.info(f"Refunded {required_credits} credit(s) to {username} after recommendations job {job_id} failed")
                    return

                recommendations = rec_result.get("recommendations") or []
                summary = rec_result.get("summary") or ""
                ts = rec_result.get("timestamp")
                if not data_store.save_recommendations(
                    job_product, recommendations, user_id=username, recommendation_type=job_recommendation_type,
                    summary=summary, timestamp=ts
                ):
                    data_store.append_job_log(job_id, "failed", "Failed to save recommendations", None)
                    data_store.update_job_status(job_id, "failed", error="Failed to save recommendations", credits_used=required_credits)
                    data_store.db.users.find_one_and_update(
                        {"username": username},
                        {"$inc": {"credits": required_credits}},
                    )
                    return

                results = {
                    "product": job_product,
                    "recommendation_type": job_recommendation_type,
                    "recommendations_count": len(recommendations),
                }
                data_store.append_job_log(job_id, "completed", f"Saved {len(recommendations)} recommendations (type={job_recommendation_type})", results)
                data_store.update_job_status(job_id, "completed", results=results, credits_used=required_credits)
            except Exception as e:
                err_msg = str(e)
                logger.exception("Recommendations job %s failed: %s", job_id, err_msg)
                data_store.append_job_log(job_id, "failed", err_msg, None)
                data_store.update_job_status(job_id, "failed", error=err_msg, credits_used=required_credits)
                data_store.db.users.find_one_and_update(
                    {"username": username},
                    {"$inc": {"credits": required_credits}},
                )
                logger.info(f"Refunded {required_credits} credit(s) to {username} after recommendations job {job_id} failed")

        thread = Thread(target=background_recommendations, daemon=True)
        thread.start()

        return {
            "status": "success",
            "message": "Recommendations job started",
            "job_id": str(job_id),
            "product": product,
            "recommendation_type": recommendation_type,
        }, 200

class GetClaudeAnalysis(CORSResource):
    """API endpoint to get Claude analysis results (user-scoped). Accepts product or products[]."""
    @token_required
    def get(self, current_user):
        """Get Claude analysis for current user and product. Returns analyses array for client compatibility."""
        from app import data_store

        product = request.args.get("product")
        if not product:
            product = request.args.get("products[]") or request.args.get("products")
        if not product and (request.args.getlist("products[]") or request.args.getlist("products")):
            product = (request.args.getlist("products[]") or request.args.getlist("products"))[0]
        if not product:
            return {"status": "error", "message": "Product parameter required"}, 400

        if isinstance(product, list):
            product = product[0] if product else None
        if not product:
            return {"status": "error", "message": "Product parameter required"}, 400

        username = current_user.get("username")
        product_key = product.strip().lower()
        analysis = None
        if data_store.db is not None:
            analysis = data_store.db.anthropic_analysis.find_one({"user_id": username, "product": product_key})
            if not analysis:
                analysis = data_store.db.anthropic_analysis.find_one({"_id": f"{username}:{product_key}"})
            if not analysis:
                analysis = data_store.db.anthropic_analysis.find_one({"_id": product_key})
            if not analysis:
                analysis = data_store.db.anthropic_analysis.find_one({"product": product_key})
            if analysis:
                analysis["_id"] = str(analysis["_id"])
                analysis = serialize_datetime(analysis)

        if not analysis:
            return {"status": "error", "message": "Analysis not found"}, 404

        return {"status": "success", "analyses": [analysis], "analysis": analysis}, 200

class GetAllProducts(CORSResource):
    """API endpoint to get all products belonging to the current user (from their jobs)."""
    @token_required
    def get(self, current_user):
        """Get list of products from current user's jobs (distinct topic/product from job parameters)."""
        from app import data_store

        username = current_user.get("username")
        products = []
        if data_store.db is not None:
            try:
                jobs_cursor = data_store.db.jobs.find(
                    {"user_id": username},
                    {"parameters": 1}
                )
                seen = set()
                for job in jobs_cursor:
                    params = job.get("parameters") or {}
                    topic = params.get("topic") or params.get("product")
                    if topic and isinstance(topic, str):
                        topic_clean = topic.strip()
                        if topic_clean and topic_clean not in seen:
                            seen.add(topic_clean)
                            products.append(topic_clean)
            except Exception:
                pass
        return {"status": "success", "products": products}, 200

class RunAnalysis(CORSResource):
    """API endpoint to run AI analysis (creates a job and runs in background with logging)."""
    @token_required
    def post(self, current_user):
        """Start an analysis job for a product: returns job_id immediately; analysis runs in background."""
        from app import data_store
        from datetime import datetime, timezone

        data = request.get_json() or {}
        product = (data.get("product") or "").strip()
        if not product:
            return {"status": "error", "message": "Product is required"}, 400

        # Optional: max_posts (int, default 500), skip_recommendations (bool, default False), regenerate (bool)
        try:
            max_posts = int(data.get("max_posts", 500))
            max_posts = min(max(1, max_posts), 1000)
        except (TypeError, ValueError):
            max_posts = 500
        skip_recommendations = bool(data.get("skip_recommendations", False))
        regenerate = bool(data.get("regenerate", False))

        if data_store.db is None:
            return {"status": "error", "message": "Database not available"}, 500

        # Quick check: any posts for this product?
        posts_count = data_store.db.posts.count_documents({"product": product})
        if posts_count == 0:
            return {
                "status": "error",
                "message": "No posts found for this product. Run a scrape first.",
            }, 404

        username = current_user.get("username")

        # Regenerate: deduct 1 credit atomically before creating job
        if regenerate:
            user = data_store.db.users.find_one({"username": username})
            available = (user or {}).get("credits", 0)
            if available < 1:
                return {
                    "status": "error",
                    "message": f"Insufficient credits. Current: {available}, Required: 1",
                    "required_credits": 1,
                    "available_credits": available,
                }, 400
            refund_result = data_store.db.users.find_one_and_update(
                {"username": username, "credits": {"$gte": 1}},
                {"$inc": {"credits": -1}},
                return_document=True,
            )
            if not refund_result:
                return {
                    "status": "error",
                    "message": "Insufficient credits",
                    "required_credits": 1,
                    "available_credits": available,
                }, 400
            # Clear existing analysis for this user+product before re-running
            data_store.delete_anthropic_analysis(product, user_id=username)
            data_store.delete_pain_points_by_product(product, user_id=username)
            data_store.delete_recommendations_by_product(product, user_id=username)

        job_parameters = {
            "type": "analysis",
            "product": product,
            "max_posts": max_posts,
            "skip_recommendations": skip_recommendations,
            "regenerate": regenerate,
        }
        job_id = data_store.create_job(username, job_parameters)
        if not job_id:
            if regenerate:
                # Refund credit if job creation failed
                data_store.db.users.find_one_and_update(
                    {"username": username},
                    {"$inc": {"credits": 1}},
                )
            return {"status": "error", "message": "Failed to create job"}, 500

        def background_analysis():
            from claude_analyzer import ClaudeAnalyzer
            from types import SimpleNamespace

            job_start = datetime.now(timezone.utc)
            try:
                data_store.update_job_status(job_id, "in_progress")
                data_store.append_job_log(job_id, "load_posts", f"Loading posts for {product} (max {max_posts})", max_posts)

                posts_cursor = data_store.db.posts.find({"product": product}).limit(max_posts)
                raw_posts = list(posts_cursor)
                normalized_posts = []
                for p in raw_posts:
                    content = (p.get("selftext") or p.get("content") or "") or ""
                    normalized_posts.append(
                        SimpleNamespace(
                            title=p.get("title") or "",
                            content=content,
                            score=p.get("score") or 0,
                            num_comments=p.get("num_comments") or 0,
                        )
                    )
                data_store.append_job_log(job_id, "analyze_pain_points", f"Analyzing {len(normalized_posts)} posts with Claude", None)

                analyzer = ClaudeAnalyzer()
                result = analyzer.analyze_common_pain_points(normalized_posts, product)
                if result.get("error"):
                    err_msg = result.get("error", "Claude API not configured")
                    data_store.append_job_log(job_id, "failed", err_msg, None)
                    data_store.update_job_status(job_id, "failed", error=err_msg, credits_used=1 if regenerate else None)
                    if regenerate:
                        data_store.db.users.find_one_and_update(
                            {"username": username},
                            {"$inc": {"credits": 1}},
                        )
                        logger.info(f"Refunded 1 credit to {username} after analysis job {job_id} failed")
                    return

                common_pain_points = result.get("common_pain_points") or []
                data_store.append_job_log(job_id, "save_analysis", f"Saved analysis ({len(common_pain_points)} pain points)", None)
                data_store.save_anthropic_analysis(product, result, user_id=username)

                for pp in common_pain_points:
                    pain_data = {
                        "product": product.strip().lower(),
                        "user_id": username,
                        "topic": pp.get("name") or "Unnamed",
                        "description": pp.get("description") or "",
                        "severity": pp.get("severity") or "medium",
                        "potential_solutions": pp.get("potential_solutions") or "",
                        "related_keywords": pp.get("related_keywords") or [],
                        "engagement_summary": pp.get("engagement_summary") or "",
                    }
                    data_store.save_pain_point(pain_data)

                recommendations_count = 0
                if skip_recommendations:
                    data_store.append_job_log(job_id, "recommendations", "Skipped (skip_recommendations=true)", None)
                else:
                    rec_result = analyzer.generate_recommendations(common_pain_points, product, recommendation_type="improve_product")
                    if rec_result.get("error"):
                        logger.warning("Recommendation generation failed for %s: %s", product, rec_result.get("error"))
                        data_store.append_job_log(job_id, "recommendations", "Recommendations skipped (Claude error)", None)
                    else:
                        recommendations = rec_result.get("recommendations") or []
                        if data_store.save_recommendations(product, recommendations, user_id=username, recommendation_type="improve_product"):
                            recommendations_count = len(recommendations)
                        data_store.append_job_log(job_id, "recommendations", f"Saved {recommendations_count} recommendations", recommendations_count)

                duration_minutes = int((datetime.now(timezone.utc) - job_start).total_seconds() / 60)
                results = {
                    "pain_points_count": len(common_pain_points),
                    "recommendations_count": recommendations_count,
                    "product": product,
                    "duration_minutes": duration_minutes,
                }
                data_store.append_job_log(job_id, "completed", f"Analysis completed. {len(common_pain_points)} pain points, {recommendations_count} recommendations.", results)
                data_store.update_job_status(job_id, "completed", results=results, credits_used=1 if regenerate else None)
            except Exception as e:
                err_msg = str(e)
                logger.error("Analysis job %s failed: %s", job_id, err_msg, exc_info=True)
                data_store.append_job_log(job_id, "failed", err_msg, None)
                data_store.update_job_status(job_id, "failed", error=err_msg, credits_used=1 if regenerate else None)
                if regenerate:
                    # Refund 1 credit on failure
                    data_store.db.users.find_one_and_update(
                        {"username": username},
                        {"$inc": {"credits": 1}},
                    )
                    logger.info(f"Refunded 1 credit to {username} after analysis job {job_id} failed")

        thread = Thread(target=background_analysis, daemon=True)
        thread.start()

        return {
            "status": "success",
            "message": "Analysis job started",
            "job_id": str(job_id),
            "product": product,
        }, 200

class ResetScrapeStatus(CORSResource):
    """API endpoint to reset scrape status"""
    @token_required
    def post(self, current_user):
        """Reset scraping status"""
        from app import data_store
        username = current_user.get('username')
        
        # Clean up all jobs for this user
        if username in data_store.user_scraping_jobs:
            del data_store.user_scraping_jobs[username]
        
        data_store.scrape_in_progress = False
        data_store.update_metadata(scrape_in_progress=False)
        
        return {"status": "success", "message": "Scrape status reset"}, 200

# ============================================================================
# User Management Endpoints
# ============================================================================

class GetUserProfile(CORSResource):
    """API endpoint to get user profile"""
    @token_required
    def get(self, current_user):
        """Get current user's profile"""
        from app import data_store
        username = current_user.get('username')
        
        if data_store.db is None:
            return {"status": "error", "message": "Database not available"}, 500
        
        user = data_store.db.users.find_one({"username": username})
        if not user:
            return {"status": "error", "message": "User not found"}, 404
        
        # Remove sensitive data and serialize datetimes
        user_data = {
            'username': user.get('username'),
            'email': user.get('email'),
            'credits': user.get('credits', 0),
            'created_at': user.get('created_at').isoformat() if user.get('created_at') else None,
            'last_login': user.get('last_login').isoformat() if user.get('last_login') else None
        }
        
        return {"status": "success", "user": user_data}, 200

class UpdateUserCredits(CORSResource):
    """API endpoint to update user credits"""
    @token_required
    def post(self, current_user):
        """Update user credits
        
        Request body:
        - username (str, optional): Username to update (defaults to current user)
        - credits (int, required): Amount of credits to add/set/deduct
        - operation (str, required): 'add', 'deduct', or 'set'
        
        Returns:
            JSON response with old_credits and new_credits
        """
        from app import data_store
        from bson import ObjectId
        
        try:
            # Get request data
            data = request.get_json() or {}
            
            # Get username (default to current user)
            target_username = data.get('username') or current_user.get('username')
            credits_amount = data.get('credits')
            operation = data.get('operation', 'add').lower()
            
            # Validate inputs
            if credits_amount is None:
                return {"status": "error", "message": "Credits amount is required"}, 400
            
            try:
                credits_amount = int(credits_amount)
            except (ValueError, TypeError):
                return {"status": "error", "message": "Credits must be a valid number"}, 400
            
            if credits_amount < 0:
                return {"status": "error", "message": "Credits amount cannot be negative"}, 400
            
            if operation not in ['add', 'deduct', 'set']:
                return {"status": "error", "message": "Operation must be 'add', 'deduct', or 'set'"}, 400
            
            # Check if user can update credits (must be updating own account or be admin)
            current_username = current_user.get('username')
            if target_username != current_username:
                # In the future, you could add admin check here
                # For now, only allow users to update their own credits
                return {"status": "error", "message": "You can only update your own credits"}, 403
            
            if data_store.db is None:
                return {"status": "error", "message": "Database not available"}, 500
            
            # Get current user to check existing credits
            user = data_store.db.users.find_one({"username": target_username})
            if not user:
                return {"status": "error", "message": "User not found"}, 404
            
            old_credits = user.get('credits', 0)
            
            # Perform the operation
            if operation == 'add':
                update_operation = {"$inc": {"credits": credits_amount}}
                new_credits = old_credits + credits_amount
            elif operation == 'deduct':
                # Check if user has enough credits
                if old_credits < credits_amount:
                    return {
                        "status": "error",
                        "message": f"Insufficient credits. Current: {old_credits}, Required: {credits_amount}"
                    }, 400
                update_operation = {"$inc": {"credits": -credits_amount}}
                new_credits = old_credits - credits_amount
            else:  # operation == 'set'
                update_operation = {"$set": {"credits": credits_amount}}
                new_credits = credits_amount
            
            # Update credits using atomic operation
            result = data_store.db.users.find_one_and_update(
                {"username": target_username},
                update_operation,
                return_document=True
            )
            
            if not result:
                return {"status": "error", "message": "Failed to update credits"}, 500
            
            logger.info(f"Updated credits for user {target_username}: {old_credits} -> {new_credits} (operation: {operation}, amount: {credits_amount})")
            
            return {
                "status": "success",
                "message": f"Credits {operation}ed successfully",
                "old_credits": old_credits,
                "new_credits": new_credits,
                "operation": operation,
                "amount": credits_amount
            }, 200
            
        except Exception as e:
            logger.error(f"Error updating user credits: {str(e)}", exc_info=True)
            return {"status": "error", "message": str(e)}, 500

class DeleteAccount(CORSResource):
    """API endpoint to delete user account"""
    @token_required
    def delete(self, current_user):
        """Delete user account"""
        # Stub implementation
        return {"status": "error", "message": "Not fully implemented"}, 501

class RequestPasswordReset(CORSResource):
    """API endpoint to request password reset"""
    def post(self):
        """Request password reset"""
        # Stub implementation
        return {"status": "error", "message": "Not fully implemented"}, 501

class ResetPassword(CORSResource):
    """API endpoint to reset password"""
    def post(self):
        """Reset password with token"""
        # Stub implementation
        return {"status": "error", "message": "Not fully implemented"}, 501

class ChangePassword(CORSResource):
    """API endpoint to change password"""
    @token_required
    def post(self, current_user):
        """Change user password"""
        # Stub implementation
        return {"status": "error", "message": "Not fully implemented"}, 501

# ============================================================================
# Job Management Endpoints
# ============================================================================

class GetUserJobs(CORSResource):
    """API endpoint to get user's jobs"""
    @token_required
    def get(self, current_user):
        """Get all jobs for the current user"""
        from app import data_store
        username = current_user.get('username')
        
        jobs = []
        if data_store.db is not None:
            jobs_raw = list(data_store.db.jobs.find({"user_id": username}).sort("created_at", -1))
            for job in jobs_raw:
                job['_id'] = str(job['_id'])
                # Recursively serialize all datetime objects
                job = serialize_datetime(job)
                jobs.append(job)
        
        return {"status": "success", "jobs": jobs}, 200

class GetJobDetails(CORSResource):
    """API endpoint to get job details"""
    @token_required
    def get(self, current_user, job_id=None):
        """Get details of a specific job"""
        from app import data_store
        from bson import ObjectId
        username = current_user.get('username')
        
        if not job_id:
            return {"status": "error", "message": "Job ID required"}, 400
        
        try:
            job_object_id = ObjectId(job_id)
        except:
            return {"status": "error", "message": "Invalid job ID"}, 400
        
        if data_store.db is None:
            return {"status": "error", "message": "Database not available"}, 500
        
        job = data_store.db.jobs.find_one({"_id": job_object_id})
        if not job:
            return {"status": "error", "message": "Job not found"}, 404
        
        # Verify ownership
        if job.get('user_id') != username:
            return {"status": "error", "message": "Access denied"}, 403
        
        job['_id'] = str(job['_id'])
        # Recursively serialize all datetime objects
        job = serialize_datetime(job)
        
        return {"status": "success", "job": job}, 200

class ScrapePosts(CORSResource):
    """API endpoint to start Reddit scraping with intelligent subreddit discovery"""
    
    @token_required
    def post(self, current_user):
        """
        Start a Reddit scraping job with intelligent subreddit discovery
        
        Request body:
        - topic (str, required): The topic or product to search for
        - limit (int, optional): Maximum number of posts to retrieve (default: 100)
        - time_filter (str, optional): Time filter ('hour', 'day', 'week', 'month', 'year', 'all') (default: 'month')
        - is_custom (bool, optional): Whether this is a custom prompt (default: False)
        - subreddits (list, optional): User-provided subreddits. If not provided, Claude will suggest them.
        
        Returns:
            JSON response with job_id and status
        """
        from app import data_store
        from reddit_scraper import RedditScraper
        from claude_analyzer import ClaudeAnalyzer
        from bson import ObjectId
        
        username = current_user.get('username')
        
        try:
            # Get request data
            data = request.get_json() or {}
            
            # Validate required fields
            topic = data.get('topic', '').strip()
            if not topic:
                return {"status": "error", "message": "Topic is required"}, 400
            
            # Get optional parameters
            limit = data.get('limit', 100)
            time_filter = data.get('time_filter', 'month')
            is_custom = data.get('is_custom', False)
            user_subreddits = data.get('subreddits')  # Can be None or a list
            
            # Validate time_filter
            valid_time_filters = ['hour', 'day', 'week', 'month', 'year', 'all']
            if time_filter not in valid_time_filters:
                return {"status": "error", "message": f"Invalid time_filter. Must be one of: {', '.join(valid_time_filters)}"}, 400
            
            # Clean up any dead threads for this user (allow multiple concurrent jobs)
            if username in data_store.user_scraping_jobs:
                user_jobs = data_store.user_scraping_jobs[username]
                # Handle both old format (single dict/thread) and new format (list)
                if isinstance(user_jobs, list):
                    # New format: filter out dead threads
                    alive_jobs = []
                    for job_data in user_jobs:
                        thread = job_data.get('thread') if isinstance(job_data, dict) else job_data
                        if thread and thread.is_alive():
                            alive_jobs.append(job_data)
                    # Update the list (empty list means no active jobs)
                    if alive_jobs:
                        data_store.user_scraping_jobs[username] = alive_jobs
                    else:
                        del data_store.user_scraping_jobs[username]
                else:
                    # Old format: check if single thread is alive
                    if isinstance(user_jobs, dict):
                        active_thread = user_jobs.get('thread')
                    else:
                        active_thread = user_jobs
                    if not active_thread or not active_thread.is_alive():
                        # Clean up dead thread
                        del data_store.user_scraping_jobs[username]
            
            # Determine subreddits to use
            subreddits_to_use = None
            claude_suggestions = None
            
            if user_subreddits:
                # User provided subreddits - use them directly
                if isinstance(user_subreddits, str):
                    # Handle comma-separated string
                    subreddits_to_use = [s.strip() for s in user_subreddits.split(',') if s.strip()]
                elif isinstance(user_subreddits, list):
                    subreddits_to_use = [s.strip() if isinstance(s, str) else str(s) for s in user_subreddits if s]
                else:
                    return {"status": "error", "message": "subreddits must be a list or comma-separated string"}, 400
                
                logger.info(f"User {username} provided subreddits: {subreddits_to_use}")
            else:
                # No user subreddits provided - use Claude to suggest them
                try:
                    logger.info(f"Requesting subreddit suggestions from Claude for topic: {topic}")
                    analyzer = ClaudeAnalyzer()
                    
                    if not analyzer.api_key or not analyzer.client:
                        # Fallback to generic subreddits if Claude API is not configured
                        logger.warning("Claude API not configured, using generic subreddits")
                        subreddits_to_use = ["technology", "software", "productivity", "business", "entrepreneur"]
                    else:
                        claude_suggestions = analyzer.suggest_subreddits(topic, is_custom_prompt=is_custom)
                        
                        if claude_suggestions.get('error'):
                            # Claude API failed - use generic fallback
                            logger.warning(f"Claude API error: {claude_suggestions.get('error')}, using generic subreddits")
                            subreddits_to_use = ["technology", "software", "productivity", "business", "entrepreneur"]
                        else:
                            subreddits_to_use = claude_suggestions.get('subreddits', [])
                            
                            if not subreddits_to_use or len(subreddits_to_use) == 0:
                                # Empty response - use generic fallback
                                logger.warning("Claude returned empty subreddits, using generic subreddits")
                                subreddits_to_use = ["technology", "software", "productivity", "business", "entrepreneur"]
                            
                            logger.info(f"Claude suggested subreddits for '{topic}': {subreddits_to_use}")
                
                except Exception as e:
                    # Handle any errors in Claude API call
                    logger.error(f"Error getting subreddit suggestions from Claude: {str(e)}", exc_info=True)
                    # Fallback to generic subreddits
                    subreddits_to_use = ["technology", "software", "productivity", "business", "entrepreneur"]
                    claude_suggestions = None
            
            # Prepare job parameters
            job_parameters = {
                'topic': topic,
                'limit': limit,
                'time_filter': time_filter,
                'is_custom': is_custom,
                'subreddits': subreddits_to_use
            }
            
            # Add Claude suggestions if available (for reference)
            if claude_suggestions and 'search_queries' in claude_suggestions:
                job_parameters['claude_search_queries'] = claude_suggestions['search_queries']
            
            # Create job in database
            job_id = data_store.create_job(username, job_parameters)
            
            if not job_id:
                return {"status": "error", "message": "Failed to create job"}, 500
            
            # Initialize Reddit scraper
            scraper = RedditScraper()
            reddit_client_id = os.getenv("REDDIT_CLIENT_ID")
            reddit_client_secret = os.getenv("REDDIT_CLIENT_SECRET")
            
            if not reddit_client_id or not reddit_client_secret:
                # Update job status to failed
                data_store.update_job_status(
                    job_id,
                    'failed',
                    error="Reddit API credentials not configured"
                )
                return {"status": "error", "message": "Reddit API credentials not configured"}, 500
            
            if not scraper.initialize_client(reddit_client_id, reddit_client_secret):
                # Update job status to failed
                data_store.update_job_status(
                    job_id,
                    'failed',
                    error="Failed to initialize Reddit client"
                )
                return {"status": "error", "message": "Failed to initialize Reddit client"}, 500
            
            # Define background scraping function
            def background_scrape():
                """Background function to perform the actual scraping"""
                job_start_time = datetime.now(timezone.utc)
                try:
                    # Update job status to in_progress
                    if not data_store.update_job_status(job_id, 'in_progress'):
                        logger.error(f"Failed to update job {job_id} to in_progress status")
                    data_store.append_job_log(job_id, "subreddits", "Subreddits to search", subreddits_to_use)
                    
                    # Get search queries from Claude suggestions or use default
                    search_queries = None
                    if claude_suggestions and 'search_queries' in claude_suggestions:
                        search_queries = claude_suggestions['search_queries']
                    if search_queries:
                        data_store.append_job_log(job_id, "search_queries", "Search queries", search_queries)
                    else:
                        data_store.append_job_log(job_id, "search_queries", "Using default product mention queries", None)
                    
                    data_store.append_job_log(job_id, "find_posts", f"Started Reddit search (pulling up to {limit} posts)", limit)
                    # Perform scraping
                    all_posts = []
                    
                    try:
                        if search_queries:
                            # Use Claude's suggested search queries
                            per_query = limit // len(search_queries) if len(search_queries) > 0 else limit
                            for query in search_queries:
                                try:
                                    posts = scraper.search_reddit(
                                        query=query,
                                        subreddits=subreddits_to_use,
                                        limit=per_query,
                                        time_filter=time_filter,
                                        timeout_per_subreddit=300  # 5 minutes per subreddit
                                    )
                                    all_posts.extend(posts)
                                    data_store.append_job_log(job_id, "find_posts", f"Pulled {len(posts)} posts for query \"{query[:40]}{'…' if len(query) > 40 else ''}\" (total so far: {len(all_posts)})", {"query": query, "batch": len(posts), "total": len(all_posts)})
                                except TimeoutError as te:
                                    logger.warning(f"Timeout while searching for query '{query}' in job {job_id}: {str(te)}")
                                    # Continue with other queries
                                except Exception as query_error:
                                    logger.error(f"Error searching for query '{query}' in job {job_id}: {str(query_error)}", exc_info=True)
                                    # Continue with other queries
                        else:
                            # Use default search queries
                            try:
                                posts = scraper.scrape_product_mentions(
                                    product_name=topic,
                                    limit=limit,
                                    subreddits=subreddits_to_use,
                                    time_filter=time_filter,
                                    timeout_per_subreddit=300  # 5 minutes per subreddit
                                )
                                all_posts.extend(posts)
                                data_store.append_job_log(job_id, "find_posts", f"Pulled {len(posts)} Reddit posts (target up to {limit})", {"batch": len(posts), "total": len(all_posts)})
                            except TimeoutError as te:
                                logger.warning(f"Timeout while scraping product mentions for job {job_id}: {str(te)}")
                                # Job will complete with whatever posts were found (if any)
                            except Exception as scrape_error:
                                logger.error(f"Error scraping product mentions for job {job_id}: {str(scrape_error)}", exc_info=True)
                                raise  # Re-raise to be caught by outer exception handler
                    except TimeoutError as te:
                        # If all scraping operations timed out, mark job as failed
                        logger.error(f"All scraping operations timed out for job {job_id}: {str(te)}")
                        raise  # Re-raise to be caught by outer exception handler
                    
                    data_store.append_job_log(job_id, "find_posts", f"Done. Found {len(all_posts)} posts.", len(all_posts))
                    # Save posts to database with job topic as product so they appear in correct product tables
                    posts_saved = 0
                    for post in all_posts:
                        if data_store.save_post(post, product=topic):
                            posts_saved += 1
                    data_store.append_job_log(job_id, "save_posts", f"Saved {posts_saved} posts to database.", posts_saved)
                    
                    # Calculate job duration
                    job_duration = datetime.now(timezone.utc) - job_start_time
                    duration_minutes = int(job_duration.total_seconds() / 60)
                    
                    # Log warning if job took longer than 15 minutes
                    if duration_minutes > 15:
                        logger.warning(f"Job {job_id} took {duration_minutes} minutes to complete (longer than expected)")
                    
                    # Update job status to completed
                    results = {
                        'posts_count': posts_saved,
                        'total_posts_found': len(all_posts),
                        'subreddits_used': subreddits_to_use,
                        'topic': topic,
                        'duration_minutes': duration_minutes
                    }
                    
                    if not data_store.update_job_status(job_id, 'completed', results=results):
                        logger.error(f"Failed to update job {job_id} to completed status")
                    else:
                        logger.info(f"Scraping job {job_id} completed successfully in {duration_minutes} minutes. Found {posts_saved} posts.")
                    data_store.append_job_log(job_id, "completed", f"Job completed. {posts_saved} posts saved in {duration_minutes} minutes.", results)
                    
                except TimeoutError as te:
                    # Handle timeout errors specifically
                    job_duration = datetime.now(timezone.utc) - job_start_time
                    duration_minutes = int(job_duration.total_seconds() / 60)
                    error_msg = f"Job timed out after {duration_minutes} minutes: {str(te)}"
                    logger.error(f"Timeout in background scraping for job {job_id}: {error_msg}")
                    
                    # Update job status to failed with timeout error
                    data_store.append_job_log(job_id, "failed", error_msg, None)
                    if not data_store.update_job_status(job_id, 'failed', error=error_msg):
                        logger.error(f"Failed to update job {job_id} to failed status after timeout")
                except Exception as e:
                    # Handle all other exceptions
                    job_duration = datetime.now(timezone.utc) - job_start_time
                    duration_minutes = int(job_duration.total_seconds() / 60)
                    error_msg = f"Error after {duration_minutes} minutes: {str(e)}"
                    logger.error(f"Error in background scraping for job {job_id}: {error_msg}", exc_info=True)
                    
                    # Update job status to failed
                    data_store.append_job_log(job_id, "failed", error_msg, None)
                    if not data_store.update_job_status(job_id, 'failed', error=error_msg):
                        logger.error(f"Failed to update job {job_id} to failed status after error")
                finally:
                    # Clean up thread tracking for this specific job
                    if username in data_store.user_scraping_jobs:
                        user_jobs = data_store.user_scraping_jobs[username]
                        if isinstance(user_jobs, list):
                            # New format: remove this specific job from the list
                            data_store.user_scraping_jobs[username] = [
                                job_data for job_data in user_jobs 
                                if job_data.get('job_id') != job_id
                            ]
                            # Remove the key if list is empty
                            if not data_store.user_scraping_jobs[username]:
                                del data_store.user_scraping_jobs[username]
                        else:
                            # Old format: check if this is the job we're cleaning up
                            if isinstance(user_jobs, dict) and user_jobs.get('job_id') == job_id:
                                del data_store.user_scraping_jobs[username]
                            elif not isinstance(user_jobs, dict):
                                # Legacy format - just remove it
                                del data_store.user_scraping_jobs[username]
            
            # Start background thread
            thread = Thread(target=background_scrape, daemon=True)
            thread.start()
            
            # Track the thread with start time and job_id for health monitoring
            job_data = {
                'thread': thread,
                'start_time': datetime.now(timezone.utc),
                'job_id': job_id
            }
            
            # Add to list of jobs for this user (support multiple concurrent jobs)
            if username not in data_store.user_scraping_jobs:
                data_store.user_scraping_jobs[username] = []
            elif not isinstance(data_store.user_scraping_jobs[username], list):
                # Convert old format to new format
                old_job = data_store.user_scraping_jobs[username]
                data_store.user_scraping_jobs[username] = [old_job] if old_job else []
            
            data_store.user_scraping_jobs[username].append(job_data)
            
            return {
                "status": "success",
                "message": "Scraping job started",
                "job_id": str(job_id),
                "topic": topic,
                "subreddits": subreddits_to_use
            }, 200
            
        except Exception as e:
            logger.error(f"Error starting scrape job: {str(e)}", exc_info=True)
            return {"status": "error", "message": str(e)}, 500


class GetAnalytics(CORSResource):
    """API endpoint to get analytics data for the Status page"""
    @token_required
    def get(self, current_user):
        """
        Get analytics data including active jobs, posts viewed, and statistics
        
        Returns:
            JSON response with analytics information
        """
        from app import data_store  # Lazy import to avoid circular dependencies
        
        username = current_user.get('username')
        
        try:
            # Get active jobs (pending or in_progress)
            active_jobs = []
            if data_store.db is not None:
                active_jobs = list(data_store.db.jobs.find({
                    "user_id": username,
                    "status": {"$in": ["pending", "in_progress"]}
                }).sort("created_at", -1))
                
                # Convert ObjectId to string and serialize datetimes
                serialized_active_jobs = []
                for job in active_jobs:
                    job['_id'] = str(job['_id'])
                    job = serialize_datetime(job)
                    serialized_active_jobs.append(job)
                active_jobs = serialized_active_jobs
            
            # Get job statistics
            total_jobs = 0
            completed_jobs = 0
            failed_jobs = 0
            if data_store.db is not None:
                total_jobs = data_store.db.jobs.count_documents({"user_id": username})
                completed_jobs = data_store.db.jobs.count_documents({
                    "user_id": username,
                    "status": "completed"
                })
                failed_jobs = data_store.db.jobs.count_documents({
                    "user_id": username,
                    "status": "failed"
                })
            
            # Get posts statistics
            total_posts = 0
            analyzed_posts = 0
            pain_points_count = 0
            if data_store.db is not None:
                total_posts = data_store.db.posts.count_documents({})
                analyzed_posts = data_store.db.posts.count_documents({"sentiment": {"$exists": True}})
                pain_points_count = data_store.db.pain_points.count_documents({})
            
            # Get recent activity (last 7 days of jobs)
            recent_activity = []
            if data_store.db is not None:
                from datetime import datetime, timedelta, timezone
                seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
                recent_activity = list(data_store.db.jobs.find({
                    "user_id": username,
                    "created_at": {"$gte": seven_days_ago}
                }).sort("created_at", -1).limit(10))
                
                # Convert ObjectId to string and format dates
                serialized_activity = []
                for job in recent_activity:
                    job['_id'] = str(job['_id'])
                    job = serialize_datetime(job)
                    serialized_activity.append(job)
                recent_activity = serialized_activity
            
            return {
                "status": "success",
                "active_jobs": active_jobs,
                "active_jobs_count": len(active_jobs),
                "job_stats": {
                    "total": total_jobs,
                    "completed": completed_jobs,
                    "failed": failed_jobs,
                    "pending": len([j for j in active_jobs if j.get('status') == 'pending']),
                    "in_progress": len([j for j in active_jobs if j.get('status') == 'in_progress'])
                },
                "posts_stats": {
                    "total": total_posts,
                    "analyzed": analyzed_posts,
                    "pain_points": pain_points_count
                },
                "recent_activity": recent_activity
            }
        except Exception as e:
            logger.error(f"Error fetching analytics: {str(e)}", exc_info=True)
            return {"status": "error", "message": str(e)}, 500


class CancelJob(CORSResource):
    """API endpoint to cancel a job and refund 1 credit"""
    @token_required
    def post(self, current_user, job_id=None):
        """
        Cancel a job and refund 1 credit to the user
        
        Args:
            current_user: Authenticated user (from token_required decorator)
            job_id: Job ID to cancel
        
        Returns:
            JSON response with cancellation status
        """
        from app import data_store  # Lazy import to avoid circular dependencies
        from bson import ObjectId
        from datetime import datetime, timezone
        
        username = current_user.get('username')
        
        if not job_id:
            return {"status": "error", "message": "Job ID is required"}, 400
        
        try:
            # Convert job_id to ObjectId
            try:
                job_object_id = ObjectId(job_id)
            except:
                return {"status": "error", "message": "Invalid job ID"}, 400
            
            # Get the job
            if data_store.db is None:
                return {"status": "error", "message": "Database not available"}, 500
            
            job = data_store.db.jobs.find_one({"_id": job_object_id})
            
            if not job:
                return {"status": "error", "message": "Job not found"}, 404
            
            # Verify ownership
            if job.get('user_id') != username:
                return {"status": "error", "message": "Access denied"}, 403
            
            # Check if job can be cancelled (only pending or in_progress)
            if job.get('status') not in ['pending', 'in_progress']:
                return {
                    "status": "error", 
                    "message": f"Cannot cancel job with status: {job.get('status')}"
                }, 400
            
            # Update job status to cancelled
            update_result = data_store.update_job_status(
                job_object_id,
                'cancelled',
                completed_at=datetime.now(timezone.utc),
                error="Job cancelled by user"
            )
            
            if not update_result:
                return {"status": "error", "message": "Failed to update job status"}, 500
            
            # Refund 1 credit to the user
            # Get current user credits
            user = data_store.db.users.find_one({"username": username})
            if not user:
                return {"status": "error", "message": "User not found"}, 404
            
            # Add 1 credit using atomic operation
            refund_result = data_store.db.users.find_one_and_update(
                {"username": username},
                {"$inc": {"credits": 1}},
                return_document=True
            )
            
            if not refund_result:
                logger.warning(f"Failed to refund credit for user {username}, but job was cancelled")
                # Job is already cancelled, so we'll return success but log the warning
            
            logger.info(f"Job {job_id} cancelled by user {username}, 1 credit refunded")
            
            return {
                "status": "success",
                "message": "Job cancelled successfully. 1 credit has been refunded.",
                "job_id": job_id,
                "new_credits": refund_result.get('credits') if refund_result else None
            }
            
        except Exception as e:
            logger.error(f"Error cancelling job: {str(e)}", exc_info=True)
            return {"status": "error", "message": str(e)}, 500

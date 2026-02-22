import os
import logging
import time
from datetime import datetime, timezone
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, OperationFailure

logger = logging.getLogger(__name__)

class MongoDBStore:
    """MongoDB data store for Reddit scraper application"""
    
    def __init__(self, mongodb_uri=None):
        """Initialize MongoDB connection"""
        self.mongodb_uri = mongodb_uri or os.getenv("MONGODB_URI")
        self.client = None
        self.db = None
        self.scrape_in_progress = False
        self.user_scraping_jobs = {}  # Track active scraping jobs per user: {username: [thread_data1, thread_data2, ...]}
        self.pain_points = {}
        self.raw_posts = []
        self.analyzed_posts = []
        self.subreddits_scraped = set()
        self.last_scrape_time = None
        self.anthropic_analyses = {}
        
        # Connect to MongoDB if URI is provided
        if self.mongodb_uri:
            self.connect()
    
    def connect(self):
        """Connect to MongoDB database"""
        try:
            self.client = MongoClient(self.mongodb_uri)
            # Test connection
            self.client.admin.command('ping')
            # Use 'reddit_scraper' database
            self.db = self.client.reddit_scraper
            logger.info("Connected to MongoDB successfully")
            
            # Load current metadata if available
            self._load_metadata()
            self.load_pain_points()
            # Create database indexes for performance
            self.create_indexes()
            return True
        except ConnectionFailure as e:
            logger.error(f"Failed to connect to MongoDB: {str(e)}")
            return False
        except Exception as e:
            logger.error(f"Error connecting to MongoDB: {str(e)}")
            return False
    
    def create_indexes(self):
        """Create database indexes for performance"""
        if self.db is None:
            logger.warning("Cannot create indexes: Database connection not established")
            return
        
        try:
            # Create indexes on posts collection (compound for analysis queries by product + subreddit)
            self.db.posts.create_index("created_utc")
            self.db.posts.create_index("score")
            self.db.posts.create_index("subreddit")
            self.db.posts.create_index("product")
            self.db.posts.create_index([("product", 1), ("subreddit", 1)])
            self.db.posts.create_index("products")
            self.db.posts.create_index("sentiment")
            self.db.posts.create_index([("products", 1), ("score", -1)])
            
            # Create indexes on pain_points collection
            self.db.pain_points.create_index("product")
            self.db.pain_points.create_index("severity")
            self.db.pain_points.create_index([("product", 1), ("severity", -1)])
            
            # Create indexes on users collection
            self.db.users.create_index("username", unique=True)
            self.db.users.create_index("email")
            
            # Create indexes on anthropic_analysis collection (user-scoped)
            self.db.anthropic_analysis.create_index("product")
            self.db.anthropic_analysis.create_index([("user_id", 1), ("product", 1)], unique=True)
            
            # Create indexes on recommendations collection (user-scoped; one doc per user+product+recommendation_type)
            self.db.recommendations.create_index("product")
            # Drop legacy unique index on (user_id, product) so we can store multiple types per product
            try:
                self.db.recommendations.drop_index("user_id_1_product_1")
            except Exception:
                pass
            self.db.recommendations.create_index(
                [("user_id", 1), ("product", 1), ("recommendation_type", 1)],
                unique=True,
            )
            
            # pain_points: user_id for user-scoped clear
            self.db.pain_points.create_index([("user_id", 1), ("product", 1)])
            
            # Create indexes on jobs collection
            self.db.jobs.create_index("user_id")
            self.db.jobs.create_index("status")
            self.db.jobs.create_index([("user_id", 1), ("created_at", -1)])
            
            logger.info("Database indexes created successfully")
        except ConnectionFailure as e:
            logger.error(f"Failed to connect to MongoDB: {str(e)}")
            return False
        except Exception as e:
            logger.error(f"Error creating indexes: {str(e)}")
    
    def _load_metadata(self):
        """Load metadata from database"""
        try:
            # Fix the comparison with None instead of bool testing
            if self.db is not None:
                metadata = self.db.metadata.find_one({"_id": "scraper_metadata"})
                if metadata:
                    self.scrape_in_progress = metadata.get("scrape_in_progress", False)
                    self.last_scrape_time = metadata.get("last_updated")
                    logger.info(f"Loaded metadata, scrape_in_progress: {self.scrape_in_progress}")
        except Exception as e:
            logger.error(f"Error loading metadata: {str(e)}")
    
    def update_metadata(self, scrape_in_progress=None, products=None, subreddits=None, time_filter=None):
        """Update scraper metadata in the database"""
        # Fix the comparison with None instead of bool testing
        if self.db is None:
            logger.error("Cannot update metadata: Database connection not established")
            return False
        
        try:
            # Prepare update data
            update_data = {"last_updated": datetime.now(timezone.utc)}
            
            # Only update fields that are provided
            if scrape_in_progress is not None:
                update_data["scrape_in_progress"] = scrape_in_progress
                self.scrape_in_progress = scrape_in_progress
            
            if products:
                update_data["products"] = products
                
            if subreddits:
                update_data["subreddits"] = subreddits
                if subreddits:
                    self.subreddits_scraped.update(subreddits)
                
            if time_filter:
                update_data["time_filter"] = time_filter
            
            # Update or insert metadata document
            result = self.db.metadata.update_one(
                {"_id": "scraper_metadata"},
                {"$set": update_data},
                upsert=True
            )
            
            self.last_scrape_time = update_data["last_updated"]
            
            logger.info(f"Updated metadata: {update_data}")
            return True
        except Exception as e:
            logger.error(f"Error updating metadata: {str(e)}")
            return False
    def save_post(self, post, product=None):
        """Save Reddit post to database. Optionally set product (topic) for job-scraped posts."""
        # Fix the comparison with None instead of bool testing
        if self.db is None:
            logger.error("Cannot save post: Database connection not established")
            return False
        
        try:
            # Convert post object to dictionary if needed
            if hasattr(post, 'to_dict'):
                post_data = post.to_dict()
            elif isinstance(post, dict):
                post_data = post.copy()
            else:
                # Try to convert object attributes to dictionary
                post_data = {}
                for attr in dir(post):
                    if not attr.startswith('__') and not callable(getattr(post, attr)):
                        post_data[attr] = getattr(post, attr)
            
            # Add timestamp if not present
            if 'created_at' not in post_data:
                post_data['created_at'] = datetime.now(timezone.utc)
            
            if product is not None:
                post_data['product'] = product
            
            # Get post ID - either from id attribute or from the 'id' key
            post_id = None
            if hasattr(post, 'id'):
                post_id = post.id
            elif 'id' in post_data:
                post_id = post_data['id']
                
            if not post_id:
                logger.error("Cannot save post: No ID available")
                return False
                
            # Use post ID as document ID
            post_data['_id'] = post_id
            
            # Convert any non-serializable objects to strings
            for key, value in post_data.items():
                if not isinstance(value, (str, int, float, bool, list, dict, datetime, type(None))):
                    post_data[key] = str(value)
            
            # Insert or update post
            result = self.db.posts.update_one(
                {"_id": post_data['_id']},
                {"$set": post_data},
                upsert=True
            )
            
            # Add to raw_posts list if it's not already there
            if post_id not in [p.id if hasattr(p, 'id') else p.get('id', None) for p in self.raw_posts]:
                self.raw_posts.append(post)
            
            return True
        except Exception as e:
            logger.error(f"Error saving post: {str(e)}")
            return False
    def save_recommendations(self, product, recommendations, user_id=None, recommendation_type="improve_product", summary=None, timestamp=None):
        """Save recommendations to database. If user_id is set, document is user-scoped.
        recommendation_type: improve_product, new_feature, or competing_product. One doc per (user, product, type)."""
        if self.db is None:
            logger.error("Cannot save recommendations: Database connection not established")
            return False

        try:
            product_normalized = product.strip().lower()
            type_val = (recommendation_type or "improve_product").strip().lower()
            if type_val not in ("improve_product", "new_feature", "competing_product"):
                type_val = "improve_product"
            recommendations_data = {
                "product": product_normalized,
                "recommendations": recommendations,
                "recommendation_type": type_val,
                "created_at": datetime.now(timezone.utc)
            }
            if summary is not None:
                recommendations_data["summary"] = summary
            if timestamp is not None:
                recommendations_data["timestamp"] = timestamp
            if user_id:
                recommendations_data["user_id"] = user_id
                recommendations_data["_id"] = f"{user_id}:{product_normalized}:{type_val}"
            else:
                recommendations_data["_id"] = f"{product_normalized}:{type_val}"

            result = self.db.recommendations.update_one(
                {"_id": recommendations_data["_id"]},
                {"$set": recommendations_data},
                upsert=True
            )
            logger.info(f"Saved recommendations for {product} (type={type_val})" + (f" (user={user_id})" if user_id else ""))
            return True
        except Exception as e:
            logger.error(f"Error saving recommendations: {str(e)}")
            return False
    
    def save_pain_point(self, pain_point):
        """Save pain point to database and local cache"""
        # Fix the comparison with None instead of bool testing
        if self.db is None:
            logger.error("Cannot save pain point: Database connection not established")
            return False
        
        try:
            # Convert pain point object to dictionary if needed
            pain_data = pain_point.to_dict() if hasattr(pain_point, 'to_dict') else pain_point
            
            # Add timestamp if not present
            if 'created_at' not in pain_data:
                pain_data['created_at'] = datetime.now(timezone.utc)
            
            # Use custom ID or generate one (include user_id when present for user-scoping)
            user_part = pain_data.get('user_id', '') or ''
            pain_id = pain_data.get('id', str(hash(f"{user_part}_{pain_data['product']}_{pain_data['topic']}")))
            pain_data['_id'] = pain_id
            
            # Update local cache
            self.pain_points[pain_id] = pain_point
            
            # Insert or update in database
            result = self.db.pain_points.update_one(
                {"_id": pain_id},
                {"$set": pain_data},
                upsert=True
            )
            
            return True
        except Exception as e:
            logger.error(f"Error saving pain point: {str(e)}")
            return False
    
    def save_anthropic_analysis(self, product, analysis, user_id=None):
        """Save Anthropic analysis to database. If user_id is set, document is user-scoped."""
        if self.db is None:
            logger.error("Cannot save Anthropic analysis: Database connection not established")
            return False

        try:
            product_normalized = product.strip().lower()
            analysis_data = {
                "product": product_normalized,
                "analysis": analysis,
                "created_at": datetime.now(timezone.utc)
            }
            if user_id:
                analysis_data["user_id"] = user_id
                analysis_data["_id"] = f"{user_id}:{product_normalized}"
            else:
                analysis_data["_id"] = product_normalized

            result = self.db.anthropic_analysis.update_one(
                {"_id": analysis_data["_id"]},
                {"$set": analysis_data},
                upsert=True
            )
            logger.info(f"Saved Anthropic analysis for {product}" + (f" (user={user_id})" if user_id else ""))
            self.anthropic_analyses[product] = analysis
            return True
        except Exception as e:
            logger.error(f"Error saving Anthropic analysis: {str(e)}")
            return False

    def delete_anthropic_analysis(self, product, user_id=None):
        """Delete analysis for a product (for regenerate). If user_id given, delete only that user's doc."""
        if self.db is None:
            logger.error("Cannot delete Anthropic analysis: Database connection not established")
            return False
        try:
            product_normalized = product.strip().lower()
            if user_id:
                doc_id = f"{user_id}:{product_normalized}"
                result = self.db.anthropic_analysis.delete_one({"_id": doc_id})
            else:
                result = self.db.anthropic_analysis.delete_one({"_id": product_normalized})
            if result.deleted_count:
                logger.info(f"Deleted Anthropic analysis for {product}" + (f" (user={user_id})" if user_id else ""))
            if product in self.anthropic_analyses:
                del self.anthropic_analyses[product]
            return True
        except Exception as e:
            logger.error(f"Error deleting Anthropic analysis: {str(e)}")
            return False

    def delete_pain_points_by_product(self, product, user_id=None):
        """Delete pain points for a product (for regenerate). If user_id given, delete only that user's."""
        if self.db is None:
            return False
        try:
            product_normalized = product.strip().lower()
            query = {"product": product_normalized}
            if user_id:
                query["user_id"] = user_id
            result = self.db.pain_points.delete_many(query)
            if result.deleted_count:
                logger.info(f"Deleted {result.deleted_count} pain points for {product}" + (f" (user={user_id})" if user_id else ""))
            return True
        except Exception as e:
            logger.error(f"Error deleting pain points by product: {str(e)}")
            return False

    def delete_recommendations_by_product(self, product, user_id=None):
        """Delete all recommendation docs for a product (all types). If user_id given, only that user's docs."""
        if self.db is None:
            return False
        try:
            product_normalized = product.strip().lower()
            if user_id:
                result = self.db.recommendations.delete_many({"product": product_normalized, "user_id": user_id})
            else:
                result = self.db.recommendations.delete_many({"product": product_normalized})
            if result.deleted_count:
                logger.info(f"Deleted {result.deleted_count} recommendation(s) for {product}" + (f" (user={user_id})" if user_id else ""))
            return True
        except Exception as e:
            logger.error(f"Error deleting recommendations by product: {str(e)}")
            return False

    def load_pain_points(self):
        """Load pain points from database to local cache"""
        # Fix the comparison with None instead of bool testing
        if self.db is None:
            logger.error("Cannot load pain points: Database connection not established")
            return
        
        try:
            # Clear current cache
            self.pain_points = {}
            
            # Query all pain points from database
            pain_points_cursor = self.db.pain_points.find({})
            
            # Rebuild cache
            for pain_point in pain_points_cursor:
                pain_id = pain_point['_id']
                self.pain_points[pain_id] = pain_point
                
            logger.info(f"Loaded {len(self.pain_points)} pain points from database")
        except Exception as e:
            logger.error(f"Error loading pain points: {str(e)}")
    
    def create_job(self, user_id, parameters):
        """Create a new job document in the database
        
        Args:
            user_id: Username of the job owner
            parameters: Dictionary containing job parameters (topic, limit, time_filter, is_custom, etc.)
        
        Returns:
            job_id (ObjectId) if successful, None otherwise
        """
        if self.db is None:
            logger.error("Cannot create job: Database connection not established")
            return None
        
        try:
            job_data = {
                "user_id": user_id,
                "status": "pending",
                "created_at": datetime.now(timezone.utc),
                "parameters": parameters,
                "results": None,
                "error": None,
                "credits_used": None,
                "logs": [],
            }
            
            result = self.db.jobs.insert_one(job_data)
            logger.info(f"Created job {result.inserted_id} for user {user_id}")
            return result.inserted_id
        except Exception as e:
            logger.error(f"Error creating job: {str(e)}")
            return None
    
    def update_job_status(self, job_id, status, **updates):
        """Update job status and optional fields with retry logic
        
        Args:
            job_id: ObjectId of the job to update
            status: New status (pending, in_progress, completed, failed)
            **updates: Additional fields to update (started_at, completed_at, results, error, credits_used)
        
        Returns:
            True if successful, False otherwise
        """
        if self.db is None:
            logger.error("Cannot update job: Database connection not established")
            return False
        
        max_retries = 3
        retry_count = 0
        
        while retry_count < max_retries:
            try:
                update_data = {"status": status}
                
                if status == "in_progress" and "started_at" not in updates:
                    update_data["started_at"] = datetime.now(timezone.utc)
                
                if status in ["completed", "failed", "cancelled"] and "completed_at" not in updates:
                    update_data["completed_at"] = datetime.now(timezone.utc)
                
                # Add any additional fields
                update_data.update(updates)
                
                result = self.db.jobs.update_one(
                    {"_id": job_id},
                    {"$set": update_data}
                )
                
                if result.modified_count > 0:
                    if retry_count > 0:
                        logger.info(f"Updated job {job_id} to status {status} after {retry_count} retries")
                    else:
                        logger.info(f"Updated job {job_id} to status {status}")
                    return True
                else:
                    # Job not found or not modified - don't retry for this case
                    logger.warning(f"Job {job_id} not found or not modified")
                    return False
                    
            except ConnectionFailure as e:
                retry_count += 1
                if retry_count < max_retries:
                    logger.warning(f"Database connection error updating job {job_id} (attempt {retry_count}/{max_retries}): {str(e)}")
                    time.sleep(1 * retry_count)  # Exponential backoff: 1s, 2s, 3s
                else:
                    logger.error(f"Failed to update job {job_id} after {max_retries} retries due to connection errors: {str(e)}")
                    return False
            except OperationFailure as e:
                retry_count += 1
                if retry_count < max_retries:
                    logger.warning(f"Database operation error updating job {job_id} (attempt {retry_count}/{max_retries}): {str(e)}")
                    time.sleep(1 * retry_count)  # Exponential backoff
                else:
                    logger.error(f"Failed to update job {job_id} after {max_retries} retries due to operation errors: {str(e)}")
                    return False
            except Exception as e:
                # For other exceptions, don't retry (likely programming errors)
                logger.error(f"Error updating job status: {str(e)}", exc_info=True)
                return False
        
        return False
    
    def append_job_log(self, job_id, step, message, details=None):
        """Append a log entry to a job's logs array for pipeline step tracking.
        
        Args:
            job_id: ObjectId or string representation of the job ID
            step: Step name (e.g. 'subreddits', 'search_queries', 'find_posts', 'save_posts', 'completed', 'failed')
            message: Human-readable message
            details: Optional extra data (list, str, or dict; must be JSON-serializable)
        
        Returns:
            True if successful, False otherwise
        """
        if self.db is None:
            logger.error("Cannot append job log: Database connection not established")
            return False
        try:
            from bson import ObjectId
            if isinstance(job_id, str):
                try:
                    job_id = ObjectId(job_id)
                except Exception:
                    logger.error(f"Invalid job_id format for append_job_log: {job_id}")
                    return False
            entry = {
                "step": step,
                "message": message,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
            if details is not None:
                entry["details"] = details
            result = self.db.jobs.update_one(
                {"_id": job_id},
                {"$push": {"logs": entry}}
            )
            if result.modified_count == 0:
                logger.warning(f"append_job_log: job {job_id} not found or not modified")
                return False
            on_job_log = getattr(self, "on_job_log", None)
            if callable(on_job_log):
                on_job_log(job_id, entry)
            return True
        except Exception as e:
            logger.error(f"Error appending job log: {str(e)}", exc_info=True)
            return False
    
    def get_user_jobs(self, user_id, status=None):
        """Get user's jobs, optionally filtered by status
        
        Args:
            user_id: Username of the job owner
            status: Optional status filter (pending, in_progress, completed, failed)
        
        Returns:
            List of job documents sorted by created_at descending
        """
        if self.db is None:
            logger.error("Cannot get user jobs: Database connection not established")
            return []
        
        try:
            query = {"user_id": user_id}
            if status:
                query["status"] = status
            
            jobs = list(self.db.jobs.find(query).sort("created_at", -1))
            
            # Convert ObjectId to string for JSON serialization
            for job in jobs:
                job["_id"] = str(job["_id"])
                if "logs" not in job:
                    job["logs"] = []
                # Convert datetime objects to ISO format strings
                for key in ["created_at", "started_at", "completed_at"]:
                    if key in job and job[key]:
                        if isinstance(job[key], datetime):
                            job[key] = job[key].isoformat()
            
            logger.info(f"Retrieved {len(jobs)} jobs for user {user_id}" + (f" with status {status}" if status else ""))
            return jobs
        except Exception as e:
            logger.error(f"Error getting user jobs: {str(e)}")
            return []
    
    def get_job(self, job_id):
        """Get specific job details
        
        Args:
            job_id: ObjectId or string representation of the job ID
        
        Returns:
            Job document if found, None otherwise
        """
        if self.db is None:
            logger.error("Cannot get job: Database connection not established")
            return None
        
        try:
            from bson import ObjectId
            
            # Convert string to ObjectId if needed
            if isinstance(job_id, str):
                try:
                    job_id = ObjectId(job_id)
                except Exception:
                    logger.error(f"Invalid job_id format: {job_id}")
                    return None
            
            job = self.db.jobs.find_one({"_id": job_id})
            
            if job:
                # Convert ObjectId to string
                job["_id"] = str(job["_id"])
                # Ensure logs array exists (for jobs created before pipeline logging)
                if "logs" not in job:
                    job["logs"] = []
                # Convert datetime objects to ISO format strings
                for key in ["created_at", "started_at", "completed_at"]:
                    if key in job and job[key]:
                        if isinstance(job[key], datetime):
                            job[key] = job[key].isoformat()
            
            return job
        except Exception as e:
            logger.error(f"Error getting job: {str(e)}")
            return None
    
    def check_stuck_jobs(self, timeout_minutes=30):
        """Check for jobs stuck in 'in_progress' or 'pending' (older than timeout_minutes) and mark them as failed/timed out.
        
        Args:
            timeout_minutes (int): Number of minutes after which a job is considered stuck (default: 30)
        
        Returns:
            int: Number of jobs marked as failed
        """
        if self.db is None:
            logger.error("Cannot check stuck jobs: Database connection not established")
            return 0
        
        try:
            from datetime import timedelta
            
            cutoff_time = datetime.now(timezone.utc) - timedelta(minutes=timeout_minutes)
            marked_count = 0
            
            # 1) Jobs stuck in_progress (started_at too old)
            stuck_in_progress = list(self.db.jobs.find({
                "status": "in_progress",
                "started_at": {"$lt": cutoff_time}
            }))
            if stuck_in_progress:
                logger.warning(f"Found {len(stuck_in_progress)} stuck jobs (in_progress for >{timeout_minutes} minutes)")
            for job in stuck_in_progress:
                job_id = job["_id"]
                started_at = job.get("started_at")
                if started_at:
                    # MongoDB may return naive datetime; ensure aware for subtraction
                    if started_at.tzinfo is None:
                        started_at = started_at.replace(tzinfo=timezone.utc)
                    duration = datetime.now(timezone.utc) - started_at
                    duration_minutes = int(duration.total_seconds() / 60)
                    error_message = f"Job timed out after {duration_minutes} minutes"
                else:
                    error_message = f"Job timed out after {timeout_minutes} minutes (started_at not set)"
                if self.update_job_status(job_id, 'failed', error=error_message, completed_at=datetime.now(timezone.utc)):
                    marked_count += 1
                    logger.info(f"Marked stuck job {job_id} as failed: {error_message}")
            
            # 2) Jobs stuck pending (created_at too old) — job clearer for jobs older than 30 mins
            stuck_pending = list(self.db.jobs.find({
                "status": "pending",
                "created_at": {"$lt": cutoff_time}
            }))
            if stuck_pending:
                logger.warning(f"Found {len(stuck_pending)} pending jobs older than {timeout_minutes} minutes; marking as timed out")
            for job in stuck_pending:
                job_id = job["_id"]
                if self.update_job_status(job_id, 'failed', error="Job timed out (pending too long)", completed_at=datetime.now(timezone.utc)):
                    marked_count += 1
                    logger.info(f"Marked pending job {job_id} as timed out")
            
            return marked_count
        except Exception as e:
            logger.error(f"Error checking stuck jobs: {str(e)}", exc_info=True)
            return 0
    
    def close(self):
        """Close MongoDB connection"""
        if self.client:
            self.client.close()
            logger.info("Closed MongoDB connection")
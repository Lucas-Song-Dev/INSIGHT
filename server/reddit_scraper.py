import praw
import prawcore.exceptions as prawcore_exceptions
import logging
import time
from datetime import datetime
from models import RedditPost
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
from threading import Timer
# Don't import data_store here to avoid circular imports
# Access it when needed

logger = logging.getLogger(__name__)

class RedditScraper:
    """
    Handles scraping of Reddit data using PRAW.
    Focuses on scraping posts related to specific software products.
    """
    
    def __init__(self):
        # Initialize without Reddit client
        self.reddit = None
        # Target products to analyze
        self.target_products = ["cursor", "replit"]
        # Default subreddits to search
        self.default_subreddits = [
            "programming", "webdev", "learnprogramming", 
            "coding", "javascript", "python", "reactjs",
            "vscode", "IDE", "developers", "replit", "cursor_editor"
        ]
        # Available time filters
        self.time_filters = {
            "hour": "past hour",
            "day": "past 24 hours",
            "week": "past week",
            "month": "past month",
            "year": "past year",
            "all": "all time"
        }
        
    def initialize_client(self, client_id, client_secret, user_agent=None):
        """
        Initialize the Reddit API client with provided credentials
        
        Args:
            client_id (str): Reddit API client ID
            client_secret (str): Reddit API client secret
            user_agent (str): User agent string (optional)
            
        Returns:
            bool: True if client was initialized successfully, False otherwise
        """
        if not client_id or not client_secret:
            logger.error("Reddit API credentials missing")
            return False
            
        try:
            self.reddit = praw.Reddit(
                client_id=client_id,
                client_secret=client_secret,
                user_agent=user_agent or "PainPointScraper/1.0"
            )
            return True
        except Exception as e:
            logger.error(f"Error initializing Reddit client: {str(e)}")
            return False
        
    def _search_subreddit_with_timeout(self, subreddit_obj, query, limit, time_filter, timeout_seconds=300):
        """
        Search a single subreddit with timeout protection
        
        Args:
            subreddit_obj: PRAW subreddit object
            query (str): Search query
            limit (int): Maximum results
            time_filter (str): Time filter
            timeout_seconds (int): Timeout in seconds (default 5 minutes)
            
        Returns:
            list: List of RedditPost objects
        """
        posts = []
        start_time = time.time()
        
        try:
            # Use ThreadPoolExecutor to enforce timeout
            def search_operation():
                subreddit_posts = []
                for submission in subreddit_obj.search(query, limit=limit, time_filter=time_filter):
                    # Convert to our internal model
                    post = RedditPost(
                        id=submission.id,
                        title=submission.title,
                        content=submission.selftext,
                        author=str(submission.author),
                        subreddit=str(submission.subreddit),
                        url=submission.url,
                        created_utc=datetime.fromtimestamp(submission.created_utc),
                        score=submission.score,
                        num_comments=submission.num_comments
                    )
                    subreddit_posts.append(post)
                    
                    # Add to store (lazy import to avoid circular dependencies)
                    try:
                        from app import data_store as ds
                        if post.id not in [p.id for p in ds.raw_posts]:
                            ds.raw_posts.append(post)
                    except (ImportError, AttributeError):
                        pass  # Skip if data_store not available
                return subreddit_posts
            
            # Execute with timeout
            with ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(search_operation)
                try:
                    posts = future.result(timeout=timeout_seconds)
                    elapsed = time.time() - start_time
                    logger.info(f"Completed search in subreddit {subreddit_obj} in {elapsed:.2f}s")
                except FutureTimeoutError:
                    logger.warning(f"Search in subreddit {subreddit_obj} timed out after {timeout_seconds}s")
                    future.cancel()
                    raise TimeoutError(f"Subreddit search timed out after {timeout_seconds} seconds")
                    
        except TimeoutError:
            raise  # Re-raise timeout errors
        except praw.exceptions.RedditAPIException as e:
            logger.error(f"Reddit API error searching subreddit {subreddit_obj}: {str(e)}")
            raise  # Re-raise to be handled by caller
        except prawcore_exceptions.ResponseException as e:
            logger.warning(f"Subreddit {subreddit_obj} returned HTTP error (e.g. 404), skipping: {e}")
            raise  # Re-raise so caller can skip this subreddit
        except prawcore_exceptions.RequestException as e:
            logger.error(f"Network error searching subreddit {subreddit_obj}: {str(e)}")
            raise  # Re-raise to be handled by caller
        except Exception as e:
            logger.error(f"Unexpected error searching subreddit {subreddit_obj}: {str(e)}", exc_info=True)
            raise  # Re-raise to be handled by caller
            
        return posts
    
    def search_reddit(self, query, subreddits=None, limit=100, time_filter="month", timeout_per_subreddit=300):
        """
        Search Reddit for posts containing specific keywords
        
        Args:
            query (str): The search query
            subreddits (list): List of subreddits to search
            limit (int): Maximum number of results to return
            time_filter (str): 'day', 'week', 'month', 'year', 'all'
            timeout_per_subreddit (int): Timeout in seconds per subreddit (default 5 minutes)
            
        Returns:
            list: List of RedditPost objects
        """
        if not subreddits:
            subreddits = self.default_subreddits
            
        logger.info(f"Searching Reddit for '{query}' in {subreddits} (timeout: {timeout_per_subreddit}s per subreddit)")
        
        # Track which subreddits have been scraped (lazy import to avoid circular dependencies)
        try:
            from app import data_store as ds
            for subreddit in subreddits:
                ds.subreddits_scraped.add(subreddit)
        except (ImportError, AttributeError):
            pass  # Skip if data_store not available
            
        # Create subreddit objects
        subreddit_objects = [self.reddit.subreddit(sub) for sub in subreddits]
        
        # Use PRAW to search for posts with timeout protection
        posts = []
        for subreddit_obj in subreddit_objects:
            try:
                subreddit_posts = self._search_subreddit_with_timeout(
                    subreddit_obj, query, limit, time_filter, timeout_per_subreddit
                )
                posts.extend(subreddit_posts)
                
                # Apply rate limiting to avoid hitting the Reddit API too hard
                time.sleep(2)
                    
            except TimeoutError as e:
                logger.error(f"Timeout searching subreddit {subreddit_obj}: {str(e)}")
                # Continue with other subreddits
            except praw.exceptions.RedditAPIException as e:
                logger.error(f"Reddit API error searching subreddit {subreddit_obj}: {str(e)}")
                # Continue with other subreddits
            except prawcore_exceptions.ResponseException as e:
                logger.warning(f"Subreddit {subreddit_obj} returned 404 or other HTTP error, skipping: {e}")
                # Continue with other subreddits
            except prawcore_exceptions.RequestException as e:
                logger.error(f"Network error searching subreddit {subreddit_obj}: {str(e)}")
                # Continue with other subreddits
            except Exception as e:
                logger.error(f"Unexpected error searching subreddit {subreddit_obj}: {str(e)}", exc_info=True)
                # Continue with other subreddits
                
        logger.info(f"Found {len(posts)} posts for query '{query}'")
        return posts
    
    def scrape_product_mentions(self, product_name, limit=100, subreddits=None, time_filter="month", timeout_per_subreddit=300):
        """
        Scrape mentions of a specific product
        
        Args:
            product_name (str): Name of the product to search for
            limit (int): Maximum number of posts to retrieve
            subreddits (list): List of subreddits to search (optional)
            time_filter (str): Time filter for search ('day', 'week', 'month', 'year', 'all')
            timeout_per_subreddit (int): Timeout in seconds per subreddit (default 5 minutes)
            
        Returns:
            list: List of RedditPost objects
        """
        logger.info(f"Scraping mentions of {product_name} for time period: {self.time_filters.get(time_filter, 'unknown')}")
        
        # Use provided subreddits or default ones
        search_subreddits = subreddits if subreddits else self.default_subreddits
        logger.info(f"Searching in subreddits: {search_subreddits}")
        
        # Create search queries
        queries = [
            f"{product_name}",
            f"{product_name} issue",
            f"{product_name} problem",
            f"{product_name} bug",
            f"{product_name} feature request"
        ]
        
        all_posts = []
        for query in queries:
            try:
                posts = self.search_reddit(
                    query=query, 
                    subreddits=search_subreddits, 
                    limit=limit//len(queries), 
                    time_filter=time_filter,
                    timeout_per_subreddit=timeout_per_subreddit
                )
                all_posts.extend(posts)
            except TimeoutError as e:
                logger.warning(f"Timeout while searching for '{query}': {str(e)}")
                # Continue with other queries
            except Exception as e:
                logger.error(f"Error searching for '{query}': {str(e)}", exc_info=True)
                # Continue with other queries
            
        # Update the timestamp for the last scrape (lazy import to avoid circular dependencies)
        try:
            from app import data_store as ds
            ds.last_scrape_time = datetime.now()
        except (ImportError, AttributeError):
            pass  # Skip if data_store not available
        
        return all_posts
    
    def scrape_all_products(self, limit=100, subreddits=None, time_filter="month", products=None):
        """
        Scrape mentions of all target products or specific products
        """
        data_store.scrape_in_progress = True  # Set to True at start
        try:
            result = {}
            # Use provided product list or default target products
            products_to_scrape = products if products else self.target_products
            
            for product in products_to_scrape:
                result[product] = self.scrape_product_mentions(
                    product_name=product, 
                    limit=limit, 
                    subreddits=subreddits, 
                    time_filter=time_filter
                )
                print("🚀 ~ result:", result)  # This print statement could be part of the issue
            # Lazy import to avoid circular dependencies
            try:
                from app import data_store as ds
                ds.scrape_in_progress = False  # Only set to False on success
            except (ImportError, AttributeError):
                pass
            return result
        except Exception as e:
            logger.error(f"Error during scraping: {str(e)}")
            # Lazy import to avoid circular dependencies
            try:
                from app import data_store as ds
                ds.scrape_in_progress = False  # Also set to False on exception
            except (ImportError, AttributeError):
                pass
            raise
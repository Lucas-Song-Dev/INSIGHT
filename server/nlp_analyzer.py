import nltk
import logging
import re

# Download necessary NLTK data
nltk.download('vader_lexicon', quiet=True)
nltk.download('punkt', quiet=True)
nltk.download('stopwords', quiet=True)
nltk.download('punkt_tab')
from nltk.sentiment import SentimentIntensityAnalyzer
from nltk.tokenize import word_tokenize
from nltk.corpus import stopwords
from collections import Counter
from models import PainPoint

# Lazy import to avoid circular dependencies
def _get_data_store():
    try:
        from app import data_store
        return data_store
    except ImportError:
        return None


logger = logging.getLogger(__name__)

class NLPAnalyzer:
    """
    Uses NLP techniques to analyze Reddit posts and identify pain points.
    """
    
    def __init__(self):
        self.sia = SentimentIntensityAnalyzer()
        self.stop_words = set(stopwords.words('english'))
        
        # Keywords that might indicate pain points
        self.pain_point_indicators = [
            'problem', 'issue', 'bug', 'broken', 'doesn\'t work', 'not working',
            'fix', 'error', 'crash', 'frustrating', 'annoying', 'wish', 'should',
            'would be nice', 'feature request', 'improvement', 'improve', 'difficult',
            'hard to', 'can\'t', 'cannot', 'impossible', 'hate', 'bad', 'terrible',
            'horrible', 'slow', 'laggy', 'unusable', 'unstable', 'inconsistent'
        ]
        
        # Common pain point categories
        self.pain_point_categories = {
            'ui': ['interface', 'ui', 'ux', 'button', 'click', 'design', 'layout', 'theme', 'dark mode', 'light mode'],
            'performance': ['slow', 'lag', 'freeze', 'hang', 'crash', 'performance', 'memory', 'cpu', 'resource'],
            'functionality': ['feature', 'function', 'capability', 'ability', 'tool', 'option'],
            'compatibility': ['browser', 'chrome', 'firefox', 'safari', 'edge', 'compatibility', 'extension'],
            'reliability': ['bug', 'error', 'crash', 'stable', 'unstable', 'reliable', 'consistency'],
            'usability': ['difficult', 'confusing', 'intuitive', 'learn', 'usability', 'workflow', 'productivity']
        }
        
    def analyze_sentiment(self, text):
        """
        Analyze the sentiment of a text
        
        Args:
            text (str): The text to analyze
            
        Returns:
            float: Sentiment score (-1 to 1, with negative values indicating negative sentiment)
        """
        if not text:
            return 0
            
        scores = self.sia.polarity_scores(text)
        return scores['compound']
    
    def extract_keywords(self, text, min_length=3, max_keywords=10):
        """
        Extract important keywords from text
        
        Args:
            text (str): The text to analyze
            min_length (int): Minimum word length to consider
            max_keywords (int): Maximum number of keywords to return
            
        Returns:
            list: List of keywords
        """
        if not text:
            return []
            
        # Tokenize and clean
        words = word_tokenize(text.lower())
        words = [word for word in words if word.isalnum() and len(word) >= min_length and word not in self.stop_words]
        
        # Count occurrences
        word_counts = Counter(words)
        
        # Return most common words
        return [word for word, _ in word_counts.most_common(max_keywords)]
    
    def identify_pain_points(self, post):
        """
        Identify potential pain points in a post
        
        Args:
            post (RedditPost): The post to analyze
            
        Returns:
            list: List of identified pain points
        """
        pain_points = []
        
        # Combine title and content for analysis
        full_text = f"{post.title} {post.content}"
        
        # Check if text contains pain point indicators
        for indicator in self.pain_point_indicators:
            if indicator.lower() in full_text.lower():
                # For each pain point indicator, check which category it falls into
                for category, keywords in self.pain_point_categories.items():
                    for keyword in keywords:
                        if keyword.lower() in full_text.lower():
                            pain_points.append(f"{category}:{indicator}")
        
        # Deduplicate
        return list(set(pain_points))
    
    def get_product_from_post(self, post, products):
        """
        Determine which products the post is talking about
        
        Args:
            post (RedditPost): The Reddit post
            products (list): List of product names to check for
            
        Returns:
            list: List of matching product names or empty list if none match
        """
        # Check both title and content
        full_text = f"{post.title} {post.content}".lower()
        matching_products = []
        for p in products:
            if p.lower() in full_text:
                matching_products.append(p)
        
        return matching_products
    
    def categorize_pain_points(self, posts, products):
        """
        Categorize and aggregate pain points from multiple posts
        
        Args:
            posts (list): List of RedditPost objects
            products (list): List of product names to check for
            
        Returns:
            dict: Dictionary of pain point categories and their frequencies
        """
        logger.info(f"Starting categorize_pain_points for {len(posts)} posts")
        
        pain_point_map = {}
        
        for idx, post in enumerate(posts):
            if (idx + 1) % 100 == 0:
                logger.info(f"Processing post {idx + 1}/{len(posts)}")
            
            # Analyze sentiment
            post.sentiment = self.analyze_sentiment(f"{post.title} {post.content}")
            
            # Identify pain points
            post.pain_points = self.identify_pain_points(post)
            
            # Get all matching products for this post
            matching_products = self.get_product_from_post(post, products)
            
            # Extract topics/keywords
            post.topics = self.extract_keywords(f"{post.title} {post.content}")
            
            # Only process posts that mention pain points and matched products
            if post.pain_points and matching_products:
                for pain_point in post.pain_points:
                    try:
                        category, indicator = pain_point.split(":", 1)
                    except ValueError:
                        logger.warning(f"Skipping malformed pain point: {pain_point}")
                        continue

                    base_key = f"{category}:{indicator}"
                    
                    for product in matching_products:
                        product_key = f"{base_key}:{product}"
                        
                        if product_key not in pain_point_map:
                            description = f"Issues with {category} described as '{indicator}' in {product}"
                            pain_point_map[product_key] = PainPoint(
                                name=f"{category.title()}: {indicator}",
                                description=description,
                                product=product
                            )
                        
                        pain_point_obj = pain_point_map[product_key]
                        pain_point_obj.frequency += 1
                        pain_point_obj.related_posts.append(post.id)
                        
                        current_total = pain_point_obj.avg_sentiment * (len(pain_point_obj.related_posts) - 1)
                        pain_point_obj.avg_sentiment = (current_total + post.sentiment) / len(pain_point_obj.related_posts)
                        
                        pain_point_obj.calculate_severity()
        
        logger.info(f"Finalized pain point map: {len(pain_point_map)} unique pain points")
        
        # Add to data store
        ds = _get_data_store()
        if ds:
            ds.pain_points = pain_point_map
            ds.analyzed_posts = posts
            logger.info("Data store updated with pain points")
        else:
            logger.warning("Data store not available for updating pain points")

        return pain_point_map

    
    def analyze_posts(self, posts, products):
        """
        Analyze a batch of posts
        
        Args:
            posts (list): List of RedditPost objects
            
        Returns:
            dict: Analysis results
        """
        logger.info(f"Analyzing {len(posts)} posts")
        
        # Perform sentiment analysis on each post
        for post in posts:
            full_text = f"{post.title} {post.content}"
            post.sentiment = self.analyze_sentiment(full_text)
        
        # Categorize pain points
        pain_points = self.categorize_pain_points(posts, products)
        
        # Get top pain points by severity
        sorted_pain_points = sorted(
            pain_points.values(), 
            key=lambda x: x.severity, 
            reverse=True
        )
        
        return {
            "post_count": len(posts),
            "avg_sentiment": sum(post.sentiment for post in posts) / len(posts) if posts else 0,
            "pain_points": [p.to_dict() for p in sorted_pain_points[:10]]
        }

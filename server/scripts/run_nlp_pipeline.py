#!/usr/bin/env python3
"""
Automated NLP Pipeline Runner
Processes Reddit posts and generates insights with 94% sentiment accuracy target.
"""
import os
import sys
import logging
from datetime import datetime
from dotenv import load_dotenv

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from mongodb_store import MongoDBStore
from advanced_nlp_analyzer import AdvancedNLPAnalyzer
from models import RedditPost

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def run_nlp_pipeline():
    """Run the complete NLP pipeline."""
    logger.info("=" * 60)
    logger.info("Starting Automated NLP Pipeline")
    logger.info("=" * 60)
    
    # Initialize MongoDB connection
    mongodb_uri = os.getenv("MONGODB_URI")
    if not mongodb_uri:
        logger.error("MONGODB_URI not set")
        return False
    
    data_store = MongoDBStore(mongodb_uri)
    if data_store.db is None:
        logger.error("Failed to connect to MongoDB")
        return False
    
    # Initialize advanced NLP analyzer
    analyzer = AdvancedNLPAnalyzer()
    
    # Load posts from MongoDB
    logger.info("Loading posts from MongoDB...")
    posts_cursor = data_store.db.posts.find({})
    posts = []
    
    total_words = 0
    for doc in posts_cursor:
        # Convert MongoDB document to RedditPost object
        post = RedditPost(
            id=doc.get('_id') or doc.get('id', ''),
            title=doc.get('title', ''),
            content=doc.get('content', '') or doc.get('selftext', ''),
            author=doc.get('author', ''),
            subreddit=doc.get('subreddit', ''),
            url=doc.get('url', ''),
            created_utc=doc.get('created_utc'),
            score=doc.get('score', 0),
            num_comments=doc.get('num_comments', 0)
        )
        post.products = doc.get('products', [])
        posts.append(post)
        
        # Count words
        text = f"{post.title} {post.content}"
        total_words += len(text.split())
    
    logger.info(f"Loaded {len(posts)} posts ({total_words:,} words)")
    
    if len(posts) == 0:
        logger.warning("No posts found in database")
        return False
    
    # Run advanced NLP analysis
    logger.info("Running advanced NLP analysis...")
    results = analyzer.analyze_batch(posts)
    
    # Save results to MongoDB
    logger.info("Saving analysis results to MongoDB...")
    analysis_doc = {
        '_id': f"nlp_analysis_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}",
        'timestamp': datetime.utcnow(),
        'posts_analyzed': results['posts_analyzed'],
        'total_words': results['total_words'],
        'sentiment_distribution': results['sentiment_distribution'],
        'avg_sentiment': results['avg_sentiment'],
        'topics': results['topics'][:20],  # Top 20 topics
        'pain_points': results['pain_points'][:50],  # Top 50 pain points
        'insights': results['insights'],
        'statistics': analyzer.get_statistics()
    }
    
    data_store.db.nlp_analyses.insert_one(analysis_doc)
    
    # Update pain points in database
    for pp in results['pain_points'][:100]:  # Top 100 pain points
        pain_point_doc = {
            '_id': f"{pp['category']}_{pp['indicator']}",
            'category': pp['category'],
            'indicator': pp['indicator'],
            'frequency': pp['frequency'],
            'severity_score': pp['severity_score'],
            'avg_sentiment': pp['avg_sentiment'],
            'affected_posts': pp['affected_posts'],
            'last_updated': datetime.utcnow()
        }
        data_store.db.pain_points.update_one(
            {'_id': pain_point_doc['_id']},
            {'$set': pain_point_doc},
            upsert=True
        )
    
    # Log summary
    logger.info("=" * 60)
    logger.info("NLP Pipeline Complete")
    logger.info("=" * 60)
    logger.info(f"Posts Analyzed: {results['posts_analyzed']:,}")
    logger.info(f"Total Words: {results['total_words']:,}")
    logger.info(f"Average Sentiment: {results['avg_sentiment']:.3f}")
    logger.info(f"Sentiment Distribution:")
    for label, count in results['sentiment_distribution'].items():
        pct = (count / results['posts_analyzed'] * 100) if results['posts_analyzed'] > 0 else 0
        logger.info(f"  {label.capitalize()}: {count} ({pct:.1f}%)")
    logger.info(f"Pain Points Identified: {len(results['pain_points'])}")
    logger.info(f"Top Topics: {len(results['topics'])}")
    logger.info(f"Insights Generated: {len(results['insights'])}")
    
    # Verify accuracy target (94%)
    stats = analyzer.get_statistics()
    if stats.get('accuracy_metrics', {}).get('accuracy', 0) >= 0.94:
        logger.info("✅ Accuracy target achieved: >= 94%")
    else:
        logger.warning(f"⚠️  Accuracy: {stats.get('accuracy_metrics', {}).get('accuracy', 0):.2%} (target: 94%)")
    
    return True


if __name__ == "__main__":
    success = run_nlp_pipeline()
    sys.exit(0 if success else 1)


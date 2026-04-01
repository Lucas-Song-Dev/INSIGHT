#!/usr/bin/env python3
"""
Verify NLP pipeline results and accuracy metrics.
"""
import os
import sys
import json
from datetime import datetime, timedelta
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from mongodb_store import MongoDBStore

load_dotenv()


def verify_results():
    """Verify NLP pipeline results."""
    print("=" * 60)
    print("Verifying NLP Pipeline Results")
    print("=" * 60)
    
    mongodb_uri = os.getenv("MONGODB_URI")
    if not mongodb_uri:
        print("❌ MONGODB_URI not set")
        return False
    
    data_store = MongoDBStore(mongodb_uri)
    if data_store.db is None:
        print("❌ Failed to connect to MongoDB")
        return False
    
    # Check recent analysis
    recent_analysis = data_store.db.nlp_analyses.find_one(
        sort=[('timestamp', -1)]
    )
    
    if not recent_analysis:
        print("⚠️  No NLP analysis found in database")
        return False
    
    print(f"✅ Found analysis from {recent_analysis['timestamp']}")
    print(f"   Posts analyzed: {recent_analysis['posts_analyzed']:,}")
    print(f"   Total words: {recent_analysis['total_words']:,}")
    print(f"   Average sentiment: {recent_analysis['avg_sentiment']:.3f}")
    
    # Check word count target (3.2M words)
    word_count = recent_analysis['total_words']
    target_words = 3_200_000
    if word_count >= target_words:
        print(f"✅ Word count target achieved: {word_count:,} >= {target_words:,}")
    else:
        print(f"⚠️  Word count: {word_count:,} (target: {target_words:,})")
    
    # Check accuracy
    stats = recent_analysis.get('statistics', {})
    accuracy_metrics = stats.get('accuracy_metrics', {})
    accuracy = accuracy_metrics.get('accuracy', 0)
    
    if accuracy >= 0.94:
        print(f"✅ Accuracy target achieved: {accuracy:.2%} >= 94%")
    elif accuracy > 0:
        print(f"⚠️  Accuracy: {accuracy:.2%} (target: 94%)")
    else:
        print("ℹ️  Model not trained yet (using ensemble method)")
    
    # Check pain points
    pain_points_count = len(recent_analysis.get('pain_points', []))
    print(f"✅ Pain points identified: {pain_points_count}")
    
    # Check topics
    topics_count = len(recent_analysis.get('topics', []))
    print(f"✅ Topics extracted: {topics_count}")
    
    # Check insights
    insights_count = len(recent_analysis.get('insights', []))
    print(f"✅ Insights generated: {insights_count}")
    
    print("=" * 60)
    print("Verification Complete")
    print("=" * 60)
    
    return True


if __name__ == "__main__":
    success = verify_results()
    sys.exit(0 if success else 1)


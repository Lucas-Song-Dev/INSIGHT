#!/usr/bin/env python3
"""
Generate NLP pipeline report.
"""
import os
import sys
import json
from datetime import datetime
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from mongodb_store import MongoDBStore

load_dotenv()


def generate_report():
    """Generate comprehensive NLP report."""
    mongodb_uri = os.getenv("MONGODB_URI")
    if not mongodb_uri:
        return
    
    data_store = MongoDBStore(mongodb_uri)
    if data_store.db is None:
        return
    
    # Get latest analysis
    analysis = data_store.db.nlp_analyses.find_one(sort=[('timestamp', -1)])
    
    if not analysis:
        print("No analysis data available")
        return
    
    print("=" * 80)
    print("NLP PIPELINE ANALYSIS REPORT")
    print("=" * 80)
    print(f"Generated: {datetime.utcnow().isoformat()}")
    print()
    
    print("OVERVIEW")
    print("-" * 80)
    print(f"Analysis Timestamp: {analysis['timestamp']}")
    print(f"Posts Analyzed: {analysis['posts_analyzed']:,}")
    print(f"Total Words Processed: {analysis['total_words']:,}")
    print(f"Average Sentiment: {analysis['avg_sentiment']:.3f}")
    print()
    
    print("SENTIMENT DISTRIBUTION")
    print("-" * 80)
    dist = analysis['sentiment_distribution']
    total = sum(dist.values())
    for label, count in dist.items():
        pct = (count / total * 100) if total > 0 else 0
        bar = "█" * int(pct / 2)
        print(f"{label.upper():12} {count:6,} ({pct:5.1f}%) {bar}")
    print()
    
    print("TOP PAIN POINTS")
    print("-" * 80)
    for i, pp in enumerate(analysis['pain_points'][:10], 1):
        print(f"{i:2}. [{pp['category'].upper()}] {pp['indicator']}")
        print(f"    Frequency: {pp['frequency']}, Severity: {pp['severity_score']:.2f}, "
              f"Sentiment: {pp['avg_sentiment']:.3f}")
    print()
    
    print("TOP TOPICS")
    print("-" * 80)
    for i, topic in enumerate(analysis['topics'][:15], 1):
        print(f"{i:2}. {topic['term']:20} (Frequency: {topic['frequency']:4}, "
              f"Relevance: {topic['relevance']:.3f})")
    print()
    
    print("INSIGHTS")
    print("-" * 80)
    for insight in analysis.get('insights', []):
        print(f"• {insight}")
    print()
    
    # Statistics
    stats = analysis.get('statistics', {})
    if stats.get('accuracy_metrics'):
        print("ACCURACY METRICS")
        print("-" * 80)
        acc = stats['accuracy_metrics']
        print(f"Model Accuracy: {acc.get('accuracy', 0):.2%}")
        print()
    
    print("=" * 80)


if __name__ == "__main__":
    generate_report()


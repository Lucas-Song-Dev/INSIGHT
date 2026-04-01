"""
Advanced NLP Pipeline for sentiment analysis and pain point extraction.
Target: 94% sentiment classification accuracy on 3.2M words of user feedback.
"""
import logging
import re
import numpy as np
from collections import Counter, defaultdict
from datetime import datetime
from typing import List, Dict, Tuple, Optional
import nltk
from nltk.sentiment import SentimentIntensityAnalyzer
from nltk.tokenize import word_tokenize, sent_tokenize
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer
# pos_tag available but not used in current implementation
# from nltk.tag import pos_tag
import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import VotingClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

# Download required NLTK data
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt', quiet=True)

try:
    nltk.data.find('tokenizers/punkt_tab/english')
except LookupError:
    nltk.download('punkt_tab', quiet=True)

try:
    nltk.data.find('vader_lexicon')
except LookupError:
    nltk.download('vader_lexicon', quiet=True)

try:
    nltk.data.find('stopwords')
except LookupError:
    nltk.download('stopwords', quiet=True)

try:
    nltk.data.find('wordnet')
except LookupError:
    nltk.download('wordnet', quiet=True)

try:
    nltk.data.find('averaged_perceptron_tagger')
except LookupError:
    nltk.download('averaged_perceptron_tagger', quiet=True)

logger = logging.getLogger(__name__)


class AdvancedNLPAnalyzer:
    """
    Advanced NLP analyzer with ensemble methods for high-accuracy sentiment classification.
    Combines VADER, TF-IDF + ML models, and rule-based analysis.
    """
    
    def __init__(self):
        """Initialize the advanced NLP analyzer."""
        self.sia = SentimentIntensityAnalyzer()
        self.lemmatizer = WordNetLemmatizer()
        self.stop_words = set(stopwords.words('english'))
        
        # Extended stop words for better filtering
        self.stop_words.update(['reddit', 'subreddit', 'post', 'comment', 'thread'])
        
        # Pain point indicators with weights
        self.pain_indicators = {
            'critical': ['crash', 'broken', 'unusable', 'frozen', 'corrupted', 'lost data', 'delete'],
            'high': ['slow', 'lag', 'bug', 'error', 'glitch', 'freeze', 'hang', 'stuck'],
            'medium': ['frustrating', 'annoying', 'difficult', 'confusing', 'complicated'],
            'low': ['wish', 'should', 'could', 'better', 'improve', 'feature']
        }
        
        # ML models (will be trained)
        self.vectorizer = None
        self.sentiment_classifier = None
        self.is_trained = False
        
        # Statistics
        self.stats = {
            'total_words_processed': 0,
            'total_posts_analyzed': 0,
            'sentiment_predictions': {'positive': 0, 'negative': 0, 'neutral': 0},
            'accuracy_metrics': {}
        }
    
    def preprocess_text(self, text: str) -> str:
        """
        Preprocess text for analysis.
        
        Args:
            text: Raw text input
            
        Returns:
            Preprocessed text
        """
        if not text:
            return ""
        
        # Convert to lowercase
        text = text.lower()
        
        # Remove URLs
        text = re.sub(r'http\S+|www\.\S+', '', text)
        
        # Remove Reddit-specific formatting
        text = re.sub(r'\[.*?\]\(.*?\)', '', text)  # Markdown links
        text = re.sub(r'/r/\w+', '', text)  # Subreddit mentions
        text = re.sub(r'/u/\w+', '', text)  # User mentions
        
        # Remove special characters but keep punctuation for sentiment
        text = re.sub(r'[^\w\s\.\!\?]', ' ', text)
        
        # Normalize whitespace
        text = ' '.join(text.split())
        
        return text
    
    def extract_features(self, text: str) -> Dict:
        """
        Extract features from text for sentiment analysis.
        
        Args:
            text: Input text
            
        Returns:
            Dictionary of features
        """
        features = {
            'word_count': len(text.split()),
            'sentence_count': len(sent_tokenize(text)),
            'exclamation_count': text.count('!'),
            'question_count': text.count('?'),
            'uppercase_ratio': sum(1 for c in text if c.isupper()) / max(len(text), 1),
            'negation_count': len(re.findall(r'\b(not|no|never|nothing|nobody|nowhere)\b', text)),
            'intensifier_count': len(re.findall(r'\b(very|extremely|really|so|too|quite)\b', text)),
        }
        
        # VADER scores
        vader_scores = self.sia.polarity_scores(text)
        features.update({
            'vader_compound': vader_scores['compound'],
            'vader_pos': vader_scores['pos'],
            'vader_neg': vader_scores['neg'],
            'vader_neu': vader_scores['neu']
        })
        
        # Pain point indicators
        text_lower = text.lower()
        for severity, indicators in self.pain_indicators.items():
            count = sum(1 for ind in indicators if ind in text_lower)
            features[f'pain_{severity}_count'] = count
        
        return features
    
    def ensemble_sentiment(self, text: str) -> Tuple[float, str]:
        """
        Use ensemble method to predict sentiment with high accuracy.
        
        Args:
            text: Input text
            
        Returns:
            Tuple of (sentiment_score, sentiment_label)
            sentiment_score: -1 to 1 (negative to positive)
            sentiment_label: 'positive', 'negative', or 'neutral'
        """
        if not text:
            return 0.0, 'neutral'
        
        preprocessed = self.preprocess_text(text)
        
        # Method 1: VADER sentiment
        vader_scores = self.sia.polarity_scores(preprocessed)
        vader_compound = vader_scores['compound']
        
        # Method 2: Rule-based adjustments
        features = self.extract_features(preprocessed)
        
        # Adjust based on pain indicators
        pain_adjustment = 0.0
        if features['pain_critical_count'] > 0:
            pain_adjustment -= 0.3
        if features['pain_high_count'] > 0:
            pain_adjustment -= 0.2
        if features['pain_medium_count'] > 0:
            pain_adjustment -= 0.1
        
        # Adjust based on intensifiers
        if features['intensifier_count'] > 0:
            pain_adjustment *= 1.2
        
        # Method 3: ML model (if trained)
        ml_score = 0.0
        if self.is_trained and self.vectorizer and self.sentiment_classifier:
            try:
                text_vectorized = self.vectorizer.transform([preprocessed])
                ml_prediction = self.sentiment_classifier.predict_proba(text_vectorized)[0]
                # Convert to -1 to 1 scale
                ml_score = (ml_prediction[2] - ml_prediction[0])  # positive - negative
            except Exception as e:
                logger.warning(f"ML model prediction failed: {e}")
        
        # Ensemble: Weighted combination
        if self.is_trained:
            # Use ML model if available
            final_score = (0.4 * vader_compound + 0.5 * ml_score + 0.1 * pain_adjustment)
        else:
            # Fallback to VADER + rules
            final_score = (0.8 * vader_compound + 0.2 * pain_adjustment)
        
        # Clamp to [-1, 1]
        final_score = max(-1.0, min(1.0, final_score))
        
        # Classify label
        if final_score > 0.1:
            label = 'positive'
        elif final_score < -0.1:
            label = 'negative'
        else:
            label = 'neutral'
        
        return final_score, label
    
    def analyze_batch(self, posts: List) -> Dict:
        """
        Analyze a batch of posts with advanced NLP.
        
        Args:
            posts: List of post objects with title and content
            
        Returns:
            Analysis results dictionary
        """
        logger.info(f"Starting advanced NLP analysis of {len(posts)} posts")
        
        results = {
            'posts_analyzed': len(posts),
            'total_words': 0,
            'sentiment_distribution': {'positive': 0, 'negative': 0, 'neutral': 0},
            'avg_sentiment': 0.0,
            'pain_points': [],
            'topics': [],
            'insights': []
        }
        
        sentiment_scores = []
        all_text = []
        
        for post in posts:
            # Combine title and content
            full_text = f"{getattr(post, 'title', '')} {getattr(post, 'content', '')}"
            
            # Count words
            word_count = len(full_text.split())
            results['total_words'] += word_count
            self.stats['total_words_processed'] += word_count
            
            # Analyze sentiment
            sentiment_score, sentiment_label = self.ensemble_sentiment(full_text)
            sentiment_scores.append(sentiment_score)
            results['sentiment_distribution'][sentiment_label] += 1
            
            # Store sentiment on post object
            post.sentiment = sentiment_score
            post.sentiment_label = sentiment_label
            
            all_text.append(full_text)
        
        # Calculate statistics
        if sentiment_scores:
            results['avg_sentiment'] = np.mean(sentiment_scores)
            results['std_sentiment'] = np.std(sentiment_scores)
        
        # Extract topics and pain points
        results['topics'] = self._extract_topics(all_text)
        results['pain_points'] = self._identify_pain_points(posts)
        results['insights'] = self._generate_insights(results)
        
        self.stats['total_posts_analyzed'] += len(posts)
        self.stats['sentiment_predictions'] = results['sentiment_distribution']
        
        logger.info(f"Analysis complete: {results['total_words']} words processed")
        logger.info(f"Sentiment distribution: {results['sentiment_distribution']}")
        
        return results
    
    def _extract_topics(self, texts: List[str], top_n: int = 20) -> List[Dict]:
        """Extract top topics from texts."""
        # Combine all text
        all_text = ' '.join(texts)
        preprocessed = self.preprocess_text(all_text)
        
        # Tokenize and filter
        tokens = word_tokenize(preprocessed)
        tokens = [t for t in tokens if t.isalnum() and t not in self.stop_words and len(t) > 2]
        
        # Count frequencies
        word_freq = Counter(tokens)
        
        # Get top topics
        topics = []
        for word, count in word_freq.most_common(top_n):
            topics.append({
                'term': word,
                'frequency': count,
                'relevance': count / len(tokens) if tokens else 0
            })
        
        return topics
    
    def _identify_pain_points(self, posts: List) -> List[Dict]:
        """Identify pain points from posts."""
        pain_points = defaultdict(lambda: {
            'count': 0,
            'severity': 0,
            'posts': [],
            'avg_sentiment': 0.0
        })
        
        for post in posts:
            text = f"{getattr(post, 'title', '')} {getattr(post, 'content', '')}".lower()
            sentiment = getattr(post, 'sentiment', 0)
            if sentiment is None:
                sentiment = 0.0
            
            # Check for pain indicators
            for severity, indicators in self.pain_indicators.items():
                for indicator in indicators:
                    if indicator in text:
                        key = f"{severity}:{indicator}"
                        pain_points[key]['count'] += 1
                        pain_points[key]['posts'].append(getattr(post, 'id', 'unknown'))
                        pain_points[key]['avg_sentiment'] = (
                            pain_points[key]['avg_sentiment'] * (pain_points[key]['count'] - 1) + sentiment
                        ) / pain_points[key]['count']
                        
                        # Set severity score
                        severity_scores = {'critical': 1.0, 'high': 0.7, 'medium': 0.4, 'low': 0.2}
                        pain_points[key]['severity'] = max(
                            pain_points[key]['severity'],
                            severity_scores[severity] * abs(sentiment)
                        )
        
        # Convert to list and sort by severity
        result = []
        for key, data in pain_points.items():
            severity, indicator = key.split(':', 1)
            result.append({
                'category': severity,
                'indicator': indicator,
                'frequency': data['count'],
                'severity_score': data['severity'],
                'avg_sentiment': data['avg_sentiment'],
                'affected_posts': len(data['posts'])
            })
        
        return sorted(result, key=lambda x: x['severity_score'], reverse=True)
    
    def _generate_insights(self, results: Dict) -> List[str]:
        """Generate actionable insights from analysis."""
        insights = []
        
        # Sentiment insights
        total = sum(results['sentiment_distribution'].values())
        if total > 0:
            negative_pct = (results['sentiment_distribution']['negative'] / total) * 100
            if negative_pct > 50:
                insights.append(f"High negative sentiment detected ({negative_pct:.1f}% negative posts)")
            elif negative_pct > 30:
                insights.append(f"Moderate negative sentiment ({negative_pct:.1f}% negative posts)")
        
        # Pain point insights
        critical_pains = [p for p in results['pain_points'] if p['category'] == 'critical']
        if critical_pains:
            insights.append(f"{len(critical_pains)} critical pain points identified requiring immediate attention")
        
        # Volume insights
        if results['total_words'] > 1000000:
            insights.append(f"Large dataset analyzed: {results['total_words']:,} words processed")
        
        return insights
    
    def train_model(self, training_data: List[Tuple[str, str]]) -> Dict:
        """
        Train ML model on labeled data for improved accuracy.
        
        Args:
            training_data: List of (text, label) tuples where label is 'positive', 'negative', or 'neutral'
            
        Returns:
            Training metrics dictionary
        """
        logger.info(f"Training sentiment classifier on {len(training_data)} samples")
        
        if len(training_data) < 100:
            logger.warning("Insufficient training data. Need at least 100 samples.")
            return {'status': 'insufficient_data'}
        
        texts, labels = zip(*training_data)
        
        # Vectorize texts
        self.vectorizer = TfidfVectorizer(
            max_features=5000,
            ngram_range=(1, 2),
            stop_words='english',
            min_df=2,
            max_df=0.95
        )
        
        X = self.vectorizer.fit_transform(texts)
        y = labels
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        
        # Train ensemble classifier
        nb = MultinomialNB(alpha=0.1)
        lr = LogisticRegression(max_iter=1000, random_state=42)
        
        self.sentiment_classifier = VotingClassifier(
            estimators=[('nb', nb), ('lr', lr)],
            voting='soft'
        )
        
        self.sentiment_classifier.fit(X_train, y_train)
        
        # Evaluate
        y_pred = self.sentiment_classifier.predict(X_test)
        accuracy = accuracy_score(y_test, y_pred)
        
        self.is_trained = True
        self.stats['accuracy_metrics'] = {
            'accuracy': accuracy,
            'classification_report': classification_report(y_test, y_pred, output_dict=True),
            'confusion_matrix': confusion_matrix(y_test, y_pred).tolist()
        }
        
        logger.info(f"Model trained with {accuracy:.4f} accuracy")
        
        return {
            'status': 'success',
            'accuracy': accuracy,
            'training_samples': len(X_train),
            'test_samples': len(X_test)
        }
    
    def save_model(self, filepath: str):
        """Save trained model to disk."""
        if not self.is_trained:
            raise ValueError("Model not trained yet")
        
        joblib.dump({
            'vectorizer': self.vectorizer,
            'classifier': self.sentiment_classifier
        }, filepath)
        logger.info(f"Model saved to {filepath}")
    
    def load_model(self, filepath: str):
        """Load trained model from disk."""
        model_data = joblib.load(filepath)
        self.vectorizer = model_data['vectorizer']
        self.sentiment_classifier = model_data['classifier']
        self.is_trained = True
        logger.info(f"Model loaded from {filepath}")
    
    def get_statistics(self) -> Dict:
        """Get analysis statistics."""
        return {
            **self.stats,
            'model_trained': self.is_trained,
            'timestamp': datetime.utcnow().isoformat()
        }


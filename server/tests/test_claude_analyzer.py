"""
Tests for ClaudeAnalyzer
"""
import pytest
from unittest.mock import Mock, patch, MagicMock
import json
from claude_analyzer import ClaudeAnalyzer

class TestClaudeAnalyzer:
    """Tests for ClaudeAnalyzer class"""
    
    @pytest.fixture
    def analyzer(self):
        """Create a ClaudeAnalyzer instance for testing"""
        with patch.dict('os.environ', {'ANTHROPIC_API_KEY': 'test_key_sk-test-123456789012345678901234567890'}):
            return ClaudeAnalyzer()
    
    def test_init_without_api_key(self):
        """Test initialization without API key"""
        with patch.dict('os.environ', {}, clear=True):
            analyzer = ClaudeAnalyzer()
            assert analyzer.api_key is None
            assert analyzer.client is None
    
    def test_init_with_api_key(self):
        """Test initialization with API key"""
        with patch.dict('os.environ', {'ANTHROPIC_API_KEY': 'test_key_sk-test-123456789012345678901234567890'}):
            with patch('claude_analyzer.Anthropic') as mock_anthropic:
                mock_anthropic.return_value = MagicMock()
                analyzer = ClaudeAnalyzer()
                assert analyzer.api_key is not None
                mock_anthropic.assert_called_once()
    
    def test_initialize_client_success(self):
        """Test successful client initialization"""
        with patch('claude_analyzer.Anthropic') as mock_anthropic:
            mock_client = MagicMock()
            mock_anthropic.return_value = mock_client
            analyzer = ClaudeAnalyzer(api_key='test_key_sk-test-123456789012345678901234567890')
            assert analyzer.client is not None
            assert analyzer.api_key == 'test_key_sk-test-123456789012345678901234567890'
    
    def test_initialize_client_no_key(self):
        """Test client initialization without API key"""
        analyzer = ClaudeAnalyzer()
        result = analyzer.initialize_client(None)
        assert result is False
    
    @patch('claude_analyzer.Anthropic')
    def test_suggest_subreddits_success(self, mock_anthropic):
        """Test successful subreddit suggestion"""
        # Setup mock
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.content = [MagicMock()]
        mock_response.content[0].text = json.dumps({
            'subreddits': ['python', 'programming'],
            'search_queries': ['python issue', 'python problem']
        })
        mock_client.messages.create.return_value = mock_response
        mock_anthropic.return_value = mock_client
        
        analyzer = ClaudeAnalyzer(api_key='test_key_sk-test-123456789012345678901234567890')
        result = analyzer.suggest_subreddits('Python')
        
        assert 'subreddits' in result
        assert 'search_queries' in result
        assert len(result['subreddits']) > 0
    
    @patch('claude_analyzer.Anthropic')
    def test_suggest_subreddits_error(self, mock_anthropic):
        """Test subreddit suggestion with error"""
        mock_client = MagicMock()
        mock_client.messages.create.side_effect = Exception("API Error")
        mock_anthropic.return_value = mock_client
        
        analyzer = ClaudeAnalyzer(api_key='test_key_sk-test-123456789012345678901234567890')
        result = analyzer.suggest_subreddits('Python')
        
        assert 'error' in result
        assert 'subreddits' in result  # Should have fallback
    
    def test_suggest_subreddits_no_api_key(self):
        """Test subreddit suggestion without API key"""
        with patch.dict('os.environ', {}, clear=True):
            analyzer = ClaudeAnalyzer()
            result = analyzer.suggest_subreddits('Python')
            
            assert 'error' in result
            # Error message may vary, just check that error exists
            assert len(result['error']) > 0
    
    @patch('claude_analyzer.Anthropic')
    def test_analyze_common_pain_points_success(self, mock_anthropic):
        """Test successful pain point analysis"""
        # Setup mock
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.content = [MagicMock()]
        mock_response.content[0].text = json.dumps({
            'common_pain_points': [
                {
                    'name': 'Slow performance',
                    'description': 'Users report slow performance',
                    'severity': 'high',
                    'potential_solutions': 'Optimize code',
                    'related_keywords': ['slow', 'performance']
                }
            ],
            'analysis_summary': 'Found performance issues'
        })
        mock_client.messages.create.return_value = mock_response
        mock_anthropic.return_value = mock_client
        
        analyzer = ClaudeAnalyzer(api_key='test_key_sk-test-123456789012345678901234567890')
        
        # Mock posts
        mock_post = MagicMock()
        mock_post.title = 'Test post'
        mock_post.content = 'This is a test post'
        mock_post.score = 10
        mock_post.num_comments = 5
        
        result = analyzer.analyze_common_pain_points([mock_post], 'Test Product')
        
        assert 'common_pain_points' in result
        assert len(result['common_pain_points']) > 0
        assert 'analysis_summary' in result
    
    def test_analyze_common_pain_points_no_posts(self):
        """Test pain point analysis with no posts"""
        analyzer = ClaudeAnalyzer()
        result = analyzer.analyze_common_pain_points([], 'Test Product')
        
        assert 'common_pain_points' in result
        assert result['common_pain_points'] == []
    
    def test_analyze_common_pain_points_no_api_key(self):
        """Test pain point analysis without API key"""
        with patch.dict('os.environ', {}, clear=True):
            analyzer = ClaudeAnalyzer()
            # Create a proper mock post with actual attributes
            mock_post = MagicMock()
            mock_post.title = 'Test title'
            mock_post.content = 'Test content'
            mock_post.score = 10
            mock_post.num_comments = 5
            result = analyzer.analyze_common_pain_points([mock_post], 'Test Product')
            
            assert 'error' in result
    
    @patch('claude_analyzer.Anthropic')
    def test_generate_recommendations_success(self, mock_anthropic):
        """Test successful recommendation generation"""
        # Setup mock
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.content = [MagicMock()]
        mock_response.content[0].text = json.dumps({
            'recommendations': [
                {
                    'title': 'Fix performance',
                    'description': 'Optimize the code',
                    'complexity': 'medium',
                    'impact': 'high',
                    'addresses_pain_points': ['Slow performance'],
                    'most_recent_occurence': '2024-01-01'
                }
            ],
            'summary': 'Performance improvements needed'
        })
        mock_client.messages.create.return_value = mock_response
        mock_anthropic.return_value = mock_client
        
        analyzer = ClaudeAnalyzer(api_key='test_key_sk-test-123456789012345678901234567890')
        
        pain_points = [{'name': 'Slow performance', 'description': 'Users report slow performance'}]
        result = analyzer.generate_recommendations(pain_points, 'Test Product')
        
        assert 'recommendations' in result
        assert len(result['recommendations']) > 0
    
    def test_generate_recommendations_no_pain_points(self):
        """Test recommendation generation with no pain points"""
        analyzer = ClaudeAnalyzer()
        result = analyzer.generate_recommendations([], 'Test Product')
        
        assert 'recommendations' in result
        assert result['recommendations'] == []


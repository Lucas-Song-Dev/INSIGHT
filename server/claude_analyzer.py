import json
import logging
import os
from anthropic import Anthropic
from datetime import datetime
from utils import retry_on_failure

logger = logging.getLogger(__name__)

class ClaudeAnalyzer:
    """
    Uses Anthropic's Claude 3 Haiku API to analyze Reddit posts, suggest subreddits, and generate queries.
    """
    
    def __init__(self, api_key=None):
        """
        Initialize the Claude analyzer
        
        Args:
            api_key (str, optional): Anthropic API key. If not provided, will try to get from environment.
        """
        # Try to get API key from parameter, then from environment variable
        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
        self.client = None
        
        # Use Claude 3 Haiku - cost-effective model
        self.model = "claude-3-haiku-20240307"
        
        # Initialize client if API key is available
        if self.api_key:
            self.initialize_client(self.api_key)
        else:
            logger.warning("Anthropic API key not found. API key must be provided with each request.")
            
    def initialize_client(self, api_key):
        """
        Initialize the Anthropic client with the provided API key
        
        Args:
            api_key (str): Anthropic API key
            
        Returns:
            bool: True if client was initialized successfully, False otherwise
        """
        if not api_key:
            logger.error("No API key provided to initialize Claude client")
            return False
            
        try:
            self.client = Anthropic(api_key=api_key)
            self.api_key = api_key
            logger.info("Claude client initialized successfully")
            return True
        except Exception as e:
            logger.error(f"Error initializing Claude client: {str(e)}")
            return False
    
    @retry_on_failure(max_retries=3, delay=1, exceptions=(Exception,))
    def suggest_subreddits(self, topic_or_product, is_custom_prompt=False):
        """
        Use Claude to suggest relevant subreddits for a topic or product
        
        Args:
            topic_or_product (str): The topic or product name to find subreddits for
            is_custom_prompt (bool): If True, this is a custom prompt and Claude should also suggest timeline and strategy
            
        Returns:
            dict: Suggested subreddits, search queries, and optionally timeline/strategy
        """
        if not self.api_key or not self.client:
            logger.error("Claude API key not configured. Cannot suggest subreddits.")
            return {
                "error": "Claude API key not configured",
                "subreddits": [],
                "search_queries": []
            }
        
        if is_custom_prompt:
            prompt = f"""You are helping to discover insights based on this custom prompt: "{topic_or_product}"

This could be about:
- Market gaps and opportunities
- Product ideas and features
- Industry trends and needs
- User pain points and problems
- Business opportunities
- Technology trends

Please analyze this prompt and suggest:
1. 5-10 relevant subreddit names (just the subreddit name, without r/ prefix, no explanations)
2. 8-12 search query variations that would find relevant discussions
3. The best time filter: "hour", "day", "week", "month", "year", or "all" (choose based on how recent/relevant the discussions should be)
4. A recommended search strategy (brief description)

Respond with valid JSON in this exact format:
{{
    "subreddits": ["subreddit1", "subreddit2", ...],
    "search_queries": ["query 1", "query 2", ...],
    "recommended_time_filter": "week",
    "strategy": "Brief description of search strategy"
}}

Focus on finding the most relevant discussions that would help answer or explore: "{topic_or_product}"
Make search queries diverse to capture different angles: pain points, opportunities, features, alternatives, market needs, etc."""
        else:
            prompt = f"""You are helping to find relevant Reddit subreddits and search queries for: "{topic_or_product}"

This could be:
- A product (software, hardware, service, app, tool)
- A feature or functionality
- A market gap or opportunity
- An industry or domain
- A problem or pain point
- A business idea or startup concept

Please suggest:
1. 5-10 relevant subreddit names (just the subreddit name, without r/ prefix, no explanations)
2. 8-12 search query variations that would find relevant discussions about this topic on Reddit

For search queries, include variations for:
- Problems, issues, complaints, bugs
- Feature requests and improvements
- Alternatives and comparisons
- Reviews and experiences
- Market gaps and opportunities
- Use cases and workflows
- Pricing and value discussions

Respond with valid JSON in this exact format:
{{
    "subreddits": ["subreddit1", "subreddit2", ...],
    "search_queries": ["query 1", "query 2", ...]
}}

Focus on subreddits where users would discuss, complain about, ask questions, or share experiences about "{topic_or_product}".
Make search queries diverse to capture different angles: pain points, opportunities, features, alternatives, market needs, etc."""
        
        try:
            logger.info(f"Requesting subreddit suggestions from Claude for: {topic_or_product}")
            response = self.client.messages.create(
                model=self.model,
                max_tokens=1000,
                messages=[{"role": "user", "content": prompt}]
            )
            
            # Extract text content from response
            content = response.content[0].text
            # Try to extract JSON from the response (might be wrapped in markdown code blocks)
            if "```json" in content:
                json_start = content.find("```json") + 7
                json_end = content.find("```", json_start)
                content = content[json_start:json_end].strip()
            elif "```" in content:
                json_start = content.find("```") + 3
                json_end = content.find("```", json_start)
                content = content[json_start:json_end].strip()
            
            result = json.loads(content)
            logger.info(f"Claude suggested {len(result.get('subreddits', []))} subreddits and {len(result.get('search_queries', []))} queries")
            
            return result
            
        except Exception as e:
            logger.error(f"Error getting subreddit suggestions from Claude: {str(e)}")
            # Return fallback suggestions
            return {
                "error": str(e),
                "subreddits": ["programming", "webdev", "technology", "software", "productivity"],
                "search_queries": [topic_or_product, f"{topic_or_product} issue", f"{topic_or_product} problem"]
            }
        
    def analyze_common_pain_points(self, posts, product_name):
        """
        Analyze multiple posts to identify common pain points for a product
        
        Args:
            posts (list): List of RedditPost objects
            product_name (str): Name of the product being analyzed
            
        Returns:
            dict: Common pain points analysis
        """
        # Try to initialize client if it's not already initialized
        if not self.client and self.api_key:
            self.initialize_client(self.api_key)
            
        if not self.api_key or not self.client:
            logger.error("Claude API key not configured. Cannot analyze common pain points.")
            return {
                "error": "Claude API key not configured",
                "common_pain_points": []
            }
            
        if not posts:
            return {
                "common_pain_points": [],
                "analysis_summary": "No posts to analyze"
            }
            
        # Prepare post data for the API
        post_texts = []
        for idx, post in enumerate(posts[:50]):  # Limit to 50 posts to avoid token limits
            post_data = {
                "title": post.title,
                "content": post.content[:500] if post.content else "",  # Truncate long content
                "score": post.score,
                "num_comments": post.num_comments
            }
            post_texts.append(post_data)
        
        # Create a prompt for Claude
        prompt = f"""Analyze the following Reddit posts that may be related to {product_name}. Your task is to identify up to 10 distinct pain points that users have *clearly* associated with {product_name}. Do not include general complaints unless they are specifically tied to {product_name}.

{json.dumps(post_texts, indent=2)}

From these posts, extract only the pain points that are genuinely and explicitly relevant to {product_name}.

For each pain point, provide:
1. A concise name (max 3-5 words)
2. A detailed description of the issue
3. The severity level (high, medium, low)
4. Potential solutions or workarounds
5. Related keywords or phrases that frequently appear

Respond with valid JSON in this exact format:
{{
    "common_pain_points": [
        {{
            "name": "Pain point name",
            "description": "Detailed description",
            "severity": "high|medium|low",
            "potential_solutions": "Suggestions for addressing this issue",
            "related_keywords": ["keyword1", "keyword2"]
        }}
    ],
    "analysis_summary": "Brief overview of your findings"
}}

Skip any that are not clearly connected to {product_name}."""
        
        try:
            logger.info(f"Sending request to Claude to analyze pain points for {product_name}")
            response = self.client.messages.create(
                model=self.model,
                max_tokens=2000,
                messages=[{"role": "user", "content": prompt}]
            )
            
            # Extract text content from response
            content = response.content[0].text
            # Try to extract JSON from the response (might be wrapped in markdown code blocks)
            if "```json" in content:
                json_start = content.find("```json") + 7
                json_end = content.find("```", json_start)
                content = content[json_start:json_end].strip()
            elif "```" in content:
                json_start = content.find("```") + 3
                json_end = content.find("```", json_start)
                content = content[json_start:json_end].strip()
            
            result = json.loads(content)
            logger.info(f"Successfully analyzed common pain points for {product_name}")
            
            # Add timestamp to the results
            result["analysis_timestamp"] = datetime.now().isoformat()
            result["product"] = product_name
            
            return result
            
        except Exception as e:
            logger.error(f"Error analyzing pain points with Claude: {str(e)}")
            return {
                "error": str(e),
                "common_pain_points": [],
                "analysis_summary": f"Error during analysis: {str(e)}"
            }

            
    def generate_recommendations(self, pain_points, product_name):
        """
        Generate recommendations for addressing the identified pain points
        
        Args:
            pain_points (list): List of pain point dictionaries
            product_name (str): Name of the product
            
        Returns:
            dict: Recommendations for product improvements
        """
        # Try to initialize client if it's not already initialized
        if not self.client and self.api_key:
            self.initialize_client(self.api_key)
            
        if not self.api_key or not self.client:
            logger.error("Claude API key not configured. Cannot generate recommendations.")
            return {
                "error": "Claude API key not configured",
                "recommendations": []
            }
            
        if not pain_points:
            return {
                "recommendations": [],
                "summary": "No pain points to analyze"
            }
            
        # Create a prompt for Claude
        prompt = f"""Based on the following pain points identified for {product_name}:

{json.dumps(pain_points, indent=2)}

Generate actionable recommendations for how these issues could be addressed through a browser extension or similar product.

For each recommendation, provide:
1. A concise title
2. Detailed description of the solution
3. Implementation complexity (high, medium, low)
4. Potential impact on user experience (high, medium, low)
5. Date of the last user post containing this issue (YYYY-MM-DD)

Respond with valid JSON in this exact format:
{{
    "recommendations": [
        {{
            "title": "Recommendation title",
            "description": "Detailed description",
            "complexity": "high|medium|low",
            "impact": "high|medium|low",
            "addresses_pain_points": ["pain point name 1", "pain point name 2", ...],
            "most_recent_occurence": "YYYY-MM-DD"
        }}
    ],
    "summary": "Brief overview of your recommendations"
}}"""
        
        try:
            logger.info(f"Sending request to Claude to generate recommendations for {product_name}")
            response = self.client.messages.create(
                model=self.model,
                max_tokens=2000,
                messages=[{"role": "user", "content": prompt}]
            )
            
            # Extract text content from response
            content = response.content[0].text
            # Try to extract JSON from the response (might be wrapped in markdown code blocks)
            if "```json" in content:
                json_start = content.find("```json") + 7
                json_end = content.find("```", json_start)
                content = content[json_start:json_end].strip()
            elif "```" in content:
                json_start = content.find("```") + 3
                json_end = content.find("```", json_start)
                content = content[json_start:json_end].strip()
            
            result = json.loads(content)
            logger.info(f"Successfully generated recommendations for {product_name}")
            
            # Add timestamp to the results
            result["timestamp"] = datetime.now().isoformat()
            result["product"] = product_name
            
            return result
            
        except Exception as e:
            logger.error(f"Error generating recommendations with Claude: {str(e)}")
            return {
                "error": str(e),
                "recommendations": [],
                "summary": f"Error during recommendation generation: {str(e)}"
            }


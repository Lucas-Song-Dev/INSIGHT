import json
import logging
import os
from anthropic import Anthropic
from datetime import datetime

logger = logging.getLogger(__name__)

class AnthropicAnalyzer:
    """
    Uses Anthropic's Claude API to analyze Reddit posts and identify common pain points.
    """

    def __init__(self, api_key=None):
        """
        Initialize the Anthropic analyzer

        Args:
            api_key (str, optional): Anthropic API key. If not provided, will try to get from environment.
        """
        # Try to get API key from parameter, then from environment variable
        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
        self.client = None

        # Use the cheapest Claude model available
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
            logger.error("No API key provided to initialize Anthropic client")
            return False

        try:
            self.client = Anthropic(api_key=api_key)
            self.api_key = api_key
            logger.info("Anthropic client initialized successfully")
            return True
        except Exception as e:
            logger.error(f"Error initializing Anthropic client: {str(e)}")
            return False

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
            logger.error("Anthropic API key not configured. Cannot analyze common pain points.")
            return {
                "error": "Anthropic API key not configured",
                "common_pain_points": []
            }

        if not posts:
            return {
                "common_pain_points": [],
                "analysis_summary": "No posts to analyze"
            }

        # Prepare post data for the API
        post_texts = []
        for idx, post in enumerate(posts):
            post_data = {
                "title": post.title,
                "content": post.content,
                "score": post.score,
                "num_comments": post.num_comments
            }
            post_texts.append(post_data)

        # Create a prompt for Claude
        prompt = f"""
        Analyze the following Reddit posts that may be related to {product_name}. Your task is to identify up to 10 distinct pain points that users have *clearly* associated with {product_name}. Do not include general complaints unless they are specifically tied to {product_name}.

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

        Skip any that are not clearly connected to {product_name}.
        """

        try:
            logger.info(f"Sending request to Anthropic to analyze pain points for {product_name}")
            response = self.client.messages.create(
                model=self.model,
                max_tokens=1500,
                temperature=0.7,
                system="You are an expert at analyzing user feedback and identifying product pain points. Provide structured, actionable insights.",
                messages=[
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            )

            # Parse the response
            result = json.loads(response.content[0].text)
            logger.info(f"Successfully analyzed common pain points for {product_name}")

            # Add timestamp to the results
            result["analysis_timestamp"] = datetime.now().isoformat()
            result["product"] = product_name

            return result

        except Exception as e:
            logger.error(f"Error analyzing pain points with Anthropic: {str(e)}")
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
            logger.error("Anthropic API key not configured. Cannot generate recommendations.")
            return {
                "error": "Anthropic API key not configured",
                "recommendations": []
            }

        if not pain_points:
            return {
                "recommendations": [],
                "summary": "No pain points to analyze"
            }

        # Create a prompt for Claude
        prompt = f"""
        Based on the following pain points identified for {product_name}:

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
        }}
        """

        try:
            logger.info(f"Sending request to Anthropic to generate recommendations for {product_name}")
            response = self.client.messages.create(
                model=self.model,
                max_tokens=1500,
                temperature=0.7,
                system="You are an expert product manager who generates actionable recommendations based on user feedback analysis.",
                messages=[
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            )

            # Parse the response
            result = json.loads(response.content[0].text)
            logger.info(f"Successfully generated recommendations for {product_name}")

            # Add timestamp to the results
            result["timestamp"] = datetime.now().isoformat()
            result["product"] = product_name

            return result

        except Exception as e:
            logger.error(f"Error generating recommendations with Anthropic: {str(e)}")
            return {
                "error": str(e),
                "recommendations": [],
                "summary": f"Error during recommendation generation: {str(e)}"
            }

import json
import logging
import os
from openai import OpenAI
from datetime import datetime

logger = logging.getLogger(__name__)

class OpenAIAnalyzer:
    """
    Uses OpenAI's API to analyze Reddit posts and identify common pain points.
    """
    
    def __init__(self, api_key=None):
        """
        Initialize the OpenAI analyzer
        
        Args:
            api_key (str, optional): OpenAI API key. If not provided, will try to get from environment.
        """
        # Try to get API key from parameter, then from environment variable
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.client = None
        
        # Do not change this unless explicitly requested by the user
        self.model = "gpt-4o-mini"
        
        # Initialize client if API key is available
        if self.api_key:
            self.initialize_client(self.api_key)
        else:
            logger.warning("OpenAI API key not found. API key must be provided with each request.")
            
    def initialize_client(self, api_key):
        """
        Initialize the OpenAI client with the provided API key
        
        Args:
            api_key (str): OpenAI API key
            
        Returns:
            bool: True if client was initialized successfully, False otherwise
        """
        if not api_key:
            logger.error("No API key provided to initialize OpenAI client")
            return False
            
        try:
            self.client = OpenAI(api_key=api_key)
            self.api_key = api_key
            logger.info("OpenAI client initialized successfully")
            return True
        except Exception as e:
            logger.error(f"Error initializing OpenAI client: {str(e)}")
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
            logger.error("OpenAI API key not configured. Cannot analyze common pain points.")
            return {
                "error": "OpenAI API key not configured",
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
        
        # Create a prompt for OpenAI
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
            logger.info(f"Sending request to OpenAI to analyze pain points for {product_name}")
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                max_tokens=1500
            )
            
            # Parse the response
            result = json.loads(response.choices[0].message.content)
            logger.info(f"Successfully analyzed common pain points for {product_name}")
            
            # Add timestamp to the results
            result["analysis_timestamp"] = datetime.now().isoformat()
            result["product"] = product_name
            
            return result
            
        except Exception as e:
            logger.error(f"Error analyzing pain points with OpenAI: {str(e)}")
            return {
                "error": str(e),
                "common_pain_points": [],
                "analysis_summary": f"Error during analysis: {str(e)}"
            }

            
    def generate_recommendations(self, pain_points, product_name, recommendation_type="improve_product", context=None):
        """
        Generate recommendations for addressing the identified pain points.

        Args:
            pain_points (list): List of pain point dictionaries
            product_name (str): Name of the product
            recommendation_type (str): improve_product, new_feature, or competing_product
            context (str|None): Optional user direction (max 500 chars), included in prompt

        Returns:
            dict: Recommendations with recommendations list and summary
        """
        # Try to initialize client if it's not already initialized
        if not self.client and self.api_key:
            self.initialize_client(self.api_key)

        if not self.api_key or not self.client:
            logger.error("OpenAI API key not configured. Cannot generate recommendations.")
            return {
                "error": "OpenAI API key not configured",
                "recommendations": []
            }

        if not pain_points:
            return {
                "recommendations": [],
                "summary": "No pain points to analyze"
            }

        type_val = (recommendation_type or "improve_product").strip().lower()
        if type_val not in ("improve_product", "new_feature", "competing_product"):
            type_val = "improve_product"

        if type_val == "improve_product":
            instruction = "Generate actionable recommendations for **improving the existing product** (e.g. UX, reliability, support, pricing, onboarding). Do not suggest building browser extensions or separate tools; focus on changes to the product itself. Do not frame recommendations as new feature requests; focus on improvements to current experience and operations."
        elif type_val == "new_feature":
            instruction = "Given these pain points, recommend **new features** (discrete, shippable feature requests) that would address them. Focus on specific feature ideas, not general product improvements or a new product."
        else:
            instruction = "Given these pain points, describe a **competing product** concept that could win users by solving these problems. Include product concept, key differentiators, and how it addresses each pain point."

        context_line = ""
        if context and isinstance(context, str):
            ctx = context.strip()[:500]
            if ctx:
                context_line = f"\n\nAdditional direction from the user: {ctx}"

        prompt = f"""
        Based on the following pain points identified for {product_name}:

        {json.dumps(pain_points, indent=2)}

        {instruction}{context_line}

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
            logger.info(f"Sending request to OpenAI to generate recommendations for {product_name}")
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                max_tokens=1500
            )
            
            # Parse the response
            result = json.loads(response.choices[0].message.content)
            logger.info(f"Successfully generated recommendations for {product_name}")
            
            # Add timestamp to the results
            result["timestamp"] = datetime.now().isoformat()
            result["product"] = product_name
            
            return result
            
        except Exception as e:
            logger.error(f"Error generating recommendations with OpenAI: {str(e)}")
            return {
                "error": str(e),
                "recommendations": [],
                "summary": f"Error during recommendation generation: {str(e)}"
            }
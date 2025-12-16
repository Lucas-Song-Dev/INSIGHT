#!/usr/bin/env python3
"""
Simple test to verify Anthropic integration works
"""
import os
import sys
sys.path.append('.')

from anthropic_analyzer import AnthropicAnalyzer

def test_anthropic_integration():
    """Test that Anthropic analyzer can be initialized"""
    print("Testing Anthropic integration...")

    # Check if API key is available
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        print("❌ ANTHROPIC_API_KEY not found in environment")
        return False

    print(f"✅ Found API key: {api_key[:20]}...")

    # Try to initialize analyzer
    try:
        analyzer = AnthropicAnalyzer(api_key)
        print("✅ AnthropicAnalyzer initialized successfully")
        print(f"   Model: {analyzer.model}")
        print(f"   API Key configured: {analyzer.api_key is not None}")
        return True
    except Exception as e:
        print(f"❌ Failed to initialize AnthropicAnalyzer: {e}")
        return False

if __name__ == "__main__":
    success = test_anthropic_integration()
    sys.exit(0 if success else 1)

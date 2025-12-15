import { vi } from 'vitest';

// Mock API responses
export const mockApiResponses = {
  // User authentication
  loginUser: {
    success: { status: 'success', message: 'Authentication successful' },
    error: { status: 'error', message: 'Invalid credentials' }
  },
  
  registerUser: {
    success: { status: 'success', message: 'User registered successfully' },
    error: { status: 'error', message: 'Username already exists' }
  },
  
  logoutUser: {
    success: { status: 'success', message: 'Logout successful' }
  },
  
  // User profile
  fetchUserProfile: {
    success: {
      status: 'success',
      user: {
        username: 'testuser',
        email: 'test@example.com',
        credits: 15,
        created_at: '2024-01-01T00:00:00Z',
        last_login: '2024-01-15T12:00:00Z'
      }
    },
    error: { status: 'error', message: 'User not found' }
  },
  
  updateUserCredits: {
    success: {
      status: 'success',
      message: 'Credits updated for testuser',
      old_credits: 15,
      new_credits: 20
    },
    error: { status: 'error', message: 'Insufficient credits' }
  },
  
  // Posts/Discussions
  fetchPosts: {
    success: {
      status: 'success',
      count: 2,
      posts: [
        {
          id: '1',
          title: 'Test Discussion 1',
          body: 'This is a test discussion about React',
          author: 'testuser1',
          subreddit: 'reactjs',
          url: 'https://reddit.com/r/reactjs/1',
          created_utc: '2024-01-01T00:00:00Z',
          score: 100,
          num_comments: 25,
          sentiment: 0.5,
          products: ['react'],
          topics: ['development'],
          pain_points: ['performance:slow']
        },
        {
          id: '2',
          title: 'Test Discussion 2',
          body: 'Another test discussion',
          author: 'testuser2',
          subreddit: 'javascript',
          url: 'https://reddit.com/r/javascript/2',
          created_utc: '2024-01-02T00:00:00Z',
          score: 50,
          num_comments: 10,
          sentiment: -0.3,
          products: ['javascript'],
          topics: ['bugs'],
          pain_points: ['usability:confusing']
        }
      ]
    },
    empty: { status: 'success', count: 0, posts: [] },
    error: { status: 'error', message: 'Failed to fetch posts' }
  },
  
  // Scraping
  triggerScrape: {
    success: {
      status: 'success',
      message: 'Scraping job started. 2 credits will be deducted.',
      topic: 'react',
      product: 'react',
      credit_cost: 2
    },
    insufficientCredits: {
      status: 'error',
      message: 'Insufficient credits. This operation costs 2 credits, but you only have 1.',
      required_credits: 2,
      available_credits: 1
    },
    error: { status: 'error', message: 'Scraping failed' }
  },
  
  // Analysis
  fetchClaudeAnalysis: {
    success: {
      status: 'success',
      claude_enabled: true,
      analyses: [
        {
          product: 'react',
          common_pain_points: [
            {
              category: 'Performance',
              description: 'Slow rendering in large applications',
              frequency: 15,
              severity: 'high'
            }
          ]
        }
      ]
    },
    empty: {
      status: 'info',
      message: 'No Claude analyses available',
      claude_enabled: true,
      analyses: []
    },
    error: { status: 'error', message: 'Failed to fetch analysis' }
  },
  
  runAnalysis: {
    success: {
      status: 'success',
      message: 'Analysis completed for react',
      analysis: {
        product: 'react',
        common_pain_points: []
      },
      pain_points_count: 5
    },
    error: { status: 'error', message: 'Analysis failed' }
  },
  
  // Recommendations
  fetchSavedRecommendations: {
    success: {
      status: 'success',
      recommendations: [
        {
          product: 'react',
          recommendations: [
            {
              title: 'Optimize Performance',
              description: 'Use React.memo and useMemo for expensive calculations'
            }
          ]
        }
      ]
    },
    empty: {
      status: 'info',
      message: 'No saved recommendations found',
      recommendations: []
    },
    error: { status: 'error', message: 'Failed to fetch recommendations' }
  },
  
  generateRecommendations: {
    success: {
      status: 'success',
      claude_enabled: true,
      recommendations: [
        {
          product: 'react',
          recommendations: []
        }
      ]
    },
    error: { status: 'error', message: 'Failed to generate recommendations' }
  },
  
  // Products
  fetchAllProducts: {
    success: {
      status: 'success',
      products: [
        {
          name: 'react',
          has_analysis: true,
          has_recommendations: true
        },
        {
          name: 'javascript',
          has_analysis: false,
          has_recommendations: false
        }
      ]
    },
    error: { status: 'error', message: 'Failed to fetch products' }
  },
  
  // Status
  fetchStatus: {
    success: {
      status: 'success',
      scrape_in_progress: false,
      raw_posts_count: 100,
      analyzed_posts_count: 95,
      pain_points_count: 25,
      claude_analyses_count: 5,
      apis: {
        reddit: 'connected',
        claude: 'connected'
      }
    },
    error: { status: 'error', message: 'Failed to fetch status' }
  },
  
  // Pain points
  fetchPainPoints: {
    success: {
      status: 'success',
      count: 2,
      pain_points: [
        {
          name: 'Slow Performance',
          description: 'Application runs slowly',
          frequency: 15,
          avg_sentiment: -0.7,
          product: 'react',
          severity: 10.5
        }
      ]
    },
    error: { status: 'error', message: 'Failed to fetch pain points' }
  }
};

// Create mock functions for all API methods
export const createMockApi = () => ({
  // Authentication
  loginUser: vi.fn(),
  registerUser: vi.fn(),
  logoutUser: vi.fn(),
  
  // User profile
  fetchUserProfile: vi.fn(),
  updateUserCredits: vi.fn(),
  
  // Posts
  fetchPosts: vi.fn(),
  triggerScrape: vi.fn(),
  
  // Analysis
  fetchClaudeAnalysis: vi.fn(),
  fetchOpenAIAnalysis: vi.fn(), // Alias
  runAnalysis: vi.fn(),
  
  // Recommendations
  fetchSavedRecommendations: vi.fn(),
  generateRecommendations: vi.fn(),
  
  // Products
  fetchAllProducts: vi.fn(),
  
  // Status
  fetchStatus: vi.fn(),
  
  // Pain points
  fetchPainPoints: vi.fn()
});

// Helper to set up common mock scenarios
export const setupMockScenario = (mockApi, scenario = 'success') => {
  Object.keys(mockApi).forEach(method => {
    if (mockApiResponses[method] && mockApiResponses[method][scenario]) {
      mockApi[method].mockResolvedValue(mockApiResponses[method][scenario]);
    } else if (scenario === 'success' && mockApiResponses[method]) {
      // Default to success if available
      mockApi[method].mockResolvedValue(mockApiResponses[method].success);
    }
  });
  
  // Set up alias
  mockApi.fetchOpenAIAnalysis = mockApi.fetchClaudeAnalysis;
  
  return mockApi;
};
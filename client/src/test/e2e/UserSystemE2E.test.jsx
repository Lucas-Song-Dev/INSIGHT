import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import App from '../../App';
import { AuthProvider } from '../../context/AuthContext';
import { NotificationProvider } from '../../context/NotificationContext';

// These tests run against the actual backend API
// Make sure the backend server is running on localhost:5000

const API_BASE_URL = 'http://localhost:5000/api';

// Test utilities
const renderApp = () => {
  return render(
    <AuthProvider>
      <NotificationProvider>
        <App />
      </NotificationProvider>
    </AuthProvider>
  );
};

const generateTestUser = () => ({
  username: `testuser_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  password: 'TestPassword123!',
  email: `test_${Date.now()}@example.com`
});

const cleanupTestUser = async (username) => {
  try {
    // In a real scenario, you'd have an admin API to delete test users
    // For now, we'll just log that cleanup is needed
    console.log(`Test cleanup needed for user: ${username}`);
  } catch (error) {
    console.warn('Failed to cleanup test user:', error);
  }
};

// E2E tests require a running backend; skip unless VITE_E2E=true
const isE2E = process.env.VITE_E2E === 'true';
describe.skipIf(!isE2E)('User System E2E Tests', () => {
  let testUser;
  let createdUsers = [];

  beforeAll(() => {
    // Ensure we're testing against the right environment
    if (!window.location.href.includes('localhost')) {
      throw new Error('E2E tests should only run against localhost');
    }
  });

  beforeEach(() => {
    testUser = generateTestUser();
  });

  afterEach(async () => {
    // Cleanup any users created during tests
    for (const username of createdUsers) {
      await cleanupTestUser(username);
    }
    createdUsers = [];
  });

  describe('User Registration E2E', () => {
    it('should register a new user and automatically login', async () => {
      const user = userEvent.setup();
      
      renderApp();

      // Should show login page initially
      await waitFor(() => {
        expect(screen.getByText(/login/i)).toBeInTheDocument();
      }, { timeout: 10000 });

      // Navigate to registration
      const registerLink = screen.getByText(/register/i);
      await user.click(registerLink);

      // Fill registration form
      const usernameInput = screen.getByLabelText(/username/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const emailInput = screen.getByLabelText(/email/i);

      await user.type(usernameInput, testUser.username);
      await user.type(passwordInput, testUser.password);
      await user.type(emailInput, testUser.email);

      // Submit registration
      const registerButton = screen.getByRole('button', { name: /register/i });
      await user.click(registerButton);

      // Should show success message and redirect to main app
      await waitFor(() => {
        expect(screen.getByText('INSIGHT Analyzer')).toBeInTheDocument();
      }, { timeout: 15000 });

      // Track user for cleanup
      createdUsers.push(testUser.username);

      // Verify user is logged in by checking for navigation elements
      expect(screen.getByTitle('User Profile')).toBeInTheDocument();
      expect(screen.getByTitle('Logout')).toBeInTheDocument();
    }, 30000);

    it('should show error for duplicate username registration', async () => {
      const user = userEvent.setup();
      
      // First, register a user
      renderApp();

      await waitFor(() => {
        expect(screen.getByText(/login/i)).toBeInTheDocument();
      });

      const registerLink = screen.getByText(/register/i);
      await user.click(registerLink);

      await user.type(screen.getByLabelText(/username/i), testUser.username);
      await user.type(screen.getByLabelText(/password/i), testUser.password);
      await user.type(screen.getByLabelText(/email/i), testUser.email);

      const registerButton = screen.getByRole('button', { name: /register/i });
      await user.click(registerButton);

      await waitFor(() => {
        expect(screen.getByText('INSIGHT Analyzer')).toBeInTheDocument();
      }, { timeout: 15000 });

      createdUsers.push(testUser.username);

      // Now try to register the same user again
      const logoutButton = screen.getByTitle('Logout');
      await user.click(logoutButton);

      await waitFor(() => {
        expect(screen.getByText(/login/i)).toBeInTheDocument();
      });

      const registerLink2 = screen.getByText(/register/i);
      await user.click(registerLink2);

      await user.type(screen.getByLabelText(/username/i), testUser.username);
      await user.type(screen.getByLabelText(/password/i), testUser.password);
      await user.type(screen.getByLabelText(/email/i), 'different@example.com');

      const registerButton2 = screen.getByRole('button', { name: /register/i });
      await user.click(registerButton2);

      // Should show duplicate username error
      await waitFor(() => {
        expect(screen.getByText(/username already exists/i)).toBeInTheDocument();
      }, { timeout: 10000 });
    }, 45000);
  });

  describe('User Login E2E', () => {
    beforeEach(async () => {
      // Create a test user first
      const response = await fetch(`${API_BASE_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(testUser)
      });
      
      if (response.ok) {
        createdUsers.push(testUser.username);
      }
    });

    it('should login with valid credentials', async () => {
      const user = userEvent.setup();
      
      renderApp();

      await waitFor(() => {
        expect(screen.getByText(/login/i)).toBeInTheDocument();
      });

      // Fill login form
      await user.type(screen.getByLabelText(/username/i), testUser.username);
      await user.type(screen.getByLabelText(/password/i), testUser.password);

      const loginButton = screen.getByRole('button', { name: /login/i });
      await user.click(loginButton);

      // Should redirect to main app
      await waitFor(() => {
        expect(screen.getByText('INSIGHT Analyzer')).toBeInTheDocument();
      }, { timeout: 15000 });

      // Should show user navigation elements
      expect(screen.getByTitle('User Profile')).toBeInTheDocument();
      expect(screen.getByTitle('Logout')).toBeInTheDocument();
    }, 30000);

    it('should show error for invalid credentials', async () => {
      const user = userEvent.setup();
      
      renderApp();

      await waitFor(() => {
        expect(screen.getByText(/login/i)).toBeInTheDocument();
      });

      // Try to login with wrong password
      await user.type(screen.getByLabelText(/username/i), testUser.username);
      await user.type(screen.getByLabelText(/password/i), 'wrongpassword');

      const loginButton = screen.getByRole('button', { name: /login/i });
      await user.click(loginButton);

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
      }, { timeout: 10000 });

      // Should still be on login page
      expect(screen.getByText(/login/i)).toBeInTheDocument();
    }, 20000);
  });

  describe('User Profile E2E', () => {
    beforeEach(async () => {
      // Create and login test user
      await fetch(`${API_BASE_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(testUser)
      });
      createdUsers.push(testUser.username);
    });

    it('should display user profile with correct information', async () => {
      const user = userEvent.setup();
      
      renderApp();

      // Login
      await waitFor(() => {
        expect(screen.getByText(/login/i)).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/username/i), testUser.username);
      await user.type(screen.getByLabelText(/password/i), testUser.password);
      await user.click(screen.getByRole('button', { name: /login/i }));

      await waitFor(() => {
        expect(screen.getByText('INSIGHT Analyzer')).toBeInTheDocument();
      }, { timeout: 15000 });

      // Should show credits in navigation (new users get 5 credits)
      await waitFor(() => {
        expect(screen.getByText('5 credits')).toBeInTheDocument();
      }, { timeout: 10000 });

      // Open profile modal
      const profileButton = screen.getByTitle('User Profile');
      await user.click(profileButton);

      // Should show profile information
      await waitFor(() => {
        expect(screen.getByText('User Profile')).toBeInTheDocument();
        expect(screen.getByText(testUser.username)).toBeInTheDocument();
        expect(screen.getByText(testUser.email)).toBeInTheDocument();
        expect(screen.getByText('5')).toBeInTheDocument(); // Credits
      }, { timeout: 10000 });

      // Should show cost breakdown
      expect(screen.getByText('Cost Examples:')).toBeInTheDocument();
      expect(screen.getByText(/Small analysis.*2 credits/)).toBeInTheDocument();
    }, 40000);

    it('should close profile modal when clicking close button', async () => {
      const user = userEvent.setup();
      
      renderApp();

      // Login
      await waitFor(() => {
        expect(screen.getByText(/login/i)).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/username/i), testUser.username);
      await user.type(screen.getByLabelText(/password/i), testUser.password);
      await user.click(screen.getByRole('button', { name: /login/i }));

      await waitFor(() => {
        expect(screen.getByText('INSIGHT Analyzer')).toBeInTheDocument();
      });

      // Open profile
      const profileButton = screen.getByTitle('User Profile');
      await user.click(profileButton);

      await waitFor(() => {
        expect(screen.getByText('User Profile')).toBeInTheDocument();
      });

      // Close profile
      const closeButton = screen.getByRole('button', { name: '×' });
      await user.click(closeButton);

      // Modal should be closed
      await waitFor(() => {
        expect(screen.queryByText('User Profile')).not.toBeInTheDocument();
      });
    }, 30000);
  });

  describe('Credits System E2E', () => {
    beforeEach(async () => {
      // Create test user
      await fetch(`${API_BASE_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(testUser)
      });
      createdUsers.push(testUser.username);
    });

    it('should show insufficient credits error for expensive operations', async () => {
      const user = userEvent.setup();
      
      renderApp();

      // Login
      await waitFor(() => {
        expect(screen.getByText(/login/i)).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/username/i), testUser.username);
      await user.type(screen.getByLabelText(/password/i), testUser.password);
      await user.click(screen.getByRole('button', { name: /login/i }));

      await waitFor(() => {
        expect(screen.getByText('INSIGHT Analyzer')).toBeInTheDocument();
      });

      // Navigate to scrape page
      const findInsightsButton = screen.getByText('Find Insights');
      await user.click(findInsightsButton);

      await waitFor(() => {
        expect(screen.getByTestId('scrape-page')).toBeInTheDocument();
      });

      // Try to start an expensive operation (user only has 5 credits)
      const topicInput = screen.getByLabelText(/topic/i);
      await user.type(topicInput, 'react');

      // Set expensive parameters
      const limitInput = screen.getByLabelText(/limit/i);
      await user.clear(limitInput);
      await user.type(limitInput, '200'); // This should cost more than 5 credits

      const timeFilterSelect = screen.getByLabelText(/time filter/i);
      await user.selectOptions(timeFilterSelect, 'all');

      const startButton = screen.getByRole('button', { name: /start analysis/i });
      await user.click(startButton);

      // Should show insufficient credits error
      await waitFor(() => {
        expect(screen.getByText(/insufficient credits/i)).toBeInTheDocument();
      }, { timeout: 15000 });
    }, 45000);

    it('should successfully start analysis with sufficient credits', async () => {
      const user = userEvent.setup();
      
      renderApp();

      // Login
      await waitFor(() => {
        expect(screen.getByText(/login/i)).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/username/i), testUser.username);
      await user.type(screen.getByLabelText(/password/i), testUser.password);
      await user.click(screen.getByRole('button', { name: /login/i }));

      await waitFor(() => {
        expect(screen.getByText('INSIGHT Analyzer')).toBeInTheDocument();
      });

      // Navigate to scrape page
      const findInsightsButton = screen.getByText('Find Insights');
      await user.click(findInsightsButton);

      await waitFor(() => {
        expect(screen.getByTestId('scrape-page')).toBeInTheDocument();
      });

      // Start a small operation that should be within credit limit
      const topicInput = screen.getByLabelText(/topic/i);
      await user.type(topicInput, 'react');

      // Use default parameters (should cost 2 credits)
      const startButton = screen.getByRole('button', { name: /start analysis/i });
      await user.click(startButton);

      // Should show success message
      await waitFor(() => {
        expect(screen.getByText(/scraping job started/i)).toBeInTheDocument();
        expect(screen.getByText(/credits will be deducted/i)).toBeInTheDocument();
      }, { timeout: 15000 });
    }, 45000);
  });

  describe('Logout E2E', () => {
    beforeEach(async () => {
      // Create test user
      await fetch(`${API_BASE_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(testUser)
      });
      createdUsers.push(testUser.username);
    });

    it('should logout successfully and return to login page', async () => {
      const user = userEvent.setup();
      
      renderApp();

      // Login
      await waitFor(() => {
        expect(screen.getByText(/login/i)).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/username/i), testUser.username);
      await user.type(screen.getByLabelText(/password/i), testUser.password);
      await user.click(screen.getByRole('button', { name: /login/i }));

      await waitFor(() => {
        expect(screen.getByText('INSIGHT Analyzer')).toBeInTheDocument();
      });

      // Logout
      const logoutButton = screen.getByTitle('Logout');
      await user.click(logoutButton);

      // Should return to login page
      await waitFor(() => {
        expect(screen.getByText(/login/i)).toBeInTheDocument();
      }, { timeout: 10000 });

      // Should not show authenticated elements
      expect(screen.queryByTitle('User Profile')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Logout')).not.toBeInTheDocument();
    }, 30000);
  });

  describe('Authentication Persistence E2E', () => {
    beforeEach(async () => {
      // Create test user
      await fetch(`${API_BASE_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(testUser)
      });
      createdUsers.push(testUser.username);
    });

    it('should maintain authentication after page refresh', async () => {
      const user = userEvent.setup();
      
      renderApp();

      // Login
      await waitFor(() => {
        expect(screen.getByText(/login/i)).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/username/i), testUser.username);
      await user.type(screen.getByLabelText(/password/i), testUser.password);
      await user.click(screen.getByRole('button', { name: /login/i }));

      await waitFor(() => {
        expect(screen.getByText('INSIGHT Analyzer')).toBeInTheDocument();
      });

      // Simulate page refresh by re-rendering the app
      const { unmount } = screen;
      unmount();
      
      renderApp();

      // Should automatically be logged in (cookies should persist)
      await waitFor(() => {
        expect(screen.getByText('INSIGHT Analyzer')).toBeInTheDocument();
      }, { timeout: 15000 });

      // Should show authenticated elements
      expect(screen.getByTitle('User Profile')).toBeInTheDocument();
      expect(screen.getByTitle('Logout')).toBeInTheDocument();
    }, 40000);
  });

  describe('Error Handling E2E', () => {
    it('should handle server errors gracefully', async () => {
      const user = userEvent.setup();
      
      renderApp();

      await waitFor(() => {
        expect(screen.getByText(/login/i)).toBeInTheDocument();
      });

      // Try to login with a username that might cause server issues
      await user.type(screen.getByLabelText(/username/i), 'nonexistentuser');
      await user.type(screen.getByLabelText(/password/i), 'password');

      const loginButton = screen.getByRole('button', { name: /login/i });
      await user.click(loginButton);

      // Should show appropriate error message
      await waitFor(() => {
        expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
      }, { timeout: 10000 });

      // Should remain on login page
      expect(screen.getByText(/login/i)).toBeInTheDocument();
    }, 20000);

    it('should show error boundary for component crashes', () => {
      // This test would require injecting an error into a component
      // For now, we'll just verify the error boundary component exists
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const ThrowError = () => {
        throw new Error('Test error');
      };

      render(
        <AuthProvider>
          <NotificationProvider>
            <ThrowError />
          </NotificationProvider>
        </AuthProvider>
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();

      consoleSpy.mockRestore();
    });
  });
});
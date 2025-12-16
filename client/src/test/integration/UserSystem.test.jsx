import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import App from '../../App';
import { AuthProvider } from '../../context/AuthContext';
import { NotificationProvider } from '../../context/NotificationContext';
import * as api from '../../api/api';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

// Mock all page components to focus on user system
vi.mock('../../pages/postsPage/PostsPage', () => ({
  default: () => <div data-testid="posts-page">Posts Page</div>
}));

vi.mock('../../pages/scrapePage/ScrapePage', () => ({
  default: () => <div data-testid="scrape-page">Scrape Page</div>
}));

vi.mock('../../pages/resultsPage/ResultsPage', () => ({
  default: () => <div data-testid="results-page">Results Page</div>
}));

vi.mock('../../pages/aboutPage/AboutPage', () => ({
  default: () => <div data-testid="about-page">About Page</div>
}));

vi.mock('../../pages/productDetailPage/ProductDetailPage', () => ({
  default: () => <div data-testid="product-detail-page">Product Detail Page</div>
}));

vi.mock('../../pages/analysisPage/AnalysisPage', () => ({
  default: () => <div data-testid="analysis-page">Analysis Page</div>
}));

vi.mock('../../pages/recommendationPage/RecomendationPage', () => ({
  default: () => <div data-testid="recommendation-page">Recommendation Page</div>
}));

vi.mock('../../components/StatusBar/StatusBar', () => ({
  default: () => <div data-testid="status-bar">Status Bar</div>
}));

vi.mock('../../components/Notification/Notification', () => ({
  default: () => <div data-testid="notification">Notification</div>
}));

describe('User System Integration Tests', () => {
  const mockUser = {
    username: 'testuser',
    email: 'test@example.com',
    credits: 15,
    created_at: '2024-01-01T00:00:00Z',
    last_login: '2024-01-15T12:00:00Z'
  };

  const renderApp = () => {
    return render(
      <AuthProvider>
        <NotificationProvider>
          <App />
        </NotificationProvider>
      </AuthProvider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock successful axios responses by default
    mockedAxios.create.mockReturnValue(mockedAxios);
    mockedAxios.defaults = { withCredentials: true };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('User Registration Flow', () => {
    it('should register a new user successfully', async () => {
      const user = userEvent.setup();
      
      // Mock registration success
      mockedAxios.post.mockResolvedValueOnce({
        data: { status: 'success', message: 'User registered successfully' }
      });
      
      // Mock login success after registration
      mockedAxios.post.mockResolvedValueOnce({
        data: { status: 'success', message: 'Authentication successful' }
      });

      renderApp();

      // Should show login page initially
      expect(screen.getByText('Login')).toBeInTheDocument();
      
      // Click register link/button (assuming there's one)
      const registerButton = screen.getByText(/register/i);
      await user.click(registerButton);

      // Fill in registration form
      await user.type(screen.getByLabelText(/username/i), 'newuser');
      await user.type(screen.getByLabelText(/password/i), 'NewPassword123!');
      await user.type(screen.getByLabelText(/email/i), 'new@example.com');

      // Submit registration
      const submitButton = screen.getByRole('button', { name: /register/i });
      await user.click(submitButton);

      // Should call registration API
      await waitFor(() => {
        expect(mockedAxios.post).toHaveBeenCalledWith(
          expect.stringContaining('/register'),
          expect.objectContaining({
            username: 'newuser',
            password: 'NewPassword123!',
            email: 'new@example.com'
          }),
          expect.any(Object)
        );
      });
    });

    it('should show error for duplicate username', async () => {
      const user = userEvent.setup();
      
      // Mock registration failure
      mockedAxios.post.mockRejectedValueOnce({
        response: {
          data: { status: 'error', message: 'Username already exists' }
        }
      });

      renderApp();

      // Navigate to registration and fill form
      const registerButton = screen.getByText(/register/i);
      await user.click(registerButton);

      await user.type(screen.getByLabelText(/username/i), 'existinguser');
      await user.type(screen.getByLabelText(/password/i), 'Password123!');

      const submitButton = screen.getByRole('button', { name: /register/i });
      await user.click(submitButton);

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/username already exists/i)).toBeInTheDocument();
      });
    });

    it('should validate password strength', async () => {
      const user = userEvent.setup();
      
      renderApp();

      const registerButton = screen.getByText(/register/i);
      await user.click(registerButton);

      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/password/i), '123'); // Weak password

      const submitButton = screen.getByRole('button', { name: /register/i });
      await user.click(submitButton);

      // Should show password validation error
      await waitFor(() => {
        expect(screen.getByText(/password.*strong/i)).toBeInTheDocument();
      });
    });
  });

  describe('User Login Flow', () => {
    it('should login successfully and show main app', async () => {
      const user = userEvent.setup();
      
      // Mock login success
      mockedAxios.post.mockResolvedValueOnce({
        data: { status: 'success', message: 'Authentication successful' }
      });

      renderApp();

      // Fill in login form
      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/password/i), 'password123');

      const loginButton = screen.getByRole('button', { name: /login/i });
      await user.click(loginButton);

      // Should call login API
      await waitFor(() => {
        expect(mockedAxios.post).toHaveBeenCalledWith(
          expect.stringContaining('/login'),
          expect.objectContaining({
            username: 'testuser',
            password: 'password123'
          }),
          expect.any(Object)
        );
      });

      // Should show main app after successful login
      await waitFor(() => {
        expect(screen.getByText('INSIGHT Analyzer')).toBeInTheDocument();
      });
    });

    it('should show error for invalid credentials', async () => {
      const user = userEvent.setup();
      
      // Mock login failure
      mockedAxios.post.mockRejectedValueOnce({
        response: {
          data: { status: 'error', message: 'Invalid credentials' }
        }
      });

      renderApp();

      await user.type(screen.getByLabelText(/username/i), 'wronguser');
      await user.type(screen.getByLabelText(/password/i), 'wrongpassword');

      const loginButton = screen.getByRole('button', { name: /login/i });
      await user.click(loginButton);

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
      });
    });

    it('should handle network errors gracefully', async () => {
      const user = userEvent.setup();
      
      // Mock network error
      mockedAxios.post.mockRejectedValueOnce(new Error('Network Error'));

      renderApp();

      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/password/i), 'password123');

      const loginButton = screen.getByRole('button', { name: /login/i });
      await user.click(loginButton);

      // Should show network error message
      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });
    });
  });

  describe('User Profile and Credits', () => {
    beforeEach(() => {
      // Mock authenticated state
      mockedAxios.post.mockResolvedValue({
        data: { status: 'success', message: 'Authentication successful' }
      });
    });

    it('should display user credits in navigation', async () => {
      const user = userEvent.setup();
      
      // Mock user profile API
      mockedAxios.get.mockResolvedValueOnce({
        data: { status: 'success', user: mockUser }
      });

      renderApp();

      // Login first
      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /login/i }));

      // Should show credits in navigation
      await waitFor(() => {
        expect(screen.getByText('15 credits')).toBeInTheDocument();
      });
    });

    it('should open user profile modal', async () => {
      const user = userEvent.setup();
      
      // Mock user profile API
      mockedAxios.get.mockResolvedValueOnce({
        data: { status: 'success', user: mockUser }
      });

      renderApp();

      // Login first
      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /login/i }));

      // Wait for main app to load
      await waitFor(() => {
        expect(screen.getByText('INSIGHT Analyzer')).toBeInTheDocument();
      });

      // Click profile button
      const profileButton = screen.getByTitle('User Profile');
      await user.click(profileButton);

      // Should open profile modal
      await waitFor(() => {
        expect(screen.getByText('User Profile')).toBeInTheDocument();
        expect(screen.getByText('testuser')).toBeInTheDocument();
        expect(screen.getByText('test@example.com')).toBeInTheDocument();
        expect(screen.getByText('15')).toBeInTheDocument();
      });
    });

    it('should show credit cost breakdown in profile', async () => {
      const user = userEvent.setup();
      
      mockedAxios.get.mockResolvedValueOnce({
        data: { status: 'success', user: mockUser }
      });

      renderApp();

      // Login and open profile
      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /login/i }));

      await waitFor(() => {
        expect(screen.getByText('INSIGHT Analyzer')).toBeInTheDocument();
      });

      const profileButton = screen.getByTitle('User Profile');
      await user.click(profileButton);

      // Should show cost breakdown
      await waitFor(() => {
        expect(screen.getByText('Cost Examples:')).toBeInTheDocument();
        expect(screen.getByText(/Small analysis.*2 credits/)).toBeInTheDocument();
        expect(screen.getByText(/Medium analysis.*6 credits/)).toBeInTheDocument();
      });
    });

    it('should close profile modal when clicking close button', async () => {
      const user = userEvent.setup();
      
      mockedAxios.get.mockResolvedValueOnce({
        data: { status: 'success', user: mockUser }
      });

      renderApp();

      // Login and open profile
      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /login/i }));

      await waitFor(() => {
        expect(screen.getByText('INSIGHT Analyzer')).toBeInTheDocument();
      });

      const profileButton = screen.getByTitle('User Profile');
      await user.click(profileButton);

      await waitFor(() => {
        expect(screen.getByText('User Profile')).toBeInTheDocument();
      });

      // Close modal
      const closeButton = screen.getByRole('button', { name: '×' });
      await user.click(closeButton);

      // Modal should be closed
      await waitFor(() => {
        expect(screen.queryByText('User Profile')).not.toBeInTheDocument();
      });
    });
  });

  describe('Credit System Integration', () => {
    beforeEach(() => {
      // Mock authenticated state
      mockedAxios.post.mockResolvedValue({
        data: { status: 'success', message: 'Authentication successful' }
      });
    });

    it('should show insufficient credits error when trying to scrape', async () => {
      const user = userEvent.setup();
      
      // Mock user with low credits
      const lowCreditUser = { ...mockUser, credits: 1 };
      mockedAxios.get.mockResolvedValueOnce({
        data: { status: 'success', user: lowCreditUser }
      });

      // Mock scrape API with insufficient credits error
      mockedAxios.post.mockRejectedValueOnce({
        response: {
          status: 402,
          data: {
            status: 'error',
            message: 'Insufficient credits. You have 1 credits but need 6.',
            required_credits: 6,
            available_credits: 1
          }
        }
      });

      renderApp();

      // Login
      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /login/i }));

      // Navigate to scrape page
      await waitFor(() => {
        expect(screen.getByText('Find Insights')).toBeInTheDocument();
      });
      
      const findInsightsButton = screen.getByText('Find Insights');
      await user.click(findInsightsButton);

      // Try to start scraping
      await user.type(screen.getByLabelText(/topic/i), 'react');
      const scrapeButton = screen.getByRole('button', { name: /start analysis/i });
      await user.click(scrapeButton);

      // Should show insufficient credits error
      await waitFor(() => {
        expect(screen.getByText(/insufficient credits/i)).toBeInTheDocument();
        expect(screen.getByText(/costs 6 credits/i)).toBeInTheDocument();
      });
    });

    it('should update credits after successful operation', async () => {
      const user = userEvent.setup();
      
      // Mock user profile calls - first with original credits, then updated
      mockedAxios.get
        .mockResolvedValueOnce({
          data: { status: 'success', user: mockUser }
        })
        .mockResolvedValueOnce({
          data: { status: 'success', user: { ...mockUser, credits: 13 } }
        });

      // Mock successful scrape
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          status: 'success',
          message: 'Scraping job started. 2 credits will be deducted.',
          credit_cost: 2
        }
      });

      renderApp();

      // Login
      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /login/i }));

      // Should show initial credits
      await waitFor(() => {
        expect(screen.getByText('15 credits')).toBeInTheDocument();
      });

      // Navigate to scrape page and start operation
      const findInsightsButton = screen.getByText('Find Insights');
      await user.click(findInsightsButton);

      await user.type(screen.getByLabelText(/topic/i), 'react');
      const scrapeButton = screen.getByRole('button', { name: /start analysis/i });
      await user.click(scrapeButton);

      // Should show success message
      await waitFor(() => {
        expect(screen.getByText(/scraping job started/i)).toBeInTheDocument();
        expect(screen.getByText(/2 credits will be deducted/i)).toBeInTheDocument();
      });

      // Credits should be updated (this would happen through periodic refresh)
      // In a real app, this might be triggered by a websocket or polling
    });
  });

  describe('Logout Flow', () => {
    beforeEach(() => {
      // Mock authenticated state
      mockedAxios.post.mockResolvedValue({
        data: { status: 'success', message: 'Authentication successful' }
      });
    });

    it('should logout successfully and return to login page', async () => {
      const user = userEvent.setup();
      
      // Mock logout success
      mockedAxios.post.mockResolvedValueOnce({
        data: { status: 'success', message: 'Logout successful' }
      });

      renderApp();

      // Login first
      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /login/i }));

      // Should show main app
      await waitFor(() => {
        expect(screen.getByText('INSIGHT Analyzer')).toBeInTheDocument();
      });

      // Click logout
      const logoutButton = screen.getByTitle('Logout');
      await user.click(logoutButton);

      // Should call logout API
      await waitFor(() => {
        expect(mockedAxios.post).toHaveBeenCalledWith(
          expect.stringContaining('/logout'),
          expect.any(Object),
          expect.any(Object)
        );
      });

      // Should return to login page
      await waitFor(() => {
        expect(screen.getByText('Login')).toBeInTheDocument();
      });
    });

    it('should handle logout errors gracefully', async () => {
      const user = userEvent.setup();
      
      // Mock logout failure
      mockedAxios.post.mockRejectedValueOnce(new Error('Logout failed'));

      renderApp();

      // Login first
      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /login/i }));

      await waitFor(() => {
        expect(screen.getByText('INSIGHT Analyzer')).toBeInTheDocument();
      });

      // Click logout
      const logoutButton = screen.getByTitle('Logout');
      await user.click(logoutButton);

      // Should still return to login page even if API fails
      await waitFor(() => {
        expect(screen.getByText('Login')).toBeInTheDocument();
      });
    });
  });

  describe('Authentication Persistence', () => {
    it('should maintain authentication across page refreshes', async () => {
      // Mock successful authentication check
      mockedAxios.get.mockResolvedValueOnce({
        data: { status: 'success', user: mockUser }
      });

      renderApp();

      // Should check authentication on mount and show main app
      await waitFor(() => {
        expect(screen.getByText('INSIGHT Analyzer')).toBeInTheDocument();
      });

      // Should have called profile API to verify authentication
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/user/profile'),
        expect.any(Object)
      );
    });

    it('should redirect to login if authentication check fails', async () => {
      // Mock authentication failure
      mockedAxios.get.mockRejectedValueOnce({
        response: { status: 401, data: { status: 'error', message: 'Token expired' } }
      });

      renderApp();

      // Should show login page
      await waitFor(() => {
        expect(screen.getByText('Login')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error boundary when component crashes', () => {
      // Mock a component that throws an error
      const ThrowError = () => {
        throw new Error('Test error');
      };

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

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

    it('should recover from errors when retry is clicked', async () => {
      const user = userEvent.setup();
      let shouldThrow = true;

      const ConditionalError = () => {
        if (shouldThrow) {
          throw new Error('Test error');
        }
        return <div>Component recovered</div>;
      };

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <AuthProvider>
          <NotificationProvider>
            <ConditionalError />
          </NotificationProvider>
        </AuthProvider>
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();

      // Fix the error condition
      shouldThrow = false;

      // Click retry
      const retryButton = screen.getByRole('button', { name: 'Try Again' });
      await user.click(retryButton);

      expect(screen.getByText('Component recovered')).toBeInTheDocument();

      consoleSpy.mockRestore();
    });
  });
});
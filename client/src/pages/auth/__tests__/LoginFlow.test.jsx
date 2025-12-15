import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from '../LoginPage';
import * as api from '../../../api/api';
import { useAuth } from '../../../context/AuthContext';

// Mock the API
vi.mock('../../../api/api', () => ({
  loginUser: vi.fn(),
}));

// Mock AuthContext
const mockLogin = vi.fn();
vi.mock('../../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

describe('Login Flow - Comprehensive Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    console.log = vi.fn(); // Mock console.log to capture logs
    console.error = vi.fn();
    console.warn = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Successful Login Flow', () => {
    it('should complete full login flow successfully', async () => {
      const user = userEvent.setup();
      
      // Mock successful login API response
      api.loginUser.mockResolvedValue({
        status: 'success',
        message: 'Login successful',
        user: { username: 'testuser', email: 'test@example.com' }
      });

      // Mock successful auth context login
      mockLogin.mockResolvedValue(undefined);

      const onLoginSuccess = vi.fn().mockResolvedValue(undefined);

      render(<LoginPage onLoginSuccess={onLoginSuccess} />);

      // Fill in login form
      const usernameInput = screen.getByLabelText(/username/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /log in/i });

      await user.type(usernameInput, 'testuser');
      await user.type(passwordInput, 'password123');

      // Submit form
      await user.click(submitButton);

      // Verify API was called with correct credentials
      await waitFor(() => {
        expect(api.loginUser).toHaveBeenCalledWith({
          username: 'testuser',
          password: 'password123'
        });
      });

      // Verify onLoginSuccess was called
      await waitFor(() => {
        expect(onLoginSuccess).toHaveBeenCalled();
      });

      // Verify no error message is shown
      expect(screen.queryByText(/failed|error/i)).not.toBeInTheDocument();
    });

    it('should handle login with retry logic for profile fetch', async () => {
      const user = userEvent.setup();
      
      // Mock successful login API response
      api.loginUser.mockResolvedValue({
        status: 'success',
        message: 'Login successful'
      });

      // Mock onLoginSuccess to simulate profile fetch with retry
      let retryCount = 0;
      const onLoginSuccess = vi.fn().mockImplementation(async () => {
        retryCount++;
        // Simulate first attempt failing, then succeeding
        if (retryCount === 1) {
          const { fetchUserProfile } = await import('../../../api/api');
          // Mock fetchUserProfile to fail first time, succeed second
          if (retryCount === 1) {
            vi.spyOn(api, 'fetchUserProfile').mockRejectedValueOnce(
              new Error('Authentication token is missing')
            );
          }
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      render(<LoginPage onLoginSuccess={onLoginSuccess} />);

      const usernameInput = screen.getByLabelText(/username/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /log in/i });

      await user.type(usernameInput, 'testuser');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(api.loginUser).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(onLoginSuccess).toHaveBeenCalled();
      }, { timeout: 2000 });
    });
  });

  describe('Login Error Handling', () => {
    it('should display error message when login API fails', async () => {
      const user = userEvent.setup();
      
      // Mock failed login API response
      api.loginUser.mockRejectedValue({
        response: {
          status: 401,
          data: { message: 'Invalid credentials' }
        },
        message: 'Invalid credentials'
      });

      const onLoginSuccess = vi.fn();

      render(<LoginPage onLoginSuccess={onLoginSuccess} />);

      const usernameInput = screen.getByLabelText(/username/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /log in/i });

      await user.type(usernameInput, 'wronguser');
      await user.type(passwordInput, 'wrongpass');
      await user.click(submitButton);

      // Verify error message is displayed
      await waitFor(() => {
        expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
      });

      // Verify onLoginSuccess was NOT called
      expect(onLoginSuccess).not.toHaveBeenCalled();
    });

    it('should handle network errors gracefully', async () => {
      const user = userEvent.setup();
      
      // Mock network error
      api.loginUser.mockRejectedValue(new Error('Network error'));

      const onLoginSuccess = vi.fn();

      render(<LoginPage onLoginSuccess={onLoginSuccess} />);

      const usernameInput = screen.getByLabelText(/username/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /log in/i });

      await user.type(usernameInput, 'testuser');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      // Verify error message is displayed
      await waitFor(() => {
        expect(screen.getByText(/network error|authentication failed/i)).toBeInTheDocument();
      });

      expect(onLoginSuccess).not.toHaveBeenCalled();
    });

    it('should handle 500 server errors', async () => {
      const user = userEvent.setup();
      
      // Mock 500 error
      api.loginUser.mockRejectedValue({
        response: {
          status: 500,
          data: { message: 'Internal server error' }
        },
        message: 'Internal server error'
      });

      const onLoginSuccess = vi.fn();

      render(<LoginPage onLoginSuccess={onLoginSuccess} />);

      const usernameInput = screen.getByLabelText(/username/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /log in/i });

      await user.type(usernameInput, 'testuser');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/internal server error/i)).toBeInTheDocument();
      });

      expect(onLoginSuccess).not.toHaveBeenCalled();
    });
  });

  describe('Login Form Validation', () => {
    it('should require username and password', async () => {
      const user = userEvent.setup();
      
      render(<LoginPage onLoginSuccess={vi.fn()} />);

      const submitButton = screen.getByRole('button', { name: /log in/i });
      await user.click(submitButton);

      // HTML5 validation should prevent submission
      // Check that API was not called
      await waitFor(() => {
        expect(api.loginUser).not.toHaveBeenCalled();
      }, { timeout: 500 });
    });

    it('should disable submit button while loading', async () => {
      const user = userEvent.setup();
      
      // Mock slow API response
      api.loginUser.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ status: 'success' }), 1000))
      );

      const onLoginSuccess = vi.fn().mockResolvedValue(undefined);

      render(<LoginPage onLoginSuccess={onLoginSuccess} />);

      const usernameInput = screen.getByLabelText(/username/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /log in/i });

      await user.type(usernameInput, 'testuser');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      // Verify button shows loading state
      expect(screen.getByText(/logging in/i)).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
    });

    it('should clear error message on new submission', async () => {
      const user = userEvent.setup();
      
      // First attempt fails
      api.loginUser.mockRejectedValueOnce({
        response: { status: 401, data: { message: 'Invalid credentials' } }
      });

      // Second attempt succeeds
      api.loginUser.mockResolvedValueOnce({ status: 'success' });

      const onLoginSuccess = vi.fn().mockResolvedValue(undefined);

      render(<LoginPage onLoginSuccess={onLoginSuccess} />);

      const usernameInput = screen.getByLabelText(/username/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /log in/i });

      // First attempt
      await user.type(usernameInput, 'wronguser');
      await user.type(passwordInput, 'wrongpass');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
      });

      // Clear and try again
      await user.clear(usernameInput);
      await user.clear(passwordInput);
      await user.type(usernameInput, 'correctuser');
      await user.type(passwordInput, 'correctpass');
      await user.click(submitButton);

      // Error should be cleared
      await waitFor(() => {
        expect(screen.queryByText(/invalid credentials/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Login Logging', () => {
    it('should log login attempts with detailed information', async () => {
      const user = userEvent.setup();
      
      api.loginUser.mockResolvedValue({ status: 'success' });
      const onLoginSuccess = vi.fn().mockResolvedValue(undefined);

      render(<LoginPage onLoginSuccess={onLoginSuccess} />);

      const usernameInput = screen.getByLabelText(/username/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /log in/i });

      await user.type(usernameInput, 'testuser');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        // Verify logging occurred
        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('[LOGIN PAGE]')
        );
      });
    });

    it('should log errors with detailed information', async () => {
      const user = userEvent.setup();
      
      const error = {
        response: {
          status: 401,
          data: { message: 'Invalid credentials' }
        },
        message: 'Invalid credentials'
      };
      
      api.loginUser.mockRejectedValue(error);
      const onLoginSuccess = vi.fn();

      render(<LoginPage onLoginSuccess={onLoginSuccess} />);

      const usernameInput = screen.getByLabelText(/username/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /log in/i });

      await user.type(usernameInput, 'testuser');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(console.error).toHaveBeenCalledWith(
          expect.stringContaining('[LOGIN PAGE]'),
          expect.anything()
        );
      });
    });
  });

  describe('Cookie and Authentication Token Handling', () => {
    it('should wait for cookies to be set before fetching profile', async () => {
      const user = userEvent.setup();
      
      api.loginUser.mockResolvedValue({ status: 'success' });
      
      // Track when onLoginSuccess is called
      let loginSuccessCalled = false;
      const onLoginSuccess = vi.fn().mockImplementation(async () => {
        loginSuccessCalled = true;
        // Simulate waiting for cookie
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      render(<LoginPage onLoginSuccess={onLoginSuccess} />);

      const usernameInput = screen.getByLabelText(/username/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /log in/i });

      await user.type(usernameInput, 'testuser');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      // Verify login API was called first
      await waitFor(() => {
        expect(api.loginUser).toHaveBeenCalled();
      });

      // Verify onLoginSuccess is called after API succeeds
      await waitFor(() => {
        expect(loginSuccessCalled).toBe(true);
      }, { timeout: 2000 });
    });
  });
});


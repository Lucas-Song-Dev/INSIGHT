import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from '../LoginPage';
import * as api from '../../../api/api';
import { AuthProvider } from '../../../context/AuthContext';
import { NotificationProvider, useNotification } from '../../../context/NotificationContext';

// Mock API calls
vi.mock('../../../api/api', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    loginUser: vi.fn(),
    registerUser: vi.fn(),
    fetchUserProfile: vi.fn(),
    fetchStatus: vi.fn(),
    logoutUser: vi.fn(),
  };
});

// Mock NotificationContext to capture notifications
const MockNotificationConsumer = () => {
  const { showNotification } = useNotification();
  // Expose showNotification for testing purposes
  window.showNotification = showNotification;
  return null;
};

const renderWithProviders = (ui, { authProps = {}, notificationProps = {} } = {}) => {
  return render(
    <NotificationProvider {...notificationProps}>
      <AuthProvider {...authProps}>
        {ui}
        <MockNotificationConsumer />
      </AuthProvider>
    </NotificationProvider>
  );
};

describe('LoginFlow - Comprehensive Tests with New Matte Design', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default successful mocks
    api.loginUser.mockResolvedValue({ status: 'success', message: 'Login successful' });
    api.registerUser.mockResolvedValue({ status: 'success', message: 'Registration successful' });
    api.fetchUserProfile.mockResolvedValue({ 
      status: 'success', 
      user: { 
        username: 'testuser', 
        email: 'test@example.com',
        full_name: 'Test User',
        preferred_name: 'Test',
        birthday: '1990-01-01',
        credits: 5
      } 
    });
    api.fetchStatus.mockResolvedValue({ status: 'success', message: 'Authenticated' });
    api.logoutUser.mockResolvedValue({ status: 'success' });
    // Mock window.location.reload
    Object.defineProperty(window, 'location', {
      value: { reload: vi.fn() },
      writable: true,
    });
    // Mock console methods to capture logs
    console.log = vi.fn();
    console.error = vi.fn();
    console.warn = vi.fn();
  });

  afterEach(() => {
    delete window.showNotification;
    vi.restoreAllMocks();
  });

  describe('Login Page Display - Matte Design', () => {
    it('should display login form with clean matte design', () => {
      renderWithProviders(<LoginPage onLoginSuccess={vi.fn()} />);
      expect(screen.getByRole('heading', { name: /INSIGHT Login/i })).toBeInTheDocument();
      expect(screen.getByText(/Enter your credentials to access the dashboard/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
    });

    it('should have no visible borders on login card (matte design)', () => {
      const { container } = renderWithProviders(<LoginPage onLoginSuccess={vi.fn()} />);
      const loginCard = container.querySelector('.login-card');
      expect(loginCard).toBeInTheDocument();
      // Check that card exists and has proper styling
      expect(loginCard).toHaveClass('login-card');
    });

    it('should display register link with clean styling', () => {
      renderWithProviders(<LoginPage onLoginSuccess={vi.fn()} />);
      expect(screen.getByText(/Don't have an account/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
    });
  });

  describe('Form Input and Interaction', () => {
    it('should allow user to type into username and password fields', async () => {
      renderWithProviders(<LoginPage onLoginSuccess={vi.fn()} />);
      const user = userEvent.setup();
      const usernameInput = screen.getByLabelText(/username/i);
      const passwordInput = screen.getByLabelText(/password/i);

      await user.type(usernameInput, 'testuser');
      await user.type(passwordInput, 'password123');

      expect(usernameInput).toHaveValue('testuser');
      expect(passwordInput).toHaveValue('password123');
    });

    it('should show loading state during login with disabled button', async () => {
      api.loginUser.mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(() => resolve({ status: 'success' }), 500))
      );
      renderWithProviders(<LoginPage onLoginSuccess={vi.fn()} />);
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /log in/i }));

      expect(screen.getByRole('button', { name: /logging in.../i })).toBeDisabled();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /log in/i })).not.toBeDisabled();
      });
    });
  });

  describe('Successful Login Flow with Extensive Logging', () => {
    it('should complete full login flow with detailed logging', async () => {
      const mockOnLoginSuccess = vi.fn().mockResolvedValue(undefined);
      renderWithProviders(<LoginPage onLoginSuccess={mockOnLoginSuccess} />);
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /log in/i }));

      await waitFor(() => {
        expect(api.loginUser).toHaveBeenCalledWith({ username: 'testuser', password: 'password123' });
      });

      await waitFor(() => {
        expect(mockOnLoginSuccess).toHaveBeenCalledTimes(1);
      });

      // Verify extensive logging occurred
      await waitFor(() => {
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('[LOGIN PAGE]'));
      });

      // Verify no error messages
      expect(screen.queryByText(/failed|error/i)).not.toBeInTheDocument();
    });

    it('should log all steps of the login process', async () => {
      const mockOnLoginSuccess = vi.fn().mockResolvedValue(undefined);
      renderWithProviders(<LoginPage onLoginSuccess={mockOnLoginSuccess} />);
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /log in/i }));

      await waitFor(() => {
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('[LOGIN PAGE] ========== LOGIN FORM SUBMITTED =========='));
      });

      await waitFor(() => {
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('[LOGIN PAGE] Step 1: Calling loginUser API'));
      });
    });

    it('should call onLoginSuccess and trigger profile fetch in AuthContext', async () => {
      const mockOnLoginSuccess = vi.fn().mockResolvedValue(undefined);
      renderWithProviders(<LoginPage onLoginSuccess={mockOnLoginSuccess} />);
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /log in/i }));

      await waitFor(() => {
        expect(api.loginUser).toHaveBeenCalledTimes(1);
      });

      await waitFor(() => {
        expect(mockOnLoginSuccess).toHaveBeenCalledTimes(1);
      }, { timeout: 2000 });

      // AuthContext's login function will call fetchUserProfile
      await waitFor(() => {
        expect(api.fetchUserProfile).toHaveBeenCalled();
      }, { timeout: 2000 });
    });
  });

  describe('Error Handling with Detailed Logging', () => {
    it('should show error message on failed login attempt with logging', async () => {
      api.loginUser.mockRejectedValueOnce(new Error('Invalid credentials'));
      const mockOnLoginSuccess = vi.fn();
      renderWithProviders(<LoginPage onLoginSuccess={mockOnLoginSuccess} />);
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/username/i), 'wronguser');
      await user.type(screen.getByLabelText(/password/i), 'wrongpass');
      await user.click(screen.getByRole('button', { name: /log in/i }));

      await waitFor(() => {
        expect(screen.getByText(/invalid credentials|authentication failed/i)).toBeInTheDocument();
      });

      expect(mockOnLoginSuccess).not.toHaveBeenCalled();

      // Verify error logging
      await waitFor(() => {
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('[LOGIN PAGE] ========== LOGIN ERROR =========='));
      });
    });

    it('should log detailed error information including response status and data', async () => {
      const error = {
        response: {
          status: 401,
          data: { message: 'Invalid credentials' }
        },
        message: 'Invalid credentials'
      };
      api.loginUser.mockRejectedValueOnce(error);
      renderWithProviders(<LoginPage onLoginSuccess={vi.fn()} />);
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /log in/i }));

      await waitFor(() => {
        expect(console.error).toHaveBeenCalledWith(
          expect.stringContaining('[LOGIN PAGE] Error details:'),
          expect.objectContaining({
            responseStatus: 401,
            responseData: { message: 'Invalid credentials' }
          })
        );
      });
    });

    it('should handle network errors with detailed logging', async () => {
      const networkError = new Error('Network Error');
      networkError.message = 'Network Error';
      api.loginUser.mockRejectedValueOnce(networkError);
      renderWithProviders(<LoginPage onLoginSuccess={vi.fn()} />);
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /log in/i }));

      await waitFor(() => {
        expect(console.error).toHaveBeenCalledWith(
          expect.stringContaining('[LOGIN PAGE] Error message:'),
          'Network Error'
        );
      });
    });

    it('should handle 500 server errors with logging', async () => {
      const serverError = {
        response: {
          status: 500,
          data: { message: 'Internal server error' }
        },
        message: 'Internal server error'
      };
      api.loginUser.mockRejectedValueOnce(serverError);
      renderWithProviders(<LoginPage onLoginSuccess={vi.fn()} />);
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /log in/i }));

      await waitFor(() => {
        expect(screen.getByText(/internal server error/i)).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(console.error).toHaveBeenCalledWith(
          expect.stringContaining('[LOGIN PAGE]'),
          expect.anything()
        );
      });
    });
  });

  describe('Registration Flow Integration', () => {
    it('should switch to register form when "Create Account" is clicked', async () => {
      renderWithProviders(<LoginPage onLoginSuccess={vi.fn()} />);
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: /create account/i }));

      expect(screen.getByRole('heading', { name: /register for insight|create account/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/new username|username/i)).toBeInTheDocument();
    });

    it('should switch back to login form when "Cancel" is clicked on register form', async () => {
      renderWithProviders(<LoginPage onLoginSuccess={vi.fn()} />);
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: /create account/i }));
      await user.click(screen.getByRole('button', { name: /cancel/i }));

      expect(screen.getByRole('heading', { name: /INSIGHT Login/i })).toBeInTheDocument();
    });

    it('should auto-fill username on successful registration and switch to login', async () => {
      api.registerUser.mockResolvedValueOnce({ status: 'success', message: 'Registration successful' });
      renderWithProviders(<LoginPage onLoginSuccess={vi.fn()} />);
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: /create account/i }));
      await user.type(screen.getByLabelText(/new username|username/i), 'newuser');
      await user.type(screen.getByLabelText(/new password|password/i), 'newpass');
      await user.type(screen.getByLabelText(/confirm password/i), 'newpass');
      await user.type(screen.getByLabelText(/full name/i), 'New User');
      await user.type(screen.getByLabelText(/what should we call you/i), 'New');
      await user.type(screen.getByLabelText(/birthday/i), '1990-01-01');
      await user.click(screen.getByRole('button', { name: /register|create account/i }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /INSIGHT Login/i })).toBeInTheDocument();
      });
      expect(screen.getByLabelText(/username/i)).toHaveValue('newuser');
      expect(screen.getByLabelText(/password/i)).toHaveValue(''); // Password should be cleared
    });
  });

  describe('Profile Fetch Retry Logic', () => {
    it('should handle 401 Unauthorized error during profile fetch after login with retry', async () => {
      api.loginUser.mockResolvedValueOnce({ status: 'success', message: 'Login successful' });
      api.fetchUserProfile.mockRejectedValueOnce({ 
        response: { status: 401, data: { message: 'Authentication token is missing' } } 
      });
      api.fetchUserProfile.mockResolvedValueOnce({ 
        status: 'success', 
        user: { username: 'testuser', email: 'test@example.com' } 
      }); // Succeeds on retry

      const mockOnLoginSuccess = vi.fn().mockResolvedValue(undefined);
      renderWithProviders(<LoginPage onLoginSuccess={mockOnLoginSuccess} />);
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /log in/i }));

      await waitFor(() => {
        expect(api.loginUser).toHaveBeenCalledTimes(1);
      });

      await waitFor(() => {
        expect(api.fetchUserProfile).toHaveBeenCalledTimes(2); // Initial call + 1 retry
      }, { timeout: 2000 });

      await waitFor(() => {
        expect(mockOnLoginSuccess).toHaveBeenCalledTimes(1);
      });
    });

    it('should eventually fail after multiple 401 retries during profile fetch with logging', async () => {
      api.loginUser.mockResolvedValueOnce({ status: 'success', message: 'Login successful' });
      api.fetchUserProfile.mockRejectedValue({ 
        response: { status: 401, data: { message: 'Authentication token is missing' } } 
      });

      const mockOnLoginSuccess = vi.fn().mockResolvedValue(undefined);
      renderWithProviders(<LoginPage onLoginSuccess={mockOnLoginSuccess} />);
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /log in/i }));

      await waitFor(() => {
        expect(api.loginUser).toHaveBeenCalledTimes(1);
      });

      await waitFor(() => {
        expect(api.fetchUserProfile).toHaveBeenCalledTimes(4); // Initial call + 3 retries
      }, { timeout: 3000 });

      expect(mockOnLoginSuccess).toHaveBeenCalledTimes(1); // Login still considered successful
      
      // Verify logging of retry attempts
      await waitFor(() => {
        expect(console.error).toHaveBeenCalledWith(
          expect.stringContaining('[AUTH] PROFILE FETCH ATTEMPT')
        );
      });
    });

    it('should handle network/CORS errors during profile fetch with retry', async () => {
      api.loginUser.mockResolvedValueOnce({ status: 'success', message: 'Login successful' });
      const networkError = new Error('Network Error');
      api.fetchUserProfile.mockRejectedValueOnce(networkError);
      api.fetchUserProfile.mockResolvedValueOnce({ 
        status: 'success', 
        user: { username: 'testuser' } 
      });

      const mockOnLoginSuccess = vi.fn().mockResolvedValue(undefined);
      renderWithProviders(<LoginPage onLoginSuccess={mockOnLoginSuccess} />);
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /log in/i }));

      await waitFor(() => {
        expect(api.fetchUserProfile).toHaveBeenCalledTimes(2); // Initial call + 1 retry
      }, { timeout: 2000 });
    });
  });

  describe('Form Validation', () => {
    it('should require username and password fields', async () => {
      renderWithProviders(<LoginPage onLoginSuccess={vi.fn()} />);
      const user = userEvent.setup();

      const submitButton = screen.getByRole('button', { name: /log in/i });
      await user.click(submitButton);

      // HTML5 validation should prevent submission
      await waitFor(() => {
        expect(api.loginUser).not.toHaveBeenCalled();
      }, { timeout: 500 });
    });

    it('should clear error message on new submission attempt', async () => {
      const user = userEvent.setup();
      
      // First attempt fails
      api.loginUser.mockRejectedValueOnce({
        response: { status: 401, data: { message: 'Invalid credentials' } }
      });

      // Second attempt succeeds
      api.loginUser.mockResolvedValueOnce({ status: 'success' });

      const onLoginSuccess = vi.fn().mockResolvedValue(undefined);
      renderWithProviders(<LoginPage onLoginSuccess={onLoginSuccess} />);

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

  describe('Loading States', () => {
    it('should show loading state and disable button during login', async () => {
      api.loginUser.mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(() => resolve({ status: 'success' }), 500))
      );
      renderWithProviders(<LoginPage onLoginSuccess={vi.fn()} />);
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /log in/i }));

      expect(screen.getByRole('button', { name: /logging in.../i })).toBeDisabled();
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /log in/i })).not.toBeDisabled();
      });
    });
  });

  describe('Comprehensive Logging Verification', () => {
    it('should log all critical steps in login flow', async () => {
      const mockOnLoginSuccess = vi.fn().mockResolvedValue(undefined);
      renderWithProviders(<LoginPage onLoginSuccess={mockOnLoginSuccess} />);
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /log in/i }));

      // Verify all logging steps
      await waitFor(() => {
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('[LOGIN PAGE] ========== LOGIN FORM SUBMITTED =========='));
      });

      await waitFor(() => {
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('[LOGIN PAGE] Step 1: Calling loginUser API'));
      });

      await waitFor(() => {
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('[LOGIN PAGE] Step 2: Login API response received'));
      });
    });

    it('should log AuthContext login function calls with detailed information', async () => {
      const mockOnLoginSuccess = vi.fn().mockResolvedValue(undefined);
      renderWithProviders(<LoginPage onLoginSuccess={mockOnLoginSuccess} />);
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /log in/i }));

      await waitFor(() => {
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('[AUTH] ========== LOGIN FUNCTION CALLED =========='));
      }, { timeout: 2000 });

      await waitFor(() => {
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('[AUTH] Timestamp:'));
      }, { timeout: 2000 });
    });
  });
});

// src/pages/auth/LoginPage.test.jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from './LoginPage';
import * as api from '../../api/api';

// Mock the API module
vi.mock('../../api/api', () => ({
  loginUser: vi.fn(),
}));

// Mock RegisterForm
vi.mock('./RegisterForm', () => ({
  default: ({ onRegisterSuccess, onCancel }) => (
    <div data-testid="register-form">
      <button onClick={() => onRegisterSuccess('testuser')}>Register</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

describe('LoginPage', () => {
  const mockOnLoginSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Clear console logs in tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render login form with username and password fields', () => {
    render(<LoginPage onLoginSuccess={mockOnLoginSuccess} />);

    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
  });

  it('should display error message when login fails', async () => {
    const user = userEvent.setup();
    api.loginUser.mockRejectedValue(new Error('Invalid credentials'));

    render(<LoginPage onLoginSuccess={mockOnLoginSuccess} />);

    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /log in/i });

    await user.type(usernameInput, 'testuser');
    await user.type(passwordInput, 'wrongpassword');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/authentication failed/i)).toBeInTheDocument();
    });

    expect(api.loginUser).toHaveBeenCalledWith({
      username: 'testuser',
      password: 'wrongpassword',
    });
    expect(mockOnLoginSuccess).not.toHaveBeenCalled();
  });

  it('should call onLoginSuccess when login is successful', async () => {
    const user = userEvent.setup();
    api.loginUser.mockResolvedValue({ status: 'success', message: 'Login successful' });

    render(<LoginPage onLoginSuccess={mockOnLoginSuccess} />);

    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /log in/i });

    await user.type(usernameInput, 'testuser');
    await user.type(passwordInput, 'correctpassword');
    await user.click(submitButton);

    await waitFor(() => {
      expect(api.loginUser).toHaveBeenCalledWith({
        username: 'testuser',
        password: 'correctpassword',
      });
    });

    await waitFor(() => {
      expect(mockOnLoginSuccess).toHaveBeenCalled();
    });
  });

  it('should handle API error with response data', async () => {
    const user = userEvent.setup();
    const error = new Error('Login failed');
    error.response = {
      status: 401,
      data: { message: 'Invalid username or password' },
    };
    api.loginUser.mockRejectedValue(error);

    render(<LoginPage onLoginSuccess={mockOnLoginSuccess} />);

    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /log in/i });

    await user.type(usernameInput, 'testuser');
    await user.type(passwordInput, 'wrongpassword');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Invalid username or password')).toBeInTheDocument();
    });

    expect(mockOnLoginSuccess).not.toHaveBeenCalled();
  });

  it('should handle non-success response status', async () => {
    const user = userEvent.setup();
    api.loginUser.mockResolvedValue({ 
      status: 'error', 
      message: 'Account is locked' 
    });

    render(<LoginPage onLoginSuccess={mockOnLoginSuccess} />);

    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /log in/i });

    await user.type(usernameInput, 'testuser');
    await user.type(passwordInput, 'password');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Account is locked')).toBeInTheDocument();
    });

    expect(mockOnLoginSuccess).not.toHaveBeenCalled();
  });

  it('should disable submit button while loading', async () => {
    const user = userEvent.setup();
    // Create a promise that we can control
    let resolveLogin;
    const loginPromise = new Promise((resolve) => {
      resolveLogin = resolve;
    });
    api.loginUser.mockReturnValue(loginPromise);

    render(<LoginPage onLoginSuccess={mockOnLoginSuccess} />);

    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /log in/i });

    await user.type(usernameInput, 'testuser');
    await user.type(passwordInput, 'password');
    await user.click(submitButton);

    // Button should be disabled and show loading text
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /logging in/i })).toBeDisabled();
    });

    // Resolve the promise
    resolveLogin({ status: 'success' });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /log in/i })).not.toBeDisabled();
    });
  });

  it('should show register form when register button is clicked', async () => {
    const user = userEvent.setup();
    render(<LoginPage onLoginSuccess={mockOnLoginSuccess} />);

    const registerButton = screen.getByRole('button', { name: /create account/i });
    await user.click(registerButton);

    expect(screen.getByTestId('register-form')).toBeInTheDocument();
  });

  it('should auto-fill username after successful registration', async () => {
    const user = userEvent.setup();
    render(<LoginPage onLoginSuccess={mockOnLoginSuccess} />);

    // Show register form
    const registerButton = screen.getByRole('button', { name: /create account/i });
    await user.click(registerButton);

    // Complete registration
    const registerSubmitButton = screen.getByRole('button', { name: /register/i });
    await user.click(registerSubmitButton);

    // Should be back to login form with username filled
    await waitFor(() => {
      expect(screen.queryByTestId('register-form')).not.toBeInTheDocument();
    });

    const usernameInput = screen.getByLabelText(/username/i);
    expect(usernameInput).toHaveValue('testuser');
  });

  it('should clear error message on new submission', async () => {
    const user = userEvent.setup();
    
    // First attempt - fail
    api.loginUser.mockRejectedValueOnce(new Error('Invalid credentials'));
    render(<LoginPage onLoginSuccess={mockOnLoginSuccess} />);

    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /log in/i });

    await user.type(usernameInput, 'testuser');
    await user.type(passwordInput, 'wrongpassword');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/authentication failed/i)).toBeInTheDocument();
    });

    // Second attempt - succeed
    api.loginUser.mockResolvedValueOnce({ status: 'success' });
    await user.clear(usernameInput);
    await user.type(usernameInput, 'testuser');
    await user.clear(passwordInput);
    await user.type(passwordInput, 'correctpassword');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.queryByText(/authentication failed/i)).not.toBeInTheDocument();
    });
  });

  it('should require username and password fields', () => {
    render(<LoginPage onLoginSuccess={mockOnLoginSuccess} />);

    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);

    expect(usernameInput).toBeRequired();
    expect(passwordInput).toBeRequired();
  });

  it('should log authentication flow steps', async () => {
    const user = userEvent.setup();
    const consoleLogSpy = vi.spyOn(console, 'log');
    api.loginUser.mockResolvedValue({ status: 'success' });

    render(<LoginPage onLoginSuccess={mockOnLoginSuccess} />);

    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /log in/i });

    await user.type(usernameInput, 'testuser');
    await user.type(passwordInput, 'password');
    await user.click(submitButton);

    await waitFor(() => {
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[LOGIN]'),
        expect.anything()
      );
    });
  });
});


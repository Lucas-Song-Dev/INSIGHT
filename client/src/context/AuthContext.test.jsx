// src/context/AuthContext.test.jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from './AuthContext';
import * as api from '../api/api';

// Mock the API module
vi.mock('../api/api', () => ({
  fetchStatus: vi.fn(),
  fetchUserProfile: vi.fn(),
}));

// Test component that uses auth
const TestComponent = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  return (
    <div>
      <div data-testid="isAuthenticated">{isAuthenticated ? 'true' : 'false'}</div>
      <div data-testid="isLoading">{isLoading ? 'true' : 'false'}</div>
      <div data-testid="username">{user?.username || 'none'}</div>
    </div>
  );
};

describe('AuthContext', () => {
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

  it('should start with loading state', () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    expect(screen.getByTestId('isLoading')).toHaveTextContent('true');
  });

  it('should set authenticated to true when status check succeeds', async () => {
    api.fetchStatus.mockResolvedValue({ status: 'success' });
    api.fetchUserProfile.mockResolvedValue({
      status: 'success',
      user: { username: 'testuser', email: 'test@example.com' },
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
    });

    await waitFor(() => {
      expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('true');
    });

    await waitFor(() => {
      expect(screen.getByTestId('username')).toHaveTextContent('testuser');
    });
  });

  it('should set authenticated to false when status check fails', async () => {
    const error = new Error('Unauthorized');
    error.response = { status: 401 };
    api.fetchStatus.mockRejectedValue(error);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
    });

    await waitFor(() => {
      expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false');
    });
  });

  it('should handle profile fetch failure gracefully', async () => {
    api.fetchStatus.mockResolvedValue({ status: 'success' });
    api.fetchUserProfile.mockRejectedValue(new Error('Profile fetch failed'));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
    });

    // Should still be authenticated even if profile fetch fails
    await waitFor(() => {
      expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('true');
    });

    // But user should be null
    await waitFor(() => {
      expect(screen.getByTestId('username')).toHaveTextContent('none');
    });
  });

  it('should provide login function that sets authenticated state', async () => {
    const LoginTestComponent = () => {
      const { login, isAuthenticated } = useAuth();
      return (
        <div>
          <div data-testid="isAuthenticated">{isAuthenticated ? 'true' : 'false'}</div>
          <button onClick={login} data-testid="login-button">Login</button>
        </div>
      );
    };

    api.fetchStatus.mockResolvedValue({ status: 'error' });
    api.fetchUserProfile.mockResolvedValue({
      status: 'success',
      user: { username: 'testuser' },
    });

    render(
      <AuthProvider>
        <LoginTestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false');
    });

    const loginButton = screen.getByTestId('login-button');
    await userEvent.click(loginButton);

    await waitFor(() => {
      expect(api.fetchUserProfile).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('true');
    });
  });

  it('should provide logout function that clears authenticated state', async () => {
    const LogoutTestComponent = () => {
      const { logout, isAuthenticated } = useAuth();
      return (
        <div>
          <div data-testid="isAuthenticated">{isAuthenticated ? 'true' : 'false'}</div>
          <button onClick={logout} data-testid="logout-button">Logout</button>
        </div>
      );
    };

    api.fetchStatus.mockResolvedValue({ status: 'success' });
    api.fetchUserProfile.mockResolvedValue({
      status: 'success',
      user: { username: 'testuser' },
    });

    render(
      <AuthProvider>
        <LogoutTestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('true');
    });

    const logoutButton = screen.getByTestId('logout-button');
    await userEvent.click(logoutButton);

    await waitFor(() => {
      expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false');
    });
  });

  it('should log authentication flow steps', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log');
    api.fetchStatus.mockResolvedValue({ status: 'success' });
    api.fetchUserProfile.mockResolvedValue({
      status: 'success',
      user: { username: 'testuser' },
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[AUTH]'),
        expect.anything()
      );
    });
  });
});


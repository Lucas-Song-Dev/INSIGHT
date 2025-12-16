import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, screen } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext';
import * as api from '../../api/api';

// Mock the API
vi.mock('../../api/api', () => ({
  fetchStatus: vi.fn(),
  fetchUserProfile: vi.fn(),
}));

// Test component that uses auth
const TestComponent = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  return (
    <div>
      <div data-testid="is-authenticated">{isAuthenticated ? 'true' : 'false'}</div>
      <div data-testid="is-loading">{isLoading ? 'true' : 'false'}</div>
      <div data-testid="username">{user?.username || 'no-user'}</div>
    </div>
  );
};

describe('AuthContext - Comprehensive Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    console.log = vi.fn();
    console.error = vi.fn();
    console.warn = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial Authentication Check', () => {
    it('should check authentication status on mount', async () => {
      api.fetchStatus.mockResolvedValue({ status: 'success' });
      api.fetchUserProfile.mockResolvedValue({
        status: 'success',
        user: { username: 'testuser', email: 'test@example.com' }
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      // Verify fetchStatus was called
      await waitFor(() => {
        expect(api.fetchStatus).toHaveBeenCalled();
      });

      // Verify fetchUserProfile was called after successful status check
      await waitFor(() => {
        expect(api.fetchUserProfile).toHaveBeenCalled();
      });

      // Verify user is authenticated
      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('true');
      });
    });

    it('should handle unauthenticated state when status check fails', async () => {
      api.fetchStatus.mockRejectedValue({
        response: { status: 401 },
        message: 'Unauthorized'
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(api.fetchStatus).toHaveBeenCalled();
      });

      // Verify fetchUserProfile was NOT called
      expect(api.fetchUserProfile).not.toHaveBeenCalled();

      // Verify user is not authenticated
      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('false');
        expect(screen.getByTestId('is-loading')).toHaveTextContent('false');
      });
    });

    it('should set loading to false after check completes', async () => {
      api.fetchStatus.mockResolvedValue({ status: 'success' });
      api.fetchUserProfile.mockResolvedValue({
        status: 'success',
        user: { username: 'testuser' }
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      // Initially loading should be true, then false
      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('false');
      }, { timeout: 2000 });
    });
  });

  describe('Login Function', () => {
    it('should set authenticated state and fetch user profile', async () => {
      api.fetchStatus.mockResolvedValue({ status: 'success' });
      api.fetchUserProfile.mockResolvedValue({
        status: 'success',
        user: { username: 'testuser', email: 'test@example.com' }
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      });

      // Wait for initial check
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Call login
      await result.current.login();

      // Verify authenticated
      expect(result.current.isAuthenticated).toBe(true);

      // Verify profile was fetched
      await waitFor(() => {
        expect(api.fetchUserProfile).toHaveBeenCalled();
      });
    });

    it('should retry profile fetch on 401 error', async () => {
      api.fetchStatus.mockResolvedValue({ status: 'success' });
      
      // First attempt fails, second succeeds
      api.fetchUserProfile
        .mockRejectedValueOnce({
          response: { status: 401 },
          message: 'Authentication token is missing'
        })
        .mockResolvedValueOnce({
          status: 'success',
          user: { username: 'testuser' }
        });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Call login
      await result.current.login();

      // Verify retry occurred
      await waitFor(() => {
        expect(api.fetchUserProfile).toHaveBeenCalledTimes(2);
      }, { timeout: 3000 });

      // Verify authenticated despite initial failure
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('should handle profile fetch failure gracefully', async () => {
      api.fetchStatus.mockResolvedValue({ status: 'success' });
      api.fetchUserProfile.mockRejectedValue({
        response: { status: 500 },
        message: 'Server error'
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Call login
      await result.current.login();

      // Verify authenticated even if profile fetch fails
      expect(result.current.isAuthenticated).toBe(true);

      // Verify profile fetch was attempted
      await waitFor(() => {
        expect(api.fetchUserProfile).toHaveBeenCalled();
      });
    });

    it('should wait for cookie to be set before fetching profile', async () => {
      api.fetchStatus.mockResolvedValue({ status: 'success' });
      api.fetchUserProfile.mockResolvedValue({
        status: 'success',
        user: { username: 'testuser' }
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const loginStartTime = Date.now();
      await result.current.login();
      const loginEndTime = Date.now();

      // Verify some delay occurred (waiting for cookie)
      expect(loginEndTime - loginStartTime).toBeGreaterThan(200);
    });
  });

  describe('Logout Function', () => {
    it('should clear authentication state', async () => {
      api.fetchStatus.mockResolvedValue({ status: 'success' });
      api.fetchUserProfile.mockResolvedValue({
        status: 'success',
        user: { username: 'testuser' }
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      // Call logout
      result.current.logout();

      // Verify not authenticated
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBe(null);
    });
  });

  describe('Logging', () => {
    it('should log authentication check process', async () => {
      api.fetchStatus.mockResolvedValue({ status: 'success' });
      api.fetchUserProfile.mockResolvedValue({
        status: 'success',
        user: { username: 'testuser' }
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('[AUTH] checkAuth')
        );
      });
    });

    it('should log login process with detailed steps', async () => {
      api.fetchStatus.mockResolvedValue({ status: 'success' });
      api.fetchUserProfile.mockResolvedValue({
        status: 'success',
        user: { username: 'testuser' }
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.login();

      await waitFor(() => {
        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('[AUTH] ========== LOGIN FUNCTION CALLED ==========')
        );
      });
    });

    it('should log errors with detailed information', async () => {
      api.fetchStatus.mockRejectedValue({
        response: { status: 401 },
        message: 'Unauthorized'
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(console.error).toHaveBeenCalledWith(
          expect.stringContaining('[AUTH]'),
          expect.anything()
        );
      });
    });
  });

  describe('CORS/Network Error Handling Fix', () => {
    it('should handle CORS errors without causing false authentication failure', async () => {
      // Simulate CORS error (no response object, Network Error message)
      api.fetchStatus.mockRejectedValue({
        message: 'Network Error',
        // No response object indicates network/CORS error
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(api.fetchStatus).toHaveBeenCalled();
      });

      // Should still set isAuthenticated to false (to show login page)
      // but should log it as a network error, not an auth failure
      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('false');
        expect(screen.getByTestId('is-loading')).toHaveTextContent('false');
      });

      // Verify it logged as network error, not auth error
      await waitFor(() => {
        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining('[AUTH] Network/CORS error'),
          expect.anything()
        );
      });
    });

    it('should distinguish between 401 auth error and network error', async () => {
      // Test 401 error (actual auth failure)
      api.fetchStatus.mockRejectedValue({
        response: { status: 401 },
        message: 'Unauthorized'
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(api.fetchStatus).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('false');
      });

      // Should log as authentication error, not network error
      await waitFor(() => {
        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('[AUTH] Authentication error (401/403)'),
          expect.anything()
        );
      });
    });

    it('should handle network errors with CORS message', async () => {
      // Simulate CORS error with explicit CORS message
      api.fetchStatus.mockRejectedValue({
        message: 'CORS policy: No Access-Control-Allow-Origin header',
        // No response object
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(api.fetchStatus).toHaveBeenCalled();
      });

      // Should set isAuthenticated to false but log as network error
      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('false');
      });

      // Should warn about network/CORS error
      await waitFor(() => {
        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining('[AUTH] Network/CORS error'),
          expect.anything()
        );
      });
    });

    it('should handle errors without response object as network errors', async () => {
      // Error without response object (network/CORS issue)
      api.fetchStatus.mockRejectedValue({
        message: 'Failed to fetch',
        // No response property
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(api.fetchStatus).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('false');
      });

      // Should be treated as network error
      await waitFor(() => {
        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining('[AUTH] Network/CORS error'),
          expect.anything()
        );
      });
    });

    it('should handle 403 errors as authentication failures', async () => {
      // Test 403 error (forbidden - auth failure)
      api.fetchStatus.mockRejectedValue({
        response: { status: 403 },
        message: 'Forbidden'
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(api.fetchStatus).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('false');
      });

      // Should log as authentication error
      await waitFor(() => {
        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('[AUTH] Authentication error (401/403)'),
          expect.anything()
        );
      });
    });

    it('should handle other errors (non-auth, non-network) as not authenticated', async () => {
      // Test other error (e.g., 500 server error)
      api.fetchStatus.mockRejectedValue({
        response: { status: 500 },
        message: 'Internal Server Error'
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(api.fetchStatus).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('false');
      });

      // Should log as other error
      await waitFor(() => {
        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('[AUTH] Other error during auth check'),
          expect.anything()
        );
      });
    });

    it('should prevent redirect loops by properly handling network errors', async () => {
      // Simulate network error that would previously cause redirect loop
      api.fetchStatus.mockRejectedValue({
        message: 'Network Error',
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      });

      // Wait for initial check to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 2000 });

      // Verify isAuthenticated is false (to show login page)
      expect(result.current.isAuthenticated).toBe(false);

      // Verify it only called fetchStatus once (no loop)
      expect(api.fetchStatus).toHaveBeenCalledTimes(1);

      // Wait a bit to ensure no additional calls
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Should still be only 1 call (no loop)
      expect(api.fetchStatus).toHaveBeenCalledTimes(1);
    });
  });
});


/**
 * Tests for AuthContext CORS error handling fix
 * Verifies that CORS/network errors don't cause redirect loops
 * and that authentication state is handled correctly
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext';
import { fetchUserProfile } from '../../api/api';

// Mock the API
vi.mock('../../api/api', () => ({
  fetchUserProfile: vi.fn(),
}));

// Test component that uses auth
const TestComponent = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  return (
    <div data-testid="test-component">
      <div data-testid="is-authenticated">{String(isAuthenticated)}</div>
      <div data-testid="is-loading">{String(isLoading)}</div>
      <div data-testid="user">{user ? user.username : 'null'}</div>
    </div>
  );
};

describe('AuthContext - CORS Error Handling Fix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    console.log = vi.fn();
    console.error = vi.fn();
    console.warn = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should handle CORS errors without causing redirect loops', async () => {
    // Simulate CORS error (no response, network error)
    // Auth check now uses fetchUserProfile, not fetchStatus
    const corsError = new Error('Network Error');
    corsError.response = undefined;
    corsError.message = 'Network Error';
    
    vi.mocked(fetchUserProfile).mockRejectedValue(corsError);

    const { getByTestId } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Wait for auth check to complete
    await waitFor(() => {
      expect(getByTestId('is-loading')).toHaveTextContent('false');
    });

    // Should set isAuthenticated to false (to show login page)
    // but log it as a network error, not an auth failure
    expect(getByTestId('is-authenticated')).toHaveTextContent('false');
    
    // Should log network error warning
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Network/CORS error during auth check')
    );
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('cannot determine auth status')
    );
  });

  it('should handle 401 authentication errors correctly', async () => {
    // Simulate 401 authentication error
    // Auth check now uses fetchUserProfile, not fetchStatus
    const authError = new Error('Unauthorized');
    authError.response = {
      status: 401,
      data: { message: 'Unauthorized' },
    };
    
    vi.mocked(fetchUserProfile).mockRejectedValue(authError);

    const { getByTestId } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(getByTestId('is-loading')).toHaveTextContent('false');
    });

    // Should set isAuthenticated to false for actual auth errors
    expect(getByTestId('is-authenticated')).toHaveTextContent('false');
    
    // Should log as authentication error
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Authentication error (401/403)')
    );
  });

  it('should handle 403 authentication errors correctly', async () => {
    // Simulate 403 authentication error
    // Auth check now uses fetchUserProfile, not fetchStatus
    const authError = new Error('Forbidden');
    authError.response = {
      status: 403,
      data: { message: 'Forbidden' },
    };
    
    vi.mocked(fetchUserProfile).mockRejectedValue(authError);

    const { getByTestId } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(getByTestId('is-loading')).toHaveTextContent('false');
    });

    // Should set isAuthenticated to false
    expect(getByTestId('is-authenticated')).toHaveTextContent('false');
  });

  it('should handle successful authentication check', async () => {
    // Simulate successful profile check (auth check now uses fetchUserProfile, not fetchStatus)
    vi.mocked(fetchUserProfile).mockResolvedValue({
      status: 'success',
      user: {
        username: 'testuser',
        email: 'test@example.com',
      },
    });

    const { getByTestId } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(getByTestId('is-loading')).toHaveTextContent('false');
    });

    // Should set isAuthenticated to true
    expect(getByTestId('is-authenticated')).toHaveTextContent('true');
    expect(getByTestId('user')).toHaveTextContent('testuser');
  });

  it('should distinguish between network errors and auth errors', async () => {
    // Test network error
    // Auth check now uses fetchUserProfile, not fetchStatus
    const networkError = new Error('Network Error');
    networkError.response = undefined;
    
    vi.mocked(fetchUserProfile).mockRejectedValue(networkError);

    const { getByTestId } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(getByTestId('is-loading')).toHaveTextContent('false');
    });

    // Should log network error, not auth error
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Network/CORS error')
    );
    expect(console.log).not.toHaveBeenCalledWith(
      expect.stringContaining('Authentication error (401/403)')
    );
  });

  it('should handle CORS error message specifically', async () => {
    // Simulate CORS error with CORS in message
    // Auth check now uses fetchUserProfile, not fetchStatus
    const corsError = new Error('CORS policy blocked');
    corsError.response = undefined;
    
    vi.mocked(fetchUserProfile).mockRejectedValue(corsError);

    const { getByTestId } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(getByTestId('is-loading')).toHaveTextContent('false');
    });

    // Should be treated as network error
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Network/CORS error')
    );
  });

  it('should handle other errors (non-network, non-auth) correctly', async () => {
    // Simulate other error (e.g., 500 server error)
    // Auth check now uses fetchUserProfile, not fetchStatus
    const serverError = new Error('Internal Server Error');
    serverError.response = {
      status: 500,
      data: { message: 'Server error' },
    };
    
    vi.mocked(fetchUserProfile).mockRejectedValue(serverError);

    const { getByTestId } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(getByTestId('is-loading')).toHaveTextContent('false');
    });

    // Should assume not authenticated for other errors
    expect(getByTestId('is-authenticated')).toHaveTextContent('false');
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Other error during auth check')
    );
  });

  it('should not cause infinite loops when network errors occur', async () => {
    // Simulate persistent network error
    // Auth check now uses fetchUserProfile, not fetchStatus
    const networkError = new Error('Network Error');
    networkError.response = undefined;
    
    vi.mocked(fetchUserProfile).mockRejectedValue(networkError);

    const { getByTestId } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(getByTestId('is-loading')).toHaveTextContent('false');
    }, { timeout: 3000 });

    // Should only call fetchUserProfile once (not in a loop)
    expect(fetchUserProfile).toHaveBeenCalledTimes(1);
    
    // Should complete loading state
    expect(getByTestId('is-loading')).toHaveTextContent('false');
  });

  it('should allow login page to display even with network errors', async () => {
    // Simulate network error
    // Auth check now uses fetchUserProfile, not fetchStatus
    const networkError = new Error('Network Error');
    networkError.response = undefined;
    
    vi.mocked(fetchUserProfile).mockRejectedValue(networkError);

    const { getByTestId } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(getByTestId('is-loading')).toHaveTextContent('false');
    });

    // Should be false to allow login page to show
    expect(getByTestId('is-authenticated')).toHaveTextContent('false');
    
    // But should log it as a network issue, not auth failure
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('cannot determine auth status')
    );
  });
});


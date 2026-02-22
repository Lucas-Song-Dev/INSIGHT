import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Mock the AuthContext (no top-level refs in factory so hoisting works in CI)
vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
  AuthProvider: ({ children }) => children,
}));

// Mock the NotificationContext
vi.mock('../context/NotificationContext', () => ({
  useNotification: () => ({
    notification: null,
    showNotification: vi.fn(),
    hideNotification: vi.fn(),
  }),
  NotificationProvider: ({ children }) => children,
}));

// Mock Background to avoid WebGL/canvas in jsdom (use alias so resolution matches App)
vi.mock('@/components/Background/Background', () => ({
  default: () => require('react').createElement('div', { 'data-testid': 'background' }, 'Background'),
}));

// Import App and AuthContext after mocking
import App from '../App';
import * as AuthContext from '../context/AuthContext';

describe('App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(AuthContext.useAuth).mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: null,
      login: vi.fn(),
      logout: vi.fn(),
    });
  });

  it('renders without crashing', () => {
    const { container } = render(<App />);
    expect(container).toBeTruthy();
  });

  it('renders main content', () => {
    render(<App />);
    const mainContent = screen.getByTestId('main-content');
    expect(mainContent).toBeInTheDocument();
  });

  it('renders navigation elements', () => {
    render(<App />);
    const navElements = screen.getAllByRole('navigation');
    expect(navElements.length).toBeGreaterThan(0);
  });

  it('displays preferred name in home page greeting when available', async () => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: {
        username: 'testuser',
        preferred_name: 'Test Preferred Name',
        full_name: 'Test User Full Name',
      },
      login: vi.fn(),
      logout: vi.fn(),
    });

    render(<App />);
    // Greeting is in a typewriter; wait for it to appear
    await waitFor(() => {
      expect(screen.getByText(/Good (morning|afternoon|evening), Test Preferred Name/i)).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('displays full name in greeting when preferred name is not available', async () => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: {
        username: 'testuser',
        preferred_name: null,
        full_name: 'Test User Full Name',
      },
      login: vi.fn(),
      logout: vi.fn(),
    });

    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(/Good (morning|afternoon|evening), Test User Full Name/i)).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('displays username in greeting when neither preferred nor full name is available', async () => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: {
        username: 'testuser',
        preferred_name: null,
        full_name: null,
      },
      login: vi.fn(),
      logout: vi.fn(),
    });

    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(/Good (morning|afternoon|evening), testuser/i)).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('displays "User" in greeting when no user data is available', async () => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: null,
      login: vi.fn(),
      logout: vi.fn(),
    });

    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(/Good (morning|afternoon|evening), User/i)).toBeInTheDocument();
    }, { timeout: 5000 });
  });
}); 
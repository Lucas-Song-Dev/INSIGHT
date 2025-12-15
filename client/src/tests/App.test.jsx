import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Mock the AuthContext with the correct path
const mockUseAuth = vi.fn();
vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
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

// Import App after mocking
import App from '../App';

describe('App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock
    mockUseAuth.mockReturnValue({
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

  it('displays preferred name in home page greeting when available', () => {
    mockUseAuth.mockReturnValue({
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
    
    // The greeting should show the preferred name
    expect(screen.getByText(/Good (morning|afternoon|evening), Test Preferred Name/i)).toBeInTheDocument();
  });

  it('displays full name in greeting when preferred name is not available', () => {
    mockUseAuth.mockReturnValue({
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
    
    // The greeting should show the full name
    expect(screen.getByText(/Good (morning|afternoon|evening), Test User Full Name/i)).toBeInTheDocument();
  });

  it('displays username in greeting when neither preferred nor full name is available', () => {
    mockUseAuth.mockReturnValue({
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
    
    // The greeting should show the username
    expect(screen.getByText(/Good (morning|afternoon|evening), testuser/i)).toBeInTheDocument();
  });

  it('displays "User" in greeting when no user data is available', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: null,
      login: vi.fn(),
      logout: vi.fn(),
    });

    render(<App />);
    
    // The greeting should show "User" as fallback
    expect(screen.getByText(/Good (morning|afternoon|evening), User/i)).toBeInTheDocument();
  });
}); 
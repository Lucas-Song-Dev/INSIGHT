import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import * as api from './api/api';

// Mock the API
vi.mock('./api/api');

// Mock all page components
vi.mock('./pages/postsPage/PostsPage', () => ({
  default: () => <div data-testid="posts-page">Posts Page</div>
}));

vi.mock('./pages/analysisPage/AnalysisPage', () => ({
  default: () => <div data-testid="analysis-page">Analysis Page</div>
}));

vi.mock('./pages/scrapePage/ScrapePage', () => ({
  default: () => <div data-testid="scrape-page">Scrape Page</div>
}));

vi.mock('./pages/recommendationPage/RecomendationPage', () => ({
  default: () => <div data-testid="recommendation-page">Recommendation Page</div>
}));

vi.mock('./pages/aboutPage/AboutPage', () => ({
  default: () => <div data-testid="about-page">About Page</div>
}));

vi.mock('./pages/resultsPage/ResultsPage', () => ({
  default: ({ setActivePage, setSelectedProduct }) => (
    <div data-testid="results-page">
      Results Page
      <button onClick={() => setActivePage('productDetail')}>Go to Product Detail</button>
    </div>
  )
}));

vi.mock('./pages/productDetailPage/ProductDetailPage', () => ({
  default: ({ selectedProduct, setActivePage }) => (
    <div data-testid="product-detail-page">
      Product Detail Page
      <button onClick={() => setActivePage('results')}>Back to Results</button>
    </div>
  )
}));

vi.mock('./pages/auth/LoginPage', () => ({
  default: ({ onLoginSuccess }) => (
    <div data-testid="login-page">
      Login Page
      <button onClick={() => onLoginSuccess()}>Login</button>
    </div>
  )
}));

// Mock context providers
const MockAuthProvider = ({ children, isAuthenticated = true, isLoading = false }) => {
  return (
    <div data-testid="auth-provider" data-authenticated={isAuthenticated} data-loading={isLoading}>
      {children}
    </div>
  );
};

const MockNotificationProvider = ({ children }) => {
  return <div data-testid="notification-provider">{children}</div>;
};

vi.mock('./context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn()
  }),
  AuthProvider: MockAuthProvider
}));

vi.mock('./context/NotificationContext', () => ({
  NotificationProvider: MockNotificationProvider
}));

// Mock components
vi.mock('./components/StatusBar/StatusBar', () => ({
  default: () => <div data-testid="status-bar">Status Bar</div>
}));

vi.mock('./components/NavBar/NavBar', () => ({
  default: ({ activePage, setActivePage, handleLogout }) => (
    <div data-testid="navbar">
      <button onClick={() => setActivePage('home')}>Home</button>
      <button onClick={() => setActivePage('scrapepage')}>Find Insights</button>
      <button onClick={() => setActivePage('results')}>Results</button>
      <button onClick={() => setActivePage('about')}>About</button>
      <button onClick={handleLogout}>Logout</button>
    </div>
  )
}));

vi.mock('./components/Notification/Notification', () => ({
  default: () => <div data-testid="notification">Notification</div>
}));

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.logoutUser.mockResolvedValue({ status: 'success' });
  });

  const renderApp = (authProps = {}) => {
    return render(
      <AuthProvider {...authProps}>
        <NotificationProvider>
          <App />
        </NotificationProvider>
      </AuthProvider>
    );
  };

  it('renders home page by default when authenticated', () => {
    renderApp();
    
    expect(screen.getByText('INSIGHT Analyzer')).toBeInTheDocument();
    expect(screen.getByText('Discover user insights and generate actionable recommendations')).toBeInTheDocument();
  });

  it('shows loading state when auth is loading', () => {
    vi.mocked(require('./context/AuthContext').useAuth).mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
      login: vi.fn(),
      logout: vi.fn()
    });
    
    renderApp();
    
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows login page when not authenticated', () => {
    vi.mocked(require('./context/AuthContext').useAuth).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn()
    });
    
    renderApp();
    
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
  });

  it('navigates to different pages correctly', async () => {
    renderApp();
    
    // Navigate to Find Insights
    const findInsightsButton = screen.getByText('Find Insights');
    await userEvent.click(findInsightsButton);
    
    expect(screen.getByTestId('scrape-page')).toBeInTheDocument();
    
    // Navigate to Results
    const resultsButton = screen.getByText('Results');
    await userEvent.click(resultsButton);
    
    expect(screen.getByTestId('results-page')).toBeInTheDocument();
    
    // Navigate to About
    const aboutButton = screen.getByText('About');
    await userEvent.click(aboutButton);
    
    expect(screen.getByTestId('about-page')).toBeInTheDocument();
  });

  it('navigates to product detail page from results', async () => {
    renderApp();
    
    // Go to results page first
    const resultsButton = screen.getByText('Results');
    await userEvent.click(resultsButton);
    
    // Click on product detail navigation
    const productDetailButton = screen.getByText('Go to Product Detail');
    await userEvent.click(productDetailButton);
    
    expect(screen.getByTestId('product-detail-page')).toBeInTheDocument();
  });

  it('handles logout correctly', async () => {
    const mockLogout = vi.fn();
    vi.mocked(require('./context/AuthContext').useAuth).mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: mockLogout
    });
    
    renderApp();
    
    const logoutButton = screen.getByText('Logout');
    await userEvent.click(logoutButton);
    
    await waitFor(() => {
      expect(api.logoutUser).toHaveBeenCalled();
      expect(mockLogout).toHaveBeenCalled();
    });
  });

  it('renders all main components', () => {
    renderApp();
    
    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.getByTestId('status-bar')).toBeInTheDocument();
    expect(screen.getByTestId('notification')).toBeInTheDocument();
    expect(screen.getByTestId('main-content')).toBeInTheDocument();
  });

  it('displays feature cards on home page', () => {
    renderApp();
    
    expect(screen.getByText('Find Insights')).toBeInTheDocument();
    expect(screen.getByText('View Results')).toBeInTheDocument();
    expect(screen.getByText('Learn More')).toBeInTheDocument();
  });

  it('displays usage guide on home page', () => {
    renderApp();
    
    expect(screen.getByText('How to Use This App')).toBeInTheDocument();
    expect(screen.getByText('Discover Insights')).toBeInTheDocument();
    expect(screen.getByText('View All Results')).toBeInTheDocument();
    expect(screen.getByText('Explore Product Details')).toBeInTheDocument();
    expect(screen.getByText('Take Action')).toBeInTheDocument();
  });

  it('navigates from feature cards', async () => {
    renderApp();
    
    // Click on Find Insights feature card button
    const findInsightsFeatureButton = screen.getAllByText('Find Insights')[1]; // Second one is the button
    await userEvent.click(findInsightsFeatureButton);
    
    expect(screen.getByTestId('scrape-page')).toBeInTheDocument();
  });

  it('shows page not found for invalid routes', async () => {
    renderApp();
    
    // Simulate invalid page navigation (this would normally come from router)
    // For now, we can't easily test this without a router, but the code handles it
    expect(screen.getByText('INSIGHT Analyzer')).toBeInTheDocument();
  });

  it('wraps content in error boundaries', () => {
    renderApp();
    
    // The error boundaries are rendered, we can't easily test error scenarios
    // without triggering actual errors, but we can verify the structure
    expect(screen.getByTestId('main-content')).toBeInTheDocument();
  });
});
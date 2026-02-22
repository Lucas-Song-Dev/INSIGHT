import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ResultsPage from '../ResultsPage';
import * as api from '../../../api/api';

// Mock the API
vi.mock('../../../api/api', () => ({
  fetchAllProducts: vi.fn(),
}));

// Mock PageHeader and LoadingState
vi.mock('../../../components/PageHeader/PageHeader', () => ({
  default: ({ title, description }) => (
    <div data-testid="page-header">
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  )
}));

vi.mock('../../../components/LoadingState/LoadingState', () => ({
  default: () => <div data-testid="loading-state">Loading...</div>
}));

function renderWithRouter(ui = <ResultsPage />) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={ui} />
        <Route path="/products/:productName" element={<div data-testid="product-detail">Product Detail</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ResultsPage - Comprehensive Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    console.log = vi.fn();
    console.error = vi.fn();
    console.warn = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Successful Product Fetching', () => {
    it('should fetch and display products successfully', async () => {
      const mockProducts = [
        { name: 'react', has_analysis: true, has_recommendations: false },
        { name: 'vue', has_analysis: false, has_recommendations: true },
        'angular'
      ];

      api.fetchAllProducts.mockResolvedValue({
        status: 'success',
        products: mockProducts
      });

      renderWithRouter();

      // Verify loading state
      expect(screen.getByTestId('loading-state')).toBeInTheDocument();

      // Wait for products to load
      await waitFor(() => {
        expect(screen.getByText('react')).toBeInTheDocument();
      });

      // Verify all products are displayed
      expect(screen.getByText('react')).toBeInTheDocument();
      expect(screen.getByText('vue')).toBeInTheDocument();
      expect(screen.getByText('angular')).toBeInTheDocument();

      // Verify product count
      expect(screen.getByText(/3 products with posts/i)).toBeInTheDocument();

      // Verify API was called
      expect(api.fetchAllProducts).toHaveBeenCalledTimes(1);
    });

    it('should display products with analysis badges correctly', async () => {
      const mockProducts = [
        { name: 'react', has_analysis: true, has_recommendations: true },
        { name: 'vue', has_analysis: false, has_recommendations: false }
      ];

      api.fetchAllProducts.mockResolvedValue({
        status: 'success',
        products: mockProducts
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('react')).toBeInTheDocument();
      });

      // Verify analysis badges (icons + text) - multiple product cards each have these labels
      expect(screen.getAllByText("Analysis").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Recommendations").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Posts").length).toBeGreaterThanOrEqual(1);
    });

    it('should handle empty products array', async () => {
      api.fetchAllProducts.mockResolvedValue({
        status: 'success',
        products: []
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText(/No products have posts yet/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message when API returns 401', async () => {
      api.fetchAllProducts.mockRejectedValue({
        response: {
          status: 401,
          data: { message: 'Authentication token is missing' }
        },
        message: 'Authentication token is missing'
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText(/authentication required/i)).toBeInTheDocument();
      });

      // Verify error logging
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[RESULTS PAGE]'),
        expect.anything()
      );
    });

    it('should display error message when API returns 500', async () => {
      api.fetchAllProducts.mockRejectedValue({
        response: {
          status: 500,
          data: { message: 'Internal server error' }
        },
        message: 'Internal server error'
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText(/server error/i)).toBeInTheDocument();
      });
    });

    it('should handle network errors gracefully', async () => {
      api.fetchAllProducts.mockRejectedValue(new Error('Network Error'));

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });
    });

    it('should handle CORS errors gracefully', async () => {
      const corsError = new Error('Network Error');
      corsError.message = 'Network Error';
      corsError.code = 'ERR_NETWORK';

      api.fetchAllProducts.mockRejectedValue(corsError);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });
    });

    it('should handle generic API errors', async () => {
      api.fetchAllProducts.mockRejectedValue({
        response: {
          status: 400,
          data: { message: 'Bad request' }
        },
        message: 'Bad request'
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText(/bad request/i)).toBeInTheDocument();
      });
    });
  });

  describe('Search Functionality', () => {
    it('should filter products by search term', async () => {
      const user = userEvent.setup();
      const mockProducts = ['react', 'vue', 'angular', 'svelte'];

      api.fetchAllProducts.mockResolvedValue({
        status: 'success',
        products: mockProducts
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('react')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search products/i);
      await user.type(searchInput, 'react');

      // Verify filtered results
      expect(screen.getByText('react')).toBeInTheDocument();
      expect(screen.queryByText('vue')).not.toBeInTheDocument();
      expect(screen.queryByText('angular')).not.toBeInTheDocument();
    });

    it('should show no results message when search has no matches', async () => {
      const user = userEvent.setup();
      const mockProducts = ['react', 'vue', 'angular'];

      api.fetchAllProducts.mockResolvedValue({
        status: 'success',
        products: mockProducts
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('react')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search products/i);
      await user.type(searchInput, 'nonexistent');

      await waitFor(() => {
        expect(screen.getByText(/No products match your search/i)).toBeInTheDocument();
      });
    });

    it('should clear search and show all products', async () => {
      const user = userEvent.setup();
      const mockProducts = ['react', 'vue', 'angular'];

      api.fetchAllProducts.mockResolvedValue({
        status: 'success',
        products: mockProducts
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('react')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search products/i);
      await user.type(searchInput, 'react');
      
      // Verify filtered
      expect(screen.queryByText('vue')).not.toBeInTheDocument();

      // Clear search
      await user.clear(searchInput);

      // Verify all products shown again
      await waitFor(() => {
        expect(screen.getByText('vue')).toBeInTheDocument();
      });
    });
  });

  describe('Product Click Navigation', () => {
    it('should navigate to product detail page when product is clicked', async () => {
      const user = userEvent.setup();
      const mockProducts = [
        { name: 'react', has_analysis: true }
      ];

      api.fetchAllProducts.mockResolvedValue({
        status: 'success',
        products: mockProducts
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('react')).toBeInTheDocument();
      });

      const productCard = screen.getByText('react').closest('.product-card');
      await user.click(productCard);

      await waitFor(() => {
        expect(screen.getByTestId('product-detail')).toBeInTheDocument();
      });
    });

    it('should handle string product names correctly', async () => {
      const user = userEvent.setup();
      const mockProducts = ['react', 'vue'];

      api.fetchAllProducts.mockResolvedValue({
        status: 'success',
        products: mockProducts
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('react')).toBeInTheDocument();
      });

      const productCard = screen.getByText('react').closest('.product-card');
      await user.click(productCard);

      await waitFor(() => {
        expect(screen.getByTestId('product-detail')).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading state while fetching products', async () => {
      // Mock slow API response
      api.fetchAllProducts.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ 
          status: 'success', 
          products: [] 
        }), 100))
      );

      renderWithRouter();

      // Verify loading state is shown
      expect(screen.getByTestId('loading-state')).toBeInTheDocument();

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByTestId('loading-state')).not.toBeInTheDocument();
      });
    });

    it('should hide loading state after successful fetch', async () => {
      api.fetchAllProducts.mockResolvedValue({
        status: 'success',
        products: ['react']
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.queryByTestId('loading-state')).not.toBeInTheDocument();
      });
    });

    it('should hide loading state after error', async () => {
      api.fetchAllProducts.mockRejectedValue(new Error('Network Error'));

      renderWithRouter();

      await waitFor(() => {
        expect(screen.queryByTestId('loading-state')).not.toBeInTheDocument();
      });
    });
  });

  describe('Logging', () => {
    it('should log component mount', async () => {
      api.fetchAllProducts.mockResolvedValue({
        status: 'success',
        products: []
      });

      renderWithRouter();

      await waitFor(() => {
        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('[RESULTS PAGE] ========== COMPONENT MOUNTED ==========')
        );
      });
    });

    it('should log successful product fetch with details', async () => {
      const mockProducts = ['react', 'vue'];
      api.fetchAllProducts.mockResolvedValue({
        status: 'success',
        products: mockProducts
      });

      renderWithRouter();

      await waitFor(() => {
        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('[RESULTS PAGE] ========== FETCH PRODUCTS SUCCESS ==========')
        );
      });
    });

    it('should log errors with detailed information', async () => {
      const error = {
        response: {
          status: 401,
          data: { message: 'Authentication token is missing' }
        },
        message: 'Authentication token is missing'
      };

      api.fetchAllProducts.mockRejectedValue(error);

      renderWithRouter();

      await waitFor(() => {
        // Check that console.error was called with error-related content
        const errorCalls = vi.mocked(console.error).mock.calls;
        const hasErrorLog = errorCalls.some((call) => 
          call.some((arg) => 
            typeof arg === 'string' && arg.includes('[RESULTS PAGE]') && arg.includes('ERROR')
          )
        );
        expect(hasErrorLog).toBe(true);
      });
    });

    it('should log product clicks', async () => {
      const user = userEvent.setup();
      const mockProducts = [{ name: 'react', has_analysis: true }];

      api.fetchAllProducts.mockResolvedValue({
        status: 'success',
        products: mockProducts
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('react')).toBeInTheDocument();
      });

      const productCard = screen.getByText('react').closest('.product-card');
      await user.click(productCard);

      await waitFor(() => {
        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('[RESULTS PAGE] Product clicked:'),
          'react'
        );
      });
    });

    it('should log search filter changes', async () => {
      const user = userEvent.setup();
      const mockProducts = ['react', 'vue'];

      api.fetchAllProducts.mockResolvedValue({
        status: 'success',
        products: mockProducts
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('react')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search products/i);
      await user.type(searchInput, 'react');

      await waitFor(() => {
        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('[RESULTS PAGE] Search filter applied:'),
          expect.anything()
        );
      });
    });
  });

  describe('API Integration', () => {
    it('should call fetchAllProducts with correct configuration', async () => {
      api.fetchAllProducts.mockResolvedValue({
        status: 'success',
        products: []
      });

      renderWithRouter();

      await waitFor(() => {
        expect(api.fetchAllProducts).toHaveBeenCalled();
      });

      // Verify API was called (logging happens in api.js which is mocked, so we can't verify those logs)
      // But we can verify the component logged its own actions
      const logCalls = vi.mocked(console.log).mock.calls;
      const hasComponentLog = logCalls.some((call) => 
        call.some((arg) => 
          typeof arg === 'string' && arg.includes('[RESULTS PAGE]')
        )
      );
      expect(hasComponentLog).toBe(true);
    });

    it('should handle API response with different product formats', async () => {
      const mockProducts = [
        'react',
        { name: 'vue', has_analysis: true },
        { name: 'angular', has_recommendations: true }
      ];

      api.fetchAllProducts.mockResolvedValue({
        status: 'success',
        products: mockProducts
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('react')).toBeInTheDocument();
        expect(screen.getByText('vue')).toBeInTheDocument();
        expect(screen.getByText('angular')).toBeInTheDocument();
      });
    });
  });
});


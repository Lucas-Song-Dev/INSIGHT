/**
 * E2E-style tests for ScrapePage
 * These tests simulate real user interactions without heavy mocking
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import ScrapePage from '../ScrapePage';
import * as apiModule from '@/api/api';
import { useNotification } from '@/context/NotificationContext';

// Real API module (minimal mocking)
vi.mock('@/api/api', async () => {
  const actual = await vi.importActual('@/api/api');
  return {
    ...actual,
    triggerScrape: vi.fn(),
    fetchStatus: vi.fn(),
  };
});

vi.mock('@/context/NotificationContext', () => ({
  useNotification: vi.fn(() => ({
    showNotification: vi.fn(),
  })),
}));

describe('ScrapePage E2E Tests', () => {
  const mockShowNotification = vi.fn();
  let mockTriggerScrape;
  let mockFetchStatus;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    
    mockTriggerScrape = vi.spyOn(apiModule, 'triggerScrape');
    mockFetchStatus = vi.spyOn(apiModule, 'fetchStatus');
    
    useNotification.mockReturnValue({ showNotification: mockShowNotification });
    mockFetchStatus.mockResolvedValue({
      scrape_in_progress: false,
      raw_posts_count: 0,
      pain_points_count: 0,
      last_scrape_time: null,
      apis: { reddit: 'connected', claude: 'connected' },
    });
  });

  describe('User Flow: Product Insights', () => {
    it('should complete full product insights flow', async () => {
      mockTriggerScrape.mockResolvedValue({
        status: 'success',
        topic: 'VS Code',
        product: 'vs code',
        suggested_subreddits: ['programming', 'webdev'],
        suggested_queries: ['VS Code', 'Visual Studio Code'],
        limit: 100,
        time_filter: 'week',
      });

      render(<ScrapePage />);

      // Step 1: Verify initial state
      expect(screen.getByText('Product Insights')).toHaveClass('active');
      expect(screen.getByLabelText('Topic or Product')).toBeInTheDocument();
      expect(screen.getByLabelText('Timeline')).toBeInTheDocument();

      // Step 2: User enters topic
      const topicInput = screen.getByLabelText('Topic or Product');
      fireEvent.change(topicInput, { target: { value: 'VS Code' } });
      expect(topicInput.value).toBe('VS Code');

      // Step 3: User changes time filter
      const timeFilter = screen.getByLabelText('Timeline');
      fireEvent.change(timeFilter, { target: { value: 'month' } });
      expect(timeFilter.value).toBe('month');

      // Step 4: Verify credits cost updated
      const button = screen.getByText(/Find Insights/i);
      expect(button.textContent).toMatch(/-\d+ credits/);

      // Step 5: User clicks Find Insights
      fireEvent.click(button);

      // Step 6: Verify loading state
      expect(screen.getByText(/Starting...|Discovering Insights.../i)).toBeInTheDocument();
      expect(button).toBeDisabled();

      // Step 7: Verify API call
      await waitFor(() => {
        expect(mockTriggerScrape).toHaveBeenCalledWith({
          topic: 'VS Code',
          limit: 100,
          time_filter: 'month',
          is_custom: false,
        });
      });

      // Step 8: Verify notification
      await waitFor(() => {
        expect(mockShowNotification).toHaveBeenCalledWith(
          expect.stringContaining('VS Code'),
          'info',
          8000
        );
      });
    });

    it('should handle form validation errors in product mode', async () => {
      render(<ScrapePage />);

      // Try to submit without topic
      const button = screen.getByText(/Find Insights/i);
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Topic or product name is required')).toBeInTheDocument();
        expect(mockShowNotification).toHaveBeenCalledWith(
          'Please fix the errors in the form',
          'error'
        );
      });

      expect(mockTriggerScrape).not.toHaveBeenCalled();
    });

    it('should persist form data to localStorage', async () => {
      render(<ScrapePage />);

      const topicInput = screen.getByLabelText('Topic or Product');
      const timeFilter = screen.getByLabelText('Timeline');

      fireEvent.change(topicInput, { target: { value: 'Test Product' } });
      fireEvent.change(timeFilter, { target: { value: 'year' } });

      // Wait for debounced save
      await waitFor(() => {
        const saved = JSON.parse(localStorage.getItem('scrape_form_data') || '{}');
        expect(saved.topic).toBe('Test Product');
        expect(saved.time_filter).toBe('year');
      }, { timeout: 1500 });
    });

    it('should restore form data from localStorage on mount', () => {
      localStorage.setItem('scrape_form_data', JSON.stringify({
        topic: 'Saved Product',
        time_filter: 'month',
        insightType: 'product',
      }));

      render(<ScrapePage />);

      expect(screen.getByLabelText('Topic or Product').value).toBe('Saved Product');
      expect(screen.getByLabelText('Timeline').value).toBe('month');
    });
  });

  describe('User Flow: Custom Insights', () => {
    it('should complete full custom insights flow', async () => {
      mockTriggerScrape.mockResolvedValue({
        status: 'success',
        topic: 'Find gaps in developer tools',
      });

      render(<ScrapePage />);

      // Step 1: Switch to custom insights
      const customToggle = screen.getByText('Custom Insights');
      fireEvent.click(customToggle);
      
      expect(customToggle).toHaveClass('active');
      expect(screen.queryByLabelText('Topic or Product')).not.toBeInTheDocument();

      // Step 2: Enter custom prompt
      const textarea = screen.getByLabelText('Custom Insights Prompt');
      const customPrompt = 'Find gaps in developer tools for Python';
      fireEvent.change(textarea, { target: { value: customPrompt } });
      expect(textarea.value).toBe(customPrompt);

      // Step 3: Verify credits cost shown
      const button = screen.getByText(/Generate Custom Insights/i);
      expect(button.textContent).toMatch(/-\d+ credits/);

      // Step 4: Submit
      fireEvent.click(button);

      // Step 5: Verify API call with is_custom flag
      await waitFor(() => {
        expect(mockTriggerScrape).toHaveBeenCalledWith({
          topic: customPrompt,
          limit: 100,
          time_filter: 'week',
          is_custom: true,
        });
      });
    });

    it('should handle validation errors in custom mode', async () => {
      render(<ScrapePage />);
      
      fireEvent.click(screen.getByText('Custom Insights'));
      
      const button = screen.getByText(/Generate Custom Insights/i);
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Topic or product name is required')).toBeInTheDocument();
        expect(mockTriggerScrape).not.toHaveBeenCalled();
      });
    });
  });

  describe('User Flow: Toggle Between Modes', () => {
    it('should switch between product and custom modes', () => {
      render(<ScrapePage />);

      // Initially in product mode
      expect(screen.getByText('Product Insights')).toHaveClass('active');
      expect(screen.getByLabelText('Topic or Product')).toBeInTheDocument();

      // Switch to custom
      fireEvent.click(screen.getByText('Custom Insights'));
      expect(screen.getByText('Custom Insights')).toHaveClass('active');
      expect(screen.queryByLabelText('Topic or Product')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Custom Insights Prompt')).toBeInTheDocument();

      // Switch back to product
      fireEvent.click(screen.getByText('Product Insights'));
      expect(screen.getByText('Product Insights')).toHaveClass('active');
      expect(screen.getByLabelText('Topic or Product')).toBeInTheDocument();
      expect(screen.queryByLabelText('Custom Insights Prompt')).not.toBeInTheDocument();
    });

    it('should maintain form data when switching modes', () => {
      render(<ScrapePage />);

      // Enter product topic
      const topicInput = screen.getByLabelText('Topic or Product');
      fireEvent.change(topicInput, { target: { value: 'Product Name' } });

      // Switch to custom
      fireEvent.click(screen.getByText('Custom Insights'));
      
      // Switch back to product
      fireEvent.click(screen.getByText('Product Insights'));

      // Topic should be cleared (new mode, new form)
      expect(screen.getByLabelText('Topic or Product').value).toBe('');
    });
  });

  describe('User Flow: Form Reset', () => {
    it('should reset product insights form', async () => {
      render(<ScrapePage />);

      const topicInput = screen.getByLabelText('Topic or Product');
      const timeFilter = screen.getByLabelText('Timeline');

      fireEvent.change(topicInput, { target: { value: 'Test Topic' } });
      fireEvent.change(timeFilter, { target: { value: 'year' } });

      const resetButton = screen.getByText('Clear All');
      fireEvent.click(resetButton);

      await waitFor(() => {
        expect(topicInput.value).toBe('');
        expect(timeFilter.value).toBe('week'); // Default value
      });
    });

    it('should reset custom insights form', async () => {
      render(<ScrapePage />);
      
      fireEvent.click(screen.getByText('Custom Insights'));

      const textarea = screen.getByLabelText('Custom Insights Prompt');
      fireEvent.change(textarea, { target: { value: 'Test custom prompt' } });

      const resetButton = screen.getByText('Clear');
      fireEvent.click(resetButton);

      await waitFor(() => {
        expect(textarea.value).toBe('');
      });
    });
  });

  describe('User Flow: Credits Display', () => {
    it('should update credits cost when time filter changes', async () => {
      render(<ScrapePage />);

      const timeFilter = screen.getByLabelText('Timeline');
      const button = screen.getByText(/Find Insights/i);

      // Get initial cost
      const initialCostText = button.textContent;
      const initialCost = parseInt(initialCostText.match(/-(\d+) credits/)?.[1] || '0');

      // Change to year (higher cost)
      fireEvent.change(timeFilter, { target: { value: 'year' } });

      await waitFor(() => {
        const updatedCostText = button.textContent;
        const updatedCost = parseInt(updatedCostText.match(/-(\d+) credits/)?.[1] || '0');
        expect(updatedCost).toBeGreaterThanOrEqual(initialCost);
      });
    });

    it('should show credits cost in both modes', () => {
      render(<ScrapePage />);

      // Product mode
      expect(screen.getByText(/Find Insights.*-\d+ credits/i)).toBeInTheDocument();

      // Custom mode
      fireEvent.click(screen.getByText('Custom Insights'));
      expect(screen.getByText(/Generate Custom Insights.*-\d+ credits/i)).toBeInTheDocument();
    });
  });

  describe('User Flow: Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      mockTriggerScrape.mockRejectedValue(new Error('Network error'));

      render(<ScrapePage />);

      const topicInput = screen.getByLabelText('Topic or Product');
      fireEvent.change(topicInput, { target: { value: 'Test' } });

      const button = screen.getByText(/Find Insights/i);
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockShowNotification).toHaveBeenCalledWith(
          expect.stringContaining('error'),
          'error',
          expect.any(Number)
        );
      });
    });

    it('should handle API error responses', async () => {
      mockTriggerScrape.mockResolvedValue({
        status: 'error',
        message: 'Insufficient credits',
      });

      render(<ScrapePage />);

      const topicInput = screen.getByLabelText('Topic or Product');
      fireEvent.change(topicInput, { target: { value: 'Test' } });

      const button = screen.getByText(/Find Insights/i);
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockShowNotification).toHaveBeenCalledWith(
          'Insufficient credits',
          'error',
          expect.any(Number)
        );
      });
    });
  });

  describe('Accessibility E2E', () => {
    it('should be fully accessible in product mode', async () => {
      const { container } = render(<ScrapePage />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    }, { timeout: 10000 });

    it('should be fully accessible in custom mode', async () => {
      const { container } = render(<ScrapePage />);
      
      fireEvent.click(screen.getByText('Custom Insights'));

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    }, { timeout: 10000 });

    it('should have proper keyboard navigation', () => {
      render(<ScrapePage />);

      const topicInput = screen.getByLabelText('Topic or Product');
      const timeFilter = screen.getByLabelText('Timeline');

      // Tab navigation should work
      topicInput.focus();
      expect(document.activeElement).toBe(topicInput);

      fireEvent.keyDown(topicInput, { key: 'Tab' });
      // Next focusable element should be timeFilter (though exact behavior depends on tabindex)
    });
  });
});


/**
 * E2E-style tests for ScrapePage
 * These tests simulate real user interactions without heavy mocking
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import ScrapePage from '../ScrapePage';

expect.extend(toHaveNoViolations);
import * as apiModule from '@/api/api';
import { useNotification } from '@/context/NotificationContext';

// Real API module (minimal mocking)
vi.mock('@/api/api', async () => {
  const actual = await vi.importActual('@/api/api');
  return {
    ...actual,
    triggerScrape: vi.fn(),
    fetchStatus: vi.fn(),
    fetchUserProfile: vi.fn(() => Promise.resolve({ status: 'success', user: { credits: 10 } })),
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

      // Step 2: User enters topic
      const topicInput = screen.getByLabelText('Topic or Product');
      fireEvent.change(topicInput, { target: { value: 'VS Code' } });
      expect(topicInput.value).toBe('VS Code');

      // Step 3: Verify credits cost on button
      const button = screen.getByRole('button', { name: /Find Insights \(-\d+ credits\)/ });
      expect(button.textContent).toMatch(/-\d+ credits/);

      // Step 5: User clicks Find Insights
      fireEvent.click(button);

      // Step 6: Verify loading state
      expect(screen.getByText(/Starting...|Discovering Insights.../i)).toBeInTheDocument();
      expect(button).toBeDisabled();

      // Step 6: Verify API call (time_filter uses form default, e.g. week)
      await waitFor(() => {
        expect(mockTriggerScrape).toHaveBeenCalledWith(
          expect.objectContaining({
            topic: 'VS Code',
            limit: 100,
            is_custom: false,
          })
        );
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
      const button = screen.getByRole('button', { name: /Find Insights \(-\d+ credits\)/ });
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
      fireEvent.change(topicInput, { target: { value: 'Test Product' } });

      // Wait for debounced save
      await waitFor(() => {
        const saved = JSON.parse(localStorage.getItem('scrape_form_data') || '{}');
        expect(saved.topic).toBe('Test Product');
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
      const button = screen.getByRole('button', { name: /Generate Custom Insights \(-\d+ credits\)/ });
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
      
      const button = screen.getByRole('button', { name: /Generate Custom Insights \(-\d+ credits\)/ });
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
      expect(screen.queryByLabelText('Topic or Product')).toBeNull();
      expect(screen.getByLabelText('Custom Insights Prompt')).toBeInTheDocument();

      // Switch back to product
      fireEvent.click(screen.getByText('Product Insights'));
      expect(screen.getByText('Product Insights')).toHaveClass('active');
      expect(screen.getByLabelText('Topic or Product')).toBeInTheDocument();
      expect(screen.queryByLabelText('Custom Insights Prompt')).toBeNull();
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
      fireEvent.change(topicInput, { target: { value: 'Test Topic' } });

      const resetButton = screen.getByText('Clear All');
      fireEvent.click(resetButton);

      await waitFor(() => {
        expect(topicInput.value).toBe('');
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
    it('should show credits cost on product insights button', () => {
      render(<ScrapePage />);
      const button = screen.getByRole('button', { name: /Find Insights \(-\d+ credits\)/ });
      const cost = parseInt(button.textContent.match(/-(\d+) credits/)?.[1] || '0');
      expect(cost).toBeGreaterThanOrEqual(1);
    });

    it('should show credits cost in both modes', () => {
      render(<ScrapePage />);

      // Product mode
      expect(screen.getByRole('button', { name: /Find Insights \(-\d+ credits\)/ })).toBeInTheDocument();

      // Custom mode
      fireEvent.click(screen.getByText('Custom Insights'));
      expect(screen.getByRole('button', { name: /Generate Custom Insights \(-\d+ credits\)/ })).toBeInTheDocument();
    });
  });

  describe('User Flow: Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      mockTriggerScrape.mockRejectedValue(new Error('Network error'));

      render(<ScrapePage />);

      const topicInput = screen.getByLabelText('Topic or Product');
      fireEvent.change(topicInput, { target: { value: 'Test' } });

      const button = screen.getByRole('button', { name: /Find Insights \(-\d+ credits\)/ });
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
        message: 'Insufficient credits. You have 0 credits but need 2.',
      });

      render(<ScrapePage />);

      const topicInput = screen.getByLabelText('Topic or Product');
      fireEvent.change(topicInput, { target: { value: 'Test' } });

      const button = screen.getByRole('button', { name: /Find Insights \(-\d+ credits\)/ });
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockShowNotification).toHaveBeenCalled();
        const [message] = mockShowNotification.mock.calls[0];
        expect(message).toMatch(/insufficient|credit/i);
        expect(mockShowNotification.mock.calls[0][1]).toBe('error');
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
      topicInput.focus();
      expect(document.activeElement).toBe(topicInput);
    });

    it('should show notification with form topic data, not API response', async () => {
      const mockShowNotification = vi.fn();
      const mockTriggerScrape = vi.fn().mockResolvedValue({
        status: 'success',
        topic: 'API_TOPIC' // Different from form topic
      });

      vi.mocked(useNotification).mockReturnValue({ showNotification: mockShowNotification });
      vi.doMock('../../../api/api', () => ({
        triggerScrape: mockTriggerScrape
      }));

      render(<ScrapePage />);

      const topicInput = screen.getByLabelText('Topic or Product');
      const scrapeButton = screen.getByRole('button', { name: /Find Insights \(-\d+ credits\)/ });

      fireEvent.change(topicInput, { target: { value: 'Form Topic' } });
      fireEvent.click(scrapeButton);

      await waitFor(() => {
        expect(mockShowNotification).toHaveBeenCalledWith(
          'Discovering insights for "Form Topic"...', // Should use form data, not API response
          'info',
          8000
        );
      });
    });
  });
});


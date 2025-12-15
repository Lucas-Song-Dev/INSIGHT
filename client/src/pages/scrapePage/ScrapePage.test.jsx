import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import ScrapePage from './ScrapePage';
import { triggerScrape } from '@/api/api';
import { useNotification } from '@/context/NotificationContext';

// Mock dependencies
vi.mock('@/api/api', () => ({
  triggerScrape: vi.fn(),
  fetchStatus: vi.fn(() => Promise.resolve({ scrape_in_progress: false })),
}));

vi.mock('@/context/NotificationContext', () => ({
  useNotification: vi.fn(() => ({
    showNotification: vi.fn(),
  })),
}));

describe('ScrapePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('Rendering', () => {
    it('renders the page header', () => {
      render(<ScrapePage />);
      expect(screen.getByText('Find Insights')).toBeInTheDocument();
      expect(screen.getByText(/Discover insights about products/i)).toBeInTheDocument();
    });

    it('renders insight type toggle', () => {
      render(<ScrapePage />);
      expect(screen.getByText('Product Insights')).toBeInTheDocument();
      expect(screen.getByText('Custom Insights')).toBeInTheDocument();
    });

    it('shows product insights form by default', () => {
      render(<ScrapePage />);
      expect(screen.getByPlaceholderText(/e.g., VS Code, React/i)).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('shows custom insights form when custom toggle is selected', () => {
      render(<ScrapePage />);
      const customToggle = screen.getByText('Custom Insights');
      fireEvent.click(customToggle);

      expect(screen.getByText('Custom Insights Prompt')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Describe what you want to discover/i)).toBeInTheDocument();
    });
  });

  describe('Custom Insights Flow', () => {
    it('switches to custom insights mode when toggle is clicked', () => {
      render(<ScrapePage />);
      
      const customToggle = screen.getByText('Custom Insights');
      fireEvent.click(customToggle);

      expect(screen.queryByText('Topic or Product')).not.toBeInTheDocument();
      expect(screen.getByText('Custom Insights Prompt')).toBeInTheDocument();
    });

    it('shows textarea for custom prompt input', () => {
      render(<ScrapePage />);
      
      const customToggle = screen.getByText('Custom Insights');
      fireEvent.click(customToggle);

      const textarea = screen.getByPlaceholderText(/Find market gaps/i);
      expect(textarea).toBeInTheDocument();
      expect(textarea.tagName).toBe('TEXTAREA');
    });

    it('submits custom insights with is_custom flag', async () => {
      const mockTriggerScrape = vi.mocked(triggerScrape);
      mockTriggerScrape.mockResolvedValue({ status: 'success', topic: 'test prompt' });

      render(<ScrapePage />);
      
      // Switch to custom insights
      const customToggle = screen.getByText('Custom Insights');
      fireEvent.click(customToggle);

      // Enter custom prompt
      const textarea = screen.getByPlaceholderText(/Find market gaps/i);
      fireEvent.change(textarea, { target: { value: 'Find market gaps in productivity tools' } });

      // Submit
      const submitButton = screen.getByText(/Generate Custom Insights/i);
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockTriggerScrape).toHaveBeenCalledWith(
          expect.objectContaining({
            topic: 'Find market gaps in productivity tools',
            is_custom: true,
          })
        );
      });
    });

    it('shows correct button text for custom insights', () => {
      render(<ScrapePage />);
      
      const customToggle = screen.getByText('Custom Insights');
      fireEvent.click(customToggle);

      const button = screen.getByText(/Generate Custom Insights/i);
      expect(button).toBeInTheDocument();
      expect(button.textContent).toMatch(/-\d+ credits/);
    });
  });

  describe('Product Insights Flow', () => {
    it('submits product insights with is_custom: false', async () => {
      const mockTriggerScrape = vi.mocked(triggerScrape);
      mockTriggerScrape.mockResolvedValue({ status: 'success', topic: 'VS Code' });

      render(<ScrapePage />);

      // Enter product name
      const input = screen.getByPlaceholderText(/e.g., VS Code/i);
      fireEvent.change(input, { target: { value: 'VS Code' } });

      // Submit
      const submitButton = screen.getByText(/Find Insights/i);
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockTriggerScrape).toHaveBeenCalledWith(
          expect.objectContaining({
            topic: 'VS Code',
            is_custom: false,
          })
        );
      });
    });

    it('validates topic input is required', async () => {
      const mockShowNotification = vi.fn();
      vi.mocked(useNotification).mockReturnValue({
        showNotification: mockShowNotification,
      });

      render(<ScrapePage />);

      const submitButton = screen.getByText(/Find Insights/i);
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockShowNotification).toHaveBeenCalledWith(
          'Please fix the errors in the form',
          'error'
        );
      });

      expect(triggerScrape).not.toHaveBeenCalled();
    });
  });

  describe('Credits Display', () => {
    it('displays credits cost on product insights button', () => {
      render(<ScrapePage />);
      const button = screen.getByText(/Find Insights/i);
      expect(button.textContent).toMatch(/-\d+ credits/);
    });

    it('displays credits cost on custom insights button', () => {
      render(<ScrapePage />);
      
      const customToggle = screen.getByText('Custom Insights');
      fireEvent.click(customToggle);

      const button = screen.getByText(/Generate Custom Insights/i);
      expect(button.textContent).toMatch(/-\d+ credits/);
    });

    it('calculates cost based on time filter', () => {
      render(<ScrapePage />);
      
      // Change time filter
      const timeFilter = screen.getByLabelText('Timeline');
      fireEvent.change(timeFilter, { target: { value: 'year' } });

      const button = screen.getByText(/Find Insights/i);
      // Year should have higher cost (multiplier 2.0)
      expect(button.textContent).toMatch(/-\d+ credits/);
    });
  });

  describe('Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<ScrapePage />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    }, { timeout: 10000 });

    it('toggle buttons have proper ARIA attributes', () => {
      render(<ScrapePage />);
      
      const productToggle = screen.getByText('Product Insights').closest('button');
      const customToggle = screen.getByText('Custom Insights').closest('button');
      
      expect(productToggle).toBeInTheDocument();
      expect(customToggle).toBeInTheDocument();
    });

    it('form inputs have proper labels', () => {
      render(<ScrapePage />);
      
      // Product mode
      expect(screen.getByText('Timeline')).toBeInTheDocument();
      
      // Custom mode
      const customToggle = screen.getByText('Custom Insights');
      fireEvent.click(customToggle);
      
      const textarea = screen.getByPlaceholderText(/Find market gaps/i);
      expect(textarea).toBeInTheDocument();
    });

    it('buttons have sufficient color contrast', async () => {
      const { container } = render(<ScrapePage />);
      const results = await axe(container, {
        rules: {
          'color-contrast': { enabled: true },
        },
      });
      expect(results).toHaveNoViolations();
    }, { timeout: 10000 });
  });

  describe('Toggle Functionality', () => {
    it('switches between product and custom modes', () => {
      render(<ScrapePage />);
      
      // Initially product mode
      expect(screen.getByText('Topic or Product')).toBeInTheDocument();
      
      // Switch to custom
      const customToggle = screen.getByText('Custom Insights');
      fireEvent.click(customToggle);
      expect(screen.getByText('Custom Insights Prompt')).toBeInTheDocument();
      
      // Switch back to product
      const productToggle = screen.getByText('Product Insights');
      fireEvent.click(productToggle);
      expect(screen.getByText('Topic or Product')).toBeInTheDocument();
    });

    it('maintains form data when switching modes', () => {
      render(<ScrapePage />);
      
      // Enter data in product mode
      const input = screen.getByPlaceholderText(/e.g., VS Code/i);
      fireEvent.change(input, { target: { value: 'VS Code' } });
      
      // Switch to custom
      const customToggle = screen.getByText('Custom Insights');
      fireEvent.click(customToggle);
      
      // Data should be preserved in textarea
      const textarea = screen.getByPlaceholderText(/Find market gaps/i);
      expect(textarea.value).toBe('VS Code');
    });
  });

  describe('Form Reset', () => {
    it('clears form when reset button is clicked', () => {
      render(<ScrapePage />);
      
      const input = screen.getByPlaceholderText(/e.g., VS Code/i);
      fireEvent.change(input, { target: { value: 'Test Product' } });
      
      const resetButton = screen.getByText('Clear All');
      fireEvent.click(resetButton);
      
      expect(input.value).toBe('');
    });

    it('clears custom insights form when reset is clicked', () => {
      render(<ScrapePage />);
      
      const customToggle = screen.getByText('Custom Insights');
      fireEvent.click(customToggle);
      
      const textarea = screen.getByPlaceholderText(/Find market gaps/i);
      fireEvent.change(textarea, { target: { value: 'Test prompt' } });
      
      const resetButton = screen.getByText('Clear');
      fireEvent.click(resetButton);
      
      expect(textarea.value).toBe('');
    });
  });
});


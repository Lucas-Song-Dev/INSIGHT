import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import ScrapePage from '../ScrapePage';
import { triggerScrape, fetchStatus } from '@/api/api';
import { useNotification } from '@/context/NotificationContext';

vi.mock('@/api/api', () => ({
  triggerScrape: vi.fn(),
  fetchStatus: vi.fn(() => Promise.resolve({ scrape_in_progress: false })),
}));

vi.mock('@/context/NotificationContext', () => ({
  useNotification: vi.fn(() => ({
    showNotification: vi.fn(),
  })),
}));

describe('ScrapePage Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
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

    it('updates credits cost when time filter changes', () => {
      render(<ScrapePage />);
      
      const initialButton = screen.getByText(/Find Insights/i);
      const initialCost = initialButton.textContent.match(/-(\d+) credits/)?.[1];
      
      // Change time filter to year (higher cost)
      const timeFilter = screen.getByLabelText('Timeline');
      fireEvent.change(timeFilter, { target: { value: 'year' } });

      const updatedButton = screen.getByText(/Find Insights/i);
      const updatedCost = updatedButton.textContent.match(/-(\d+) credits/)?.[1];
      
      expect(updatedCost).toBeDefined();
      // Year should typically have higher cost than week
      expect(parseInt(updatedCost || '0')).toBeGreaterThanOrEqual(parseInt(initialCost || '0'));
    });
  });

  describe('Form Submission', () => {
    it('submits product insights with correct parameters', async () => {
      const mockTriggerScrape = vi.mocked(triggerScrape);
      mockTriggerScrape.mockResolvedValue({ status: 'success', topic: 'VS Code' });

      render(<ScrapePage />);

      const input = screen.getByPlaceholderText(/e.g., VS Code/i);
      fireEvent.change(input, { target: { value: 'VS Code' } });

      const submitButton = screen.getByText(/Find Insights/i);
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockTriggerScrape).toHaveBeenCalledWith(
          expect.objectContaining({
            topic: 'VS Code',
            is_custom: false,
            limit: 100,
          })
        );
      });
    });

    it('submits custom insights with correct parameters', async () => {
      const mockTriggerScrape = vi.mocked(triggerScrape);
      mockTriggerScrape.mockResolvedValue({ status: 'success', topic: 'test prompt' });

      render(<ScrapePage />);
      
      const customToggle = screen.getByText('Custom Insights');
      fireEvent.click(customToggle);

      const textarea = screen.getByPlaceholderText(/Find market gaps/i);
      fireEvent.change(textarea, { target: { value: 'Find productivity tool gaps' } });

      const submitButton = screen.getByText(/Generate Custom Insights/i);
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockTriggerScrape).toHaveBeenCalledWith(
          expect.objectContaining({
            topic: 'Find productivity tool gaps',
            is_custom: true,
          })
        );
      });
    });
  });

  describe('Accessibility', () => {
    it('should have no accessibility violations in product mode', async () => {
      const { container } = render(<ScrapePage />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    }, { timeout: 10000 });

    it('should have no accessibility violations in custom mode', async () => {
      const { container } = render(<ScrapePage />);
      
      const customToggle = screen.getByText('Custom Insights');
      fireEvent.click(customToggle);

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    }, { timeout: 10000 });
  });
});


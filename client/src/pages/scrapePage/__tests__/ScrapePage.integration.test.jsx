import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import ScrapePage from '../ScrapePage';

expect.extend(toHaveNoViolations);
import { triggerScrape, fetchStatus } from '@/api/api';
import { useNotification } from '@/context/NotificationContext';

vi.mock('@/api/api', () => ({
  triggerScrape: vi.fn(),
  fetchStatus: vi.fn(() => Promise.resolve({ scrape_in_progress: false })),
  fetchUserProfile: vi.fn(() => Promise.resolve({ status: 'success', user: { credits: 10 } })),
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
      const button = screen.getByRole('button', { name: /Find Insights \(-\d+ credits\)/ });
      expect(button.textContent).toMatch(/-\d+ credits/);
    });

    it('displays credits cost on custom insights button', () => {
      render(<ScrapePage />);
      
      const customToggle = screen.getByText('Custom Insights');
      fireEvent.click(customToggle);

      const button = screen.getByRole('button', { name: /Generate Custom Insights \(-\d+ credits\)/ });
      expect(button.textContent).toMatch(/-\d+ credits/);
    });

    it('shows credits cost on product insights button', () => {
      render(<ScrapePage />);
      const button = screen.getByRole('button', { name: /Find Insights \(-\d+ credits\)/ });
      const cost = button.textContent.match(/-(\d+) credits/)?.[1];
      expect(cost).toBeDefined();
      expect(parseInt(cost || '0')).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Form Submission', () => {
    it('submits product insights with correct parameters', async () => {
      const mockTriggerScrape = vi.mocked(triggerScrape);
      mockTriggerScrape.mockResolvedValue({ status: 'success', topic: 'VS Code' });

      render(<ScrapePage />);

      const input = screen.getByPlaceholderText(/e.g., VS Code/i);
      fireEvent.change(input, { target: { value: 'VS Code' } });

      const submitButton = screen.getByRole('button', { name: /Find Insights \(-\d+ credits\)/ });
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

      const submitButton = screen.getByRole('button', { name: /Generate Custom Insights \(-\d+ credits\)/ });
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


/**
 * Tests for ScrapePage button state and behavior
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ScrapePage from '../ScrapePage';
import * as api from '@/api/api';
import { NotificationProvider } from '@/context/NotificationContext';

// Mock the API
vi.mock('@/api/api', () => ({
  triggerScrape: vi.fn(),
  fetchStatus: vi.fn(() => Promise.resolve({ scrape_in_progress: false })),
  fetchUserJobs: vi.fn(() => Promise.resolve({ jobs: [] })),
  fetchUserProfile: vi.fn(() => Promise.resolve({ status: 'success', user: { credits: 10 } })),
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('ScrapePage Button State', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should enable button when user has no active jobs', async () => {
    api.fetchUserJobs.mockResolvedValue({ jobs: [] });
    
    render(
      <NotificationProvider>
        <ScrapePage />
      </NotificationProvider>
    );

    await waitFor(() => {
      const button = screen.getByRole('button', { name: /Find Insights \(-\d+ credits\)/ });
      expect(button).not.toBeDisabled();
    });
  });

  it('should disable button when user has pending job', async () => {
    api.fetchUserJobs.mockResolvedValue({
      jobs: [
        {
          _id: '123',
          status: 'pending',
          parameters: { topic: 'Test' },
          created_at: new Date().toISOString()
        }
      ]
    });
    
    render(
      <NotificationProvider>
        <ScrapePage />
      </NotificationProvider>
    );

    await waitFor(() => {
      const button = screen.getByRole('button', { name: /Find Insights \(-\d+ credits\)/ });
      expect(button).toBeDisabled();
    });
  });

  it('should disable button when user has in_progress job', async () => {
    api.fetchUserJobs.mockResolvedValue({
      jobs: [
        {
          _id: '123',
          status: 'in_progress',
          parameters: { topic: 'Test' },
          created_at: new Date().toISOString()
        }
      ]
    });
    
    render(
      <NotificationProvider>
        <ScrapePage />
      </NotificationProvider>
    );

    await waitFor(() => {
      const button = screen.getByRole('button', { name: /Find Insights \(-\d+ credits\)/ });
      expect(button).toBeDisabled();
    });
  });

  it('should enable button when user only has completed jobs', async () => {
    api.fetchUserJobs.mockResolvedValue({
      jobs: [
        {
          _id: '123',
          status: 'completed',
          parameters: { topic: 'Test' },
          created_at: new Date().toISOString()
        }
      ]
    });
    
    render(
      <NotificationProvider>
        <ScrapePage />
      </NotificationProvider>
    );

    await waitFor(() => {
      const button = screen.getByRole('button', { name: /Find Insights \(-\d+ credits\)/ });
      expect(button).not.toBeDisabled();
    });
  });

  it('should enable button when fetchUserJobs fails (error handling)', async () => {
    api.fetchUserJobs.mockRejectedValue(new Error('API Error'));
    
    render(
      <NotificationProvider>
        <ScrapePage />
      </NotificationProvider>
    );

    await waitFor(() => {
      const button = screen.getByRole('button', { name: /Find Insights \(-\d+ credits\)/ });
      // Button should be enabled on error to allow retry
      expect(button).not.toBeDisabled();
    });
  });

  it('should allow clicking button when enabled', async () => {
    api.fetchUserJobs.mockResolvedValue({ jobs: [] });
    api.triggerScrape.mockResolvedValue({ status: 'success', job_id: '123' });
    
    const user = userEvent.setup();
    
    render(
      <NotificationProvider>
        <ScrapePage />
      </NotificationProvider>
    );

    await waitFor(() => {
      const button = screen.getByRole('button', { name: /Find Insights \(-\d+ credits\)/ });
      expect(button).not.toBeDisabled();
    });

    // Fill in topic
    const topicInput = screen.getByPlaceholderText(/e.g., VS Code/i);
    await user.type(topicInput, 'VS Code');

    // Click button
    const button = screen.getByRole('button', { name: /Find Insights \(-\d+ credits\)/ });
    await user.click(button);

    await waitFor(() => {
      expect(api.triggerScrape).toHaveBeenCalled();
    });
  });

  it('should re-enable button when active job completes', async () => {
    // Start with active job
    api.fetchUserJobs.mockResolvedValueOnce({
      jobs: [
        {
          _id: '123',
          status: 'in_progress',
          parameters: { topic: 'Test' },
          created_at: new Date().toISOString()
        }
      ]
    });

    const { rerender } = render(
      <NotificationProvider>
        <ScrapePage />
      </NotificationProvider>
    );

    await waitFor(() => {
      const button = screen.getByRole('button', { name: /Find Insights \(-\d+ credits\)/ });
      expect(button).toBeDisabled();
    });

    // Job completes
    api.fetchUserJobs.mockResolvedValue({
      jobs: [
        {
          _id: '123',
          status: 'completed',
          parameters: { topic: 'Test' },
          created_at: new Date().toISOString()
        }
      ]
    });

    // Wait for next poll
    await waitFor(() => {
      const button = screen.getByRole('button', { name: /Find Insights \(-\d+ credits\)/ });
      expect(button).not.toBeDisabled();
    }, { timeout: 12000 });
  });
});


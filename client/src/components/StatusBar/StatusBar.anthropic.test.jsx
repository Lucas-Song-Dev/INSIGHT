/**
 * Tests for AI Analysis status display fix
 * Verifies that the StatusBar correctly shows AI Analysis as connected
 * when the backend returns 'anthropic' field (not just 'claude' or 'openai')
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StatusBar from './StatusBar';
import { fetchStatus } from '@/api/api';

vi.mock('@/api/api', () => ({
  fetchStatus: vi.fn(),
}));

describe('StatusBar - AI Analysis Status Fix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show AI Analysis as connected when anthropic field is present', async () => {
    vi.mocked(fetchStatus).mockResolvedValue({
      scrape_in_progress: false,
      raw_posts_count: 100,
      pain_points_count: 10,
      last_scrape_time: new Date().toISOString(),
      apis: {
        reddit: 'connected',
        anthropic: 'connected', // Backend returns 'anthropic', not 'claude'
      },
    });

    const { container } = render(<StatusBar />);
    
    await waitFor(() => {
      expect(screen.getByText('Ready')).toBeInTheDocument();
    });

    // Click "Show Details" to expand the status details
    const user = userEvent.setup();
    await user.click(screen.getByText('Show Details'));

    await waitFor(() => {
      // Should find the AI Analysis status
      const aiAnalysisStatus = screen.getByText(/AI Analysis:/i);
      expect(aiAnalysisStatus).toBeInTheDocument();
      
      // Should show as connected (not error/red)
      const connectedStatuses = screen.getAllByText('connected');
      expect(connectedStatuses.length).toBeGreaterThan(0);
    });

    // Verify the status has the correct class (not error class)
    const apiStatusElements = container.querySelectorAll('.api-status');
    const aiAnalysisElement = Array.from(apiStatusElements).find(el => 
      el.textContent?.includes('AI Analysis')
    );
    
    expect(aiAnalysisElement).toBeInTheDocument();
    expect(aiAnalysisElement).toHaveClass('status-connected');
    expect(aiAnalysisElement).not.toHaveClass('status-error');
  });

  it('should show AI Analysis as connected when anthropic is connected (backward compatibility)', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchStatus).mockResolvedValue({
      scrape_in_progress: false,
      raw_posts_count: 100,
      pain_points_count: 10,
      last_scrape_time: new Date().toISOString(),
      apis: {
        reddit: 'connected',
        anthropic: 'connected',
        claude: 'not_configured', // Old field still present
      },
    });

    const { container } = render(<StatusBar />);
    
    await waitFor(() => {
      expect(screen.getByText('Ready')).toBeInTheDocument();
    });

    // Expand details
    await user.click(screen.getByText('Show Details'));

    await waitFor(() => {
      expect(screen.getByText(/AI Analysis:/i)).toBeInTheDocument();
    });

    // Should prioritize anthropic over claude
    const apiStatusElements = container.querySelectorAll('.api-status');
    const aiAnalysisElement = Array.from(apiStatusElements).find(el => 
      el.textContent?.includes('AI Analysis')
    );
    
    expect(aiAnalysisElement).toBeInTheDocument();
    expect(aiAnalysisElement).toHaveClass('status-connected');
  });

  it('should show AI Analysis as error when anthropic is not_configured', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchStatus).mockResolvedValue({
      scrape_in_progress: false,
      raw_posts_count: 100,
      pain_points_count: 10,
      last_scrape_time: new Date().toISOString(),
      apis: {
        reddit: 'connected',
        anthropic: 'not_configured',
      },
    });

    const { container } = render(<StatusBar />);
    
    await waitFor(() => {
      expect(screen.getByText('Ready')).toBeInTheDocument();
    });

    // Expand details
    await user.click(screen.getByText('Show Details'));

    await waitFor(() => {
      expect(screen.getByText('not_configured')).toBeInTheDocument();
    });

    // Should have error class when not configured
    const apiStatusElements = container.querySelectorAll('.api-status');
    const aiAnalysisElement = Array.from(apiStatusElements).find(el => 
      el.textContent?.includes('AI Analysis')
    );
    
    expect(aiAnalysisElement).toBeInTheDocument();
    expect(aiAnalysisElement).toHaveClass('status-error');
  });

  it('should fallback to claude field if anthropic is not present (backward compatibility)', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchStatus).mockResolvedValue({
      scrape_in_progress: false,
      raw_posts_count: 100,
      pain_points_count: 10,
      last_scrape_time: new Date().toISOString(),
      apis: {
        reddit: 'connected',
        claude: 'connected', // Old format
        // anthropic not present
      },
    });

    const { container } = render(<StatusBar />);
    
    await waitFor(() => {
      expect(screen.getByText('Ready')).toBeInTheDocument();
    });

    // Expand details
    await user.click(screen.getByText('Show Details'));

    await waitFor(() => {
      expect(screen.getByText(/AI Analysis:/i)).toBeInTheDocument();
    });

    // Should still work with old format
    const apiStatusElements = container.querySelectorAll('.api-status');
    const aiAnalysisElement = Array.from(apiStatusElements).find(el => 
      el.textContent?.includes('AI Analysis')
    );
    
    expect(aiAnalysisElement).toBeInTheDocument();
    expect(aiAnalysisElement).toHaveClass('status-connected');
  });

  it('should fallback to openai field if neither anthropic nor claude is present', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchStatus).mockResolvedValue({
      scrape_in_progress: false,
      raw_posts_count: 100,
      pain_points_count: 10,
      last_scrape_time: new Date().toISOString(),
      apis: {
        reddit: 'connected',
        openai: 'connected', // Very old format
        // anthropic and claude not present
      },
    });

    const { container } = render(<StatusBar />);
    
    await waitFor(() => {
      expect(screen.getByText('Ready')).toBeInTheDocument();
    });

    // Expand details
    await user.click(screen.getByText('Show Details'));

    await waitFor(() => {
      expect(screen.getByText(/AI Analysis:/i)).toBeInTheDocument();
    });

    // Should still work with very old format
    const apiStatusElements = container.querySelectorAll('.api-status');
    const aiAnalysisElement = Array.from(apiStatusElements).find(el => 
      el.textContent?.includes('AI Analysis')
    );
    
    expect(aiAnalysisElement).toBeInTheDocument();
    expect(aiAnalysisElement).toHaveClass('status-connected');
  });

  it('should display correct status text for anthropic field', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchStatus).mockResolvedValue({
      scrape_in_progress: false,
      raw_posts_count: 100,
      pain_points_count: 10,
      last_scrape_time: new Date().toISOString(),
      apis: {
        reddit: 'connected',
        anthropic: 'connected',
      },
    });

    render(<StatusBar />);
    
    await waitFor(() => {
      expect(screen.getByText('Ready')).toBeInTheDocument();
    });

    // Expand details
    await user.click(screen.getByText('Show Details'));
    
    await waitFor(() => {
      // Should display "connected" as the status text
      expect(screen.getByText(/AI Analysis:/i)).toBeInTheDocument();
      
      // Find the one associated with AI Analysis
      const aiAnalysisRow = screen.getByText(/AI Analysis:/i).closest('.api-status');
      expect(aiAnalysisRow).toHaveTextContent('connected');
    });
  });
});

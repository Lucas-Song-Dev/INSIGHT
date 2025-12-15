import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import StatusBar from './StatusBar';
import { fetchStatus } from '@/api/api';

expect.extend(toHaveNoViolations);

vi.mock('@/api/api', () => ({
  fetchStatus: vi.fn(),
}));

describe('StatusBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    vi.mocked(fetchStatus).mockImplementation(() => new Promise(() => {}));
    render(<StatusBar />);
    expect(screen.getByText(/Loading status/i)).toBeInTheDocument();
  });

  it('renders ready state when scrape is not in progress', async () => {
    vi.mocked(fetchStatus).mockResolvedValue({
      scrape_in_progress: false,
      raw_posts_count: 100,
      pain_points_count: 10,
      last_scrape_time: new Date().toISOString(),
      apis: {
        reddit: 'connected',
        claude: 'connected',
      },
    });

    render(<StatusBar />);
    
    await waitFor(() => {
      expect(screen.getByText('Ready')).toBeInTheDocument();
    });
  });

  it('renders discovering insights state when scrape is in progress', async () => {
    vi.mocked(fetchStatus).mockResolvedValue({
      scrape_in_progress: true,
      raw_posts_count: 50,
      pain_points_count: 5,
      last_scrape_time: new Date().toISOString(),
      apis: {
        reddit: 'connected',
        claude: 'connected',
      },
    });

    render(<StatusBar />);
    
    await waitFor(() => {
      expect(screen.getByText('Discovering insights...')).toBeInTheDocument();
    });
  });

  it('should have no accessibility violations', async () => {
    vi.mocked(fetchStatus).mockResolvedValue({
      scrape_in_progress: false,
      raw_posts_count: 100,
      pain_points_count: 10,
      last_scrape_time: new Date().toISOString(),
      apis: {
        reddit: 'connected',
        claude: 'connected',
      },
    });

    const { container } = render(<StatusBar />);
    
    await waitFor(() => {
      expect(screen.getByText('Ready')).toBeInTheDocument();
    });

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('displays status statistics', async () => {
    vi.mocked(fetchStatus).mockResolvedValue({
      scrape_in_progress: false,
      raw_posts_count: 150,
      pain_points_count: 25,
      last_scrape_time: new Date().toISOString(),
      apis: {
        reddit: 'connected',
        claude: 'connected',
      },
    });

    render(<StatusBar />);
    
    await waitFor(() => {
      expect(screen.getByText('150')).toBeInTheDocument();
      expect(screen.getByText('25')).toBeInTheDocument();
    });
  });
});


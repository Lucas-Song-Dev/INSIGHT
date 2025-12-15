import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import PostsPage from './PostsPage';
import * as api from '../../api/api';

// Mock the API
vi.mock('../../api/api');

// Mock the PageHeader component
vi.mock('../../components/PageHeader/PageHeader', () => ({
  default: ({ title, description }) => (
    <div data-testid="page-header">
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  )
}));

describe('PostsPage', () => {
  const mockDiscussions = [
    {
      id: '1',
      title: 'Test Discussion 1',
      body: 'This is a test discussion about React',
      author: 'testuser1',
      subreddit: 'reactjs',
      url: 'https://reddit.com/r/reactjs/1',
      created_utc: '2024-01-01T00:00:00Z',
      score: 100,
      num_comments: 25,
      sentiment: 0.5,
      products: ['react'],
      topics: ['development'],
      pain_points: ['performance:slow']
    },
    {
      id: '2',
      title: 'Test Discussion 2',
      body: 'Another test discussion',
      author: 'testuser2',
      subreddit: 'javascript',
      url: 'https://reddit.com/r/javascript/2',
      created_utc: '2024-01-02T00:00:00Z',
      score: 50,
      num_comments: 10,
      sentiment: -0.3,
      products: ['javascript'],
      topics: ['bugs'],
      pain_points: ['usability:confusing']
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    api.fetchPosts.mockResolvedValue({
      posts: mockDiscussions
    });
  });

  it('renders page header with correct title', () => {
    render(<PostsPage />);
    
    expect(screen.getByTestId('page-header')).toBeInTheDocument();
    expect(screen.getByText('Insights')).toBeInTheDocument();
  });

  it('loads and displays discussions on mount', async () => {
    render(<PostsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Discussion 1')).toBeInTheDocument();
    });
    
    expect(screen.getByText('Test Discussion 2')).toBeInTheDocument();
    expect(screen.getByText('Showing 2 of 2 discussions')).toBeInTheDocument();
  });

  it('filters discussions by search term', async () => {
    render(<PostsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Discussion 1')).toBeInTheDocument();
    });
    
    const searchInput = screen.getByPlaceholderText('Search in posts, titles, sources...');
    await userEvent.type(searchInput, 'React');
    
    expect(screen.getByText('Test Discussion 1')).toBeInTheDocument();
    expect(screen.queryByText('Test Discussion 2')).not.toBeInTheDocument();
    expect(screen.getByText('Showing 1 of 2 discussions')).toBeInTheDocument();
  });

  it('filters discussions by minimum score', async () => {
    render(<PostsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Discussion 1')).toBeInTheDocument();
    });
    
    const minScoreInput = screen.getByLabelText('Min Score').closest('div').querySelector('input');
    await userEvent.type(minScoreInput, '75');
    
    expect(screen.getByText('Test Discussion 1')).toBeInTheDocument();
    expect(screen.queryByText('Test Discussion 2')).not.toBeInTheDocument();
  });

  it('toggles between list and grid view', async () => {
    render(<PostsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Discussion 1')).toBeInTheDocument();
    });
    
    const gridViewButton = screen.getByTitle('Grid View');
    await userEvent.click(gridViewButton);
    
    const discussionsContainer = document.querySelector('.discussions-container');
    expect(discussionsContainer).toHaveClass('grid-view');
    
    const listViewButton = screen.getByTitle('List View');
    await userEvent.click(listViewButton);
    
    expect(discussionsContainer).toHaveClass('list-view');
  });

  it('clears all filters when clear button is clicked', async () => {
    render(<PostsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Discussion 1')).toBeInTheDocument();
    });
    
    // Apply some filters
    const searchInput = screen.getByPlaceholderText('Search in posts, titles, sources...');
    await userEvent.type(searchInput, 'React');
    
    const minScoreInput = screen.getByLabelText('Min Score').closest('div').querySelector('input');
    await userEvent.type(minScoreInput, '75');
    
    // Clear filters
    const clearButton = screen.getByText('Clear Filters');
    await userEvent.click(clearButton);
    
    expect(searchInput.value).toBe('');
    expect(minScoreInput.value).toBe('');
    expect(screen.getByText('Showing 2 of 2 discussions')).toBeInTheDocument();
  });

  it('fetches new discussions when form is submitted', async () => {
    render(<PostsPage />);
    
    await waitFor(() => {
      expect(api.fetchPosts).toHaveBeenCalledTimes(1);
    });
    
    const fetchButton = screen.getByText('Fetch Discussions');
    await userEvent.click(fetchButton);
    
    expect(api.fetchPosts).toHaveBeenCalledTimes(2);
  });

  it('displays error message when API fails', async () => {
    api.fetchPosts.mockRejectedValue(new Error('API Error'));
    
    render(<PostsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to fetch discussions. Please try again later.')).toBeInTheDocument();
    });
  });

  it('shows loading state while fetching', async () => {
    api.fetchPosts.mockImplementation(() => new Promise(() => {})); // Never resolves
    
    render(<PostsPage />);
    
    expect(screen.getByText('Loading discussions...')).toBeInTheDocument();
  });

  it('displays no discussions message when no results', async () => {
    api.fetchPosts.mockResolvedValue({ posts: [] });
    
    render(<PostsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('No discussions found. Try fetching discussions using the controls above.')).toBeInTheDocument();
    });
  });

  it('applies product filter when provided', async () => {
    render(<PostsPage productFilter="react" />);
    
    await waitFor(() => {
      expect(api.fetchPosts).toHaveBeenCalledWith(
        expect.objectContaining({
          product: 'react'
        })
      );
    });
  });

  it('displays discussion metadata correctly', async () => {
    render(<PostsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Discussion 1')).toBeInTheDocument();
    });
    
    // Check for author, subreddit, score
    expect(screen.getByText('u/testuser1')).toBeInTheDocument();
    expect(screen.getAllByText('reactjs')[0]).toBeInTheDocument(); // First occurrence (in discussion)
    expect(screen.getByText('100 points')).toBeInTheDocument();
    expect(screen.getByText('25 comments')).toBeInTheDocument();
  });

  it('displays sentiment with correct styling', async () => {
    render(<PostsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Discussion 1')).toBeInTheDocument();
    });
    
    const positiveSentiment = screen.getByText('Sentiment: 0.50');
    expect(positiveSentiment).toHaveClass('positive');
    
    const negativeSentiment = screen.getByText('Sentiment: -0.30');
    expect(negativeSentiment).toHaveClass('negative');
  });

  it('displays products and topics as tags', async () => {
    render(<PostsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Discussion 1')).toBeInTheDocument();
    });
    
    // Use more specific selectors for tags
    expect(document.querySelector('.product-tag')).toHaveTextContent('react');
    expect(document.querySelector('.topic-tag')).toHaveTextContent('development');
    expect(document.querySelectorAll('.product-tag')[1]).toHaveTextContent('javascript');
    expect(document.querySelectorAll('.topic-tag')[1]).toHaveTextContent('bugs');
  });
});
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import UserProfile from './UserProfile';
import * as api from '../../api/api';

// Mock the API
vi.mock('../../api/api');

describe('UserProfile', () => {
  const mockUser = {
    username: 'testuser',
    email: 'test@example.com',
    credits: 15,
    created_at: '2024-01-01T00:00:00Z',
    last_login: '2024-01-15T12:00:00Z'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when not visible', () => {
    render(<UserProfile isVisible={false} onClose={() => {}} />);
    
    expect(screen.queryByText('User Profile')).not.toBeInTheDocument();
  });

  it('renders loading state initially when visible', () => {
    api.fetchUserProfile.mockImplementation(() => new Promise(() => {})); // Never resolves
    
    render(<UserProfile isVisible={true} onClose={() => {}} />);
    
    expect(screen.getByText('Loading profile...')).toBeInTheDocument();
  });

  it('renders user profile data successfully', async () => {
    api.fetchUserProfile.mockResolvedValue({
      status: 'success',
      user: mockUser
    });
    
    render(<UserProfile isVisible={true} onClose={() => {}} />);
    
    await waitFor(() => {
      expect(screen.getByText('testuser')).toBeInTheDocument();
    });
    
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('Credits Available')).toBeInTheDocument();
  });

  it('renders error state when API fails', async () => {
    api.fetchUserProfile.mockRejectedValue(new Error('API Error'));
    
    render(<UserProfile isVisible={true} onClose={() => {}} />);
    
    await waitFor(() => {
      expect(screen.getByText('API Error')).toBeInTheDocument();
    });
    
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const mockOnClose = vi.fn();
    api.fetchUserProfile.mockResolvedValue({
      status: 'success',
      user: mockUser
    });
    
    render(<UserProfile isVisible={true} onClose={mockOnClose} />);
    
    const closeButton = screen.getByRole('button', { name: '×' });
    await userEvent.click(closeButton);
    
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls onClose when overlay is clicked', async () => {
    const mockOnClose = vi.fn();
    api.fetchUserProfile.mockResolvedValue({
      status: 'success',
      user: mockUser
    });
    
    render(<UserProfile isVisible={true} onClose={mockOnClose} />);
    
    const overlay = document.querySelector('.user-profile-overlay');
    await userEvent.click(overlay);
    
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('does not close when modal content is clicked', async () => {
    const mockOnClose = vi.fn();
    api.fetchUserProfile.mockResolvedValue({
      status: 'success',
      user: mockUser
    });
    
    render(<UserProfile isVisible={true} onClose={mockOnClose} />);
    
    await waitFor(() => {
      expect(screen.getByText('testuser')).toBeInTheDocument();
    });
    
    const modal = document.querySelector('.user-profile-modal');
    await userEvent.click(modal);
    
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('retries loading profile when retry button is clicked', async () => {
    api.fetchUserProfile
      .mockRejectedValueOnce(new Error('API Error'))
      .mockResolvedValueOnce({
        status: 'success',
        user: mockUser
      });
    
    render(<UserProfile isVisible={true} onClose={() => {}} />);
    
    await waitFor(() => {
      expect(screen.getByText('API Error')).toBeInTheDocument();
    });
    
    const retryButton = screen.getByRole('button', { name: 'Try Again' });
    await userEvent.click(retryButton);
    
    await waitFor(() => {
      expect(screen.getByText('testuser')).toBeInTheDocument();
    });
    
    expect(api.fetchUserProfile).toHaveBeenCalledTimes(2);
  });

  it('displays cost breakdown information', async () => {
    api.fetchUserProfile.mockResolvedValue({
      status: 'success',
      user: mockUser
    });
    
    render(<UserProfile isVisible={true} onClose={() => {}} />);
    
    await waitFor(() => {
      expect(screen.getByText('Cost Examples:')).toBeInTheDocument();
    });
    
    expect(screen.getByText(/Small analysis.*2 credits/)).toBeInTheDocument();
    expect(screen.getByText(/Medium analysis.*6 credits/)).toBeInTheDocument();
    expect(screen.getByText(/Large analysis.*12 credits/)).toBeInTheDocument();
    expect(screen.getByText(/Comprehensive analysis.*20 credits/)).toBeInTheDocument();
  });
});
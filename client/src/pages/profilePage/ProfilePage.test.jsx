import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProfilePage from './ProfilePage';
import * as api from '../../api/api';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';

// Mock dependencies
vi.mock('../../api/api');
vi.mock('../../context/AuthContext');
vi.mock('../../context/NotificationContext');

describe('ProfilePage', () => {
  const mockLogout = vi.fn();
  const mockShowNotification = vi.fn();
  const mockLogoutUser = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup auth context mock
    useAuth.mockReturnValue({
      logout: mockLogout,
      user: { username: 'testuser' },
    });

    // Setup notification context mock
    useNotification.mockReturnValue({
      showNotification: mockShowNotification,
    });

    // Setup API mocks
    api.fetchUserProfile.mockResolvedValue({
      status: 'success',
      user: {
        username: 'testuser',
        email: 'test@example.com',
        full_name: 'Test User Full Name',
        preferred_name: 'Test Preferred Name',
        birthday: '1990-01-01',
        credits: 10,
        created_at: '2024-01-01T00:00:00Z',
        last_login: '2024-01-15T12:00:00Z',
      },
    });

    api.logoutUser = mockLogoutUser;
    mockLogoutUser.mockResolvedValue({ status: 'success' });
  });

  it('should render profile information', async () => {
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test User Full Name')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test Preferred Name')).toBeInTheDocument();
      expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument();
      expect(screen.getByText('10 credits available')).toBeInTheDocument();
    });
  });

  it('should display full_name, preferred_name, and birthday fields', async () => {
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/what should we call you/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/birthday/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test User Full Name')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test Preferred Name')).toBeInTheDocument();
    });
  });

  it('should handle missing optional fields gracefully', async () => {
    api.fetchUserProfile.mockResolvedValueOnce({
      status: 'success',
      user: {
        username: 'testuser',
        email: null,
        full_name: null,
        preferred_name: null,
        birthday: null,
        credits: 10,
        created_at: '2024-01-01T00:00:00Z',
        last_login: null,
      },
    });

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('testuser')).toBeInTheDocument();
      expect(screen.getByText('10 credits available')).toBeInTheDocument();
    });
  });

  it('should show delete account button', async () => {
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('Delete Account')).toBeInTheDocument();
    });
  });

  it('should show confirmation dialog when delete button is clicked', async () => {
    const user = userEvent.setup();
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('Delete Account')).toBeInTheDocument();
    });

    const deleteButton = screen.getByText('Delete Account');
    await user.click(deleteButton);

    expect(screen.getByText(/Are you sure you want to delete your account/i)).toBeInTheDocument();
    expect(screen.getByText(/Yes, Delete My Account/i)).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('should cancel deletion when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('Delete Account')).toBeInTheDocument();
    });

    const deleteButton = screen.getByText('Delete Account');
    await user.click(deleteButton);

    const cancelButton = screen.getByText('Cancel');
    await user.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByText(/Are you sure you want to delete your account/i)).not.toBeInTheDocument();
    });
  });

  it('should delete account and logout when confirmed', async () => {
    const user = userEvent.setup();
    api.deleteAccount = vi.fn().mockResolvedValue({
      status: 'success',
      message: 'Account deleted successfully',
    });

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('Delete Account')).toBeInTheDocument();
    });

    const deleteButton = screen.getByText('Delete Account');
    await user.click(deleteButton);

    const confirmButton = screen.getByText(/Yes, Delete My Account/i);
    await user.click(confirmButton);

    await waitFor(() => {
      expect(api.deleteAccount).toHaveBeenCalled();
      expect(mockLogoutUser).toHaveBeenCalled();
      expect(mockLogout).toHaveBeenCalled();
      expect(mockShowNotification).toHaveBeenCalledWith(
        'Account deleted successfully',
        'success'
      );
    });
  });

  it('should handle delete account error', async () => {
    const user = userEvent.setup();
    api.deleteAccount = vi.fn().mockRejectedValue({
      message: 'Failed to delete account',
    });

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('Delete Account')).toBeInTheDocument();
    });

    const deleteButton = screen.getByText('Delete Account');
    await user.click(deleteButton);

    const confirmButton = screen.getByText(/Yes, Delete My Account/i);
    await user.click(confirmButton);

    await waitFor(() => {
      expect(api.deleteAccount).toHaveBeenCalled();
      expect(mockShowNotification).toHaveBeenCalledWith(
        'Failed to delete account',
        'error'
      );
      expect(mockLogout).not.toHaveBeenCalled();
    });
  });
});








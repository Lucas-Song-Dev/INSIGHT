import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RegisterForm from '../RegisterForm';
import * as api from '../../../api/api';
import { NotificationProvider } from '../../../context/NotificationContext';

// Mock API calls
vi.mock('../../../api/api', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    registerUser: vi.fn(),
  };
});

// Mock console methods to capture logs
const mockConsoleLog = vi.fn();
const mockConsoleError = vi.fn();
const mockConsoleWarn = vi.fn();

const renderWithProviders = (props = {}) => {
  const defaultOnRegisterSuccess = vi.fn();
  const defaultOnCancel = vi.fn();
  return render(
    <NotificationProvider>
      <RegisterForm
        onRegisterSuccess={props.onRegisterSuccess ?? defaultOnRegisterSuccess}
        onCancel={props.onCancel ?? defaultOnCancel}
        {...props}
      />
    </NotificationProvider>
  );
};

describe('RegisterForm', () => {
  const mockOnRegisterSuccess = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock console methods
    console.log = mockConsoleLog;
    console.error = mockConsoleError;
    console.warn = mockConsoleWarn;
    
    // Default successful mock
    api.registerUser.mockResolvedValue({
      status: 'success',
      message: 'Registration successful',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Form Display', () => {
    it('should display all required form fields', () => {
      renderWithProviders({ onRegisterSuccess: mockOnRegisterSuccess, onCancel: mockOnCancel });

      expect(screen.getByRole('heading', { name: /create account/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/what should we call you/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/birthday/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toBeInTheDocument();
      expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument();
    });

    it('should have register and cancel buttons', () => {
      renderWithProviders({ onRegisterSuccess: mockOnRegisterSuccess, onCancel: mockOnCancel });

      expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });
  });

  describe('Form Input', () => {
    it('should allow user to type into all fields', async () => {
      renderWithProviders({ onRegisterSuccess: mockOnRegisterSuccess, onCancel: mockOnCancel });
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/full name/i), 'Test User Full Name');
      await user.type(screen.getByLabelText(/what should we call you/i), 'Test Preferred Name');
      await user.type(screen.getByLabelText(/birthday/i), '1990-01-01');
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.type(screen.getByLabelText('Confirm Password'), 'password123');

      expect(screen.getByLabelText(/username/i)).toHaveValue('testuser');
      expect(screen.getByLabelText(/full name/i)).toHaveValue('Test User Full Name');
      expect(screen.getByLabelText(/what should we call you/i)).toHaveValue('Test Preferred Name');
      expect(screen.getByLabelText(/birthday/i)).toHaveValue('1990-01-01');
      expect(screen.getByLabelText(/email/i)).toHaveValue('test@example.com');
      expect(screen.getByLabelText('Password')).toHaveValue('password123');
      expect(screen.getByLabelText('Confirm Password')).toHaveValue('password123');
    });
  });

  describe('Validation', () => {
    it('should show error when passwords do not match', async () => {
      renderWithProviders({ onRegisterSuccess: mockOnRegisterSuccess, onCancel: mockOnCancel });
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/full name/i), 'Test User');
      await user.type(screen.getByLabelText(/what should we call you/i), 'Test');
      await user.type(screen.getByLabelText(/birthday/i), '1990-01-01');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.type(screen.getByLabelText('Confirm Password'), 'differentpass');
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
      });
      expect(api.registerUser).not.toHaveBeenCalled();
    });

    it('should show error when password is too short', async () => {
      renderWithProviders({ onRegisterSuccess: mockOnRegisterSuccess, onCancel: mockOnCancel });
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/full name/i), 'Test User');
      await user.type(screen.getByLabelText(/what should we call you/i), 'Test');
      await user.type(screen.getByLabelText(/birthday/i), '1990-01-01');
      await user.type(screen.getByLabelText('Password'), 'short');
      await user.type(screen.getByLabelText('Confirm Password'), 'short');
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument();
      });
      expect(api.registerUser).not.toHaveBeenCalled();
    });

    it('should show error when full name is missing', async () => {
      const { container } = renderWithProviders({ onRegisterSuccess: mockOnRegisterSuccess, onCancel: mockOnCancel });
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/what should we call you/i), 'Test');
      await user.type(screen.getByLabelText(/birthday/i), '1990-01-01');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.type(screen.getByLabelText('Confirm Password'), 'password123');
      const form = container.querySelector('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText(/full name is required/i)).toBeInTheDocument();
      });
      expect(api.registerUser).not.toHaveBeenCalled();
    });

    it('should show error when preferred name is missing', async () => {
      const { container } = renderWithProviders({ onRegisterSuccess: mockOnRegisterSuccess, onCancel: mockOnCancel });
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/full name/i), 'Test User');
      await user.type(screen.getByLabelText(/birthday/i), '1990-01-01');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.type(screen.getByLabelText('Confirm Password'), 'password123');
      fireEvent.submit(container.querySelector('form'));

      await waitFor(() => {
        expect(screen.getByText(/preferred name is required/i)).toBeInTheDocument();
      });
      expect(api.registerUser).not.toHaveBeenCalled();
    });

    it('should show error when birthday is missing', async () => {
      const { container } = renderWithProviders({ onRegisterSuccess: mockOnRegisterSuccess, onCancel: mockOnCancel });
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/full name/i), 'Test User');
      await user.type(screen.getByLabelText(/what should we call you/i), 'Test');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.type(screen.getByLabelText('Confirm Password'), 'password123');
      fireEvent.submit(container.querySelector('form'));

      await waitFor(() => {
        expect(screen.getByText(/birthday is required/i)).toBeInTheDocument();
      });
      expect(api.registerUser).not.toHaveBeenCalled();
    });
  });

  describe('Successful Registration', () => {
    it('should call registerUser with all form data on successful submission', async () => {
      renderWithProviders({ onRegisterSuccess: mockOnRegisterSuccess, onCancel: mockOnCancel });
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/full name/i), 'Test User Full Name');
      await user.type(screen.getByLabelText(/what should we call you/i), 'Test Preferred Name');
      await user.type(screen.getByLabelText(/birthday/i), '1990-01-01');
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.type(screen.getByLabelText('Confirm Password'), 'password123');
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(api.registerUser).toHaveBeenCalledWith({
          username: 'testuser',
          password: 'password123',
          email: 'test@example.com',
          full_name: 'Test User Full Name',
          preferred_name: 'Test Preferred Name',
          birthday: '1990-01-01',
        });
      });
    });

    it('should call registerUser without email when email is not provided', async () => {
      renderWithProviders({ onRegisterSuccess: mockOnRegisterSuccess, onCancel: mockOnCancel });
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/full name/i), 'Test User Full Name');
      await user.type(screen.getByLabelText(/what should we call you/i), 'Test Preferred Name');
      await user.type(screen.getByLabelText(/birthday/i), '1990-01-01');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.type(screen.getByLabelText('Confirm Password'), 'password123');
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(api.registerUser).toHaveBeenCalledWith({
          username: 'testuser',
          password: 'password123',
          email: undefined,
          full_name: 'Test User Full Name',
          preferred_name: 'Test Preferred Name',
          birthday: '1990-01-01',
        });
      });
    });

    it('should call onRegisterSuccess with username on successful registration', async () => {
      renderWithProviders({ onRegisterSuccess: mockOnRegisterSuccess, onCancel: mockOnCancel });
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/full name/i), 'Test User Full Name');
      await user.type(screen.getByLabelText(/what should we call you/i), 'Test Preferred Name');
      await user.type(screen.getByLabelText(/birthday/i), '1990-01-01');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.type(screen.getByLabelText('Confirm Password'), 'password123');
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(mockOnRegisterSuccess).toHaveBeenCalledWith('testuser', 'password123');
      });
    });

    it('should trim whitespace from full_name and preferred_name', async () => {
      renderWithProviders({ onRegisterSuccess: mockOnRegisterSuccess, onCancel: mockOnCancel });
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/full name/i), '  Test User Full Name  ');
      await user.type(screen.getByLabelText(/what should we call you/i), '  Test Preferred Name  ');
      await user.type(screen.getByLabelText(/birthday/i), '1990-01-01');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.type(screen.getByLabelText('Confirm Password'), 'password123');
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(api.registerUser).toHaveBeenCalledWith(
          expect.objectContaining({
            full_name: 'Test User Full Name',
            preferred_name: 'Test Preferred Name',
          })
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message when registration fails', async () => {
      api.registerUser.mockRejectedValueOnce(new Error('Username already exists'));

      renderWithProviders({ onRegisterSuccess: mockOnRegisterSuccess, onCancel: mockOnCancel });
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/full name/i), 'Test User Full Name');
      await user.type(screen.getByLabelText(/what should we call you/i), 'Test Preferred Name');
      await user.type(screen.getByLabelText(/birthday/i), '1990-01-01');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.type(screen.getByLabelText('Confirm Password'), 'password123');
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(screen.getByText(/username already exists/i)).toBeInTheDocument();
      });
      expect(mockOnRegisterSuccess).not.toHaveBeenCalled();
    });

    it('should display error message from API response', async () => {
      api.registerUser.mockRejectedValueOnce({
        response: {
          status: 400,
          data: { message: 'Invalid email format' },
        },
        message: 'Request failed',
      });

      const { container } = renderWithProviders({ onRegisterSuccess: mockOnRegisterSuccess, onCancel: mockOnCancel });
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/full name/i), 'Test User Full Name');
      await user.type(screen.getByLabelText(/what should we call you/i), 'Test Preferred Name');
      await user.type(screen.getByLabelText(/birthday/i), '1990-01-01');
      await user.type(screen.getByLabelText(/email/i), 'invalid-email');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.type(screen.getByLabelText('Confirm Password'), 'password123');
      fireEvent.submit(container.querySelector('form'));

      await waitFor(() => {
        // Form shows err.message ('Request failed') or response message
        expect(screen.getByText(/invalid email format|request failed/i)).toBeInTheDocument();
      });
    });

    it('should display error when API returns non-success status', async () => {
      api.registerUser.mockResolvedValueOnce({
        status: 'error',
        message: 'Registration failed',
      });

      renderWithProviders({ onRegisterSuccess: mockOnRegisterSuccess, onCancel: mockOnCancel });
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/full name/i), 'Test User Full Name');
      await user.type(screen.getByLabelText(/what should we call you/i), 'Test Preferred Name');
      await user.type(screen.getByLabelText(/birthday/i), '1990-01-01');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.type(screen.getByLabelText('Confirm Password'), 'password123');
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(screen.getByText(/registration failed/i)).toBeInTheDocument();
      });
      expect(mockOnRegisterSuccess).not.toHaveBeenCalled();
    });
  });

  describe('Loading State', () => {
    it('should show loading state during registration', async () => {
      api.registerUser.mockImplementationOnce(() => new Promise(resolve => setTimeout(() => resolve({ status: 'success' }), 500)));

      renderWithProviders({ onRegisterSuccess: mockOnRegisterSuccess, onCancel: mockOnCancel });
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/full name/i), 'Test User Full Name');
      await user.type(screen.getByLabelText(/what should we call you/i), 'Test Preferred Name');
      await user.type(screen.getByLabelText(/birthday/i), '1990-01-01');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.type(screen.getByLabelText('Confirm Password'), 'password123');
      await user.click(screen.getByRole('button', { name: /create account/i }));

      expect(screen.getByRole('button', { name: /creating account/i })).toBeDisabled();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create account/i })).not.toBeDisabled();
      });
    });

    it('should disable submit button while loading', async () => {
      api.registerUser.mockImplementationOnce(() => new Promise(resolve => setTimeout(() => resolve({ status: 'success' }), 500)));

      renderWithProviders({ onRegisterSuccess: mockOnRegisterSuccess, onCancel: mockOnCancel });
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/full name/i), 'Test User Full Name');
      await user.type(screen.getByLabelText(/what should we call you/i), 'Test Preferred Name');
      await user.type(screen.getByLabelText(/birthday/i), '1990-01-01');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.type(screen.getByLabelText('Confirm Password'), 'password123');
      await user.click(screen.getByRole('button', { name: /create account/i }));

      const submitButton = screen.getByRole('button', { name: /creating account/i });
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Cancel Functionality', () => {
    it('should call onCancel when cancel button is clicked', async () => {
      renderWithProviders({ onRegisterSuccess: mockOnRegisterSuccess, onCancel: mockOnCancel });
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: /cancel/i }));

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('Logging', () => {
    it('should log form submission', async () => {
      renderWithProviders({ onRegisterSuccess: mockOnRegisterSuccess, onCancel: mockOnCancel });
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/full name/i), 'Test User Full Name');
      await user.type(screen.getByLabelText(/what should we call you/i), 'Test Preferred Name');
      await user.type(screen.getByLabelText(/birthday/i), '1990-01-01');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.type(screen.getByLabelText('Confirm Password'), 'password123');
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(mockConsoleLog).toHaveBeenCalledWith('[REGISTER FORM] ========== REGISTRATION FORM SUBMITTED ==========');
      });
    });

    it('should log validation failures', async () => {
      const { container } = renderWithProviders({ onRegisterSuccess: mockOnRegisterSuccess, onCancel: mockOnCancel });
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.type(screen.getByLabelText('Confirm Password'), 'differentpass');
      fireEvent.submit(container.querySelector('form'));

      await waitFor(() => {
        expect(mockConsoleWarn).toHaveBeenCalledWith(expect.stringContaining('[REGISTER FORM] Password validation failed:'));
      });
    });

    it('should log successful registration', async () => {
      renderWithProviders({ onRegisterSuccess: mockOnRegisterSuccess, onCancel: mockOnCancel });
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/full name/i), 'Test User Full Name');
      await user.type(screen.getByLabelText(/what should we call you/i), 'Test Preferred Name');
      await user.type(screen.getByLabelText(/birthday/i), '1990-01-01');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.type(screen.getByLabelText('Confirm Password'), 'password123');
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('[REGISTER FORM] ========== REGISTRATION COMPLETE =========='));
      });
    });

    it('should log registration errors', async () => {
      api.registerUser.mockRejectedValueOnce(new Error('Registration failed'));

      renderWithProviders({ onRegisterSuccess: mockOnRegisterSuccess, onCancel: mockOnCancel });
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/full name/i), 'Test User Full Name');
      await user.type(screen.getByLabelText(/what should we call you/i), 'Test Preferred Name');
      await user.type(screen.getByLabelText(/birthday/i), '1990-01-01');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.type(screen.getByLabelText('Confirm Password'), 'password123');
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(mockConsoleError).toHaveBeenCalledWith('[REGISTER FORM] ========== REGISTRATION ERROR ==========');
      });
    });
  });
});


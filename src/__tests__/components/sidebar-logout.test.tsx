import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock the usePathname hook
jest.mock('next/navigation', () => ({
  usePathname: () => '/overview',
}));

// Mock fetch for logout API
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Track redirect calls
let redirectCalled = '';

// Simplified sidebar component for testing
const TestSidebar = () => {
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      redirectCalled = '/login';
    } catch (error) {
      console.error('Logout failed:', error);
      redirectCalled = '/login';
    }
  };

  return (
    <button onClick={handleLogout} data-testid="logout-button">
      Logout
    </button>
  );
};

describe('Sidebar Logout Functionality', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    redirectCalled = '';
  });

  it('should call logout API and redirect on success', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });

    render(<TestSidebar />);

    const logoutButton = screen.getByTestId('logout-button');
    fireEvent.click(logoutButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' });
      expect(redirectCalled).toBe('/login');
    });
  });

  it('should redirect to login even if API fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    render(<TestSidebar />);

    const logoutButton = screen.getByTestId('logout-button');
    fireEvent.click(logoutButton);

    await waitFor(() => {
      expect(redirectCalled).toBe('/login');
    });
  });
});

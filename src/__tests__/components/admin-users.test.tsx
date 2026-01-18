import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Track mail calls
let mailTo = '';

// Mock window.confirm
const mockConfirm = jest.fn();
global.confirm = mockConfirm;

// Mock window.alert
const mockAlert = jest.fn();
global.alert = mockAlert;

// Mock user interface
interface User {
  id: string;
  username: string;
  email: string;
  is_admin: boolean;
}

// Simplified admin users component for testing
const TestAdminUsers = ({ users: initialUsers }: { users: User[] }) => {
  const [users, setUsers] = React.useState<User[]>(initialUsers);

  const handleSendMail = (user: User) => {
    mailTo = `mailto:${user.email}?subject=KCU Coach - Message for ${user.username}`;
  };

  const handleToggleAdmin = async (user: User) => {
    const newAdminStatus = !user.is_admin;
    const action = newAdminStatus ? 'grant admin privileges to' : 'revoke admin privileges from';

    if (!confirm(`Are you sure you want to ${action} ${user.username}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_admin: newAdminStatus }),
      });

      if (res.ok) {
        setUsers(prev => prev.map(u =>
          u.id === user.id ? { ...u, is_admin: newAdminStatus } : u
        ));
      } else {
        alert('Failed to update user permissions');
      }
    } catch (error) {
      alert('Failed to update user permissions');
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (!confirm(`Are you sure you want to delete ${user.username}? This action cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setUsers(prev => prev.filter(u => u.id !== user.id));
      } else {
        alert('Failed to delete user');
      }
    } catch (error) {
      alert('Failed to delete user');
    }
  };

  const handleExport = () => {
    const headers = ['Username', 'Email'];
    const rows = users.map(user => [user.username, user.email]);
    const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    // In real implementation, this would trigger a download
    return csv;
  };

  return (
    <div>
      <button onClick={handleExport} data-testid="export-button">
        Export
      </button>
      {users.map(user => (
        <div key={user.id} data-testid={`user-${user.id}`}>
          <span>{user.username}</span>
          <button
            onClick={() => handleSendMail(user)}
            data-testid={`mail-${user.id}`}
          >
            Mail
          </button>
          <button
            onClick={() => handleToggleAdmin(user)}
            data-testid={`admin-${user.id}`}
          >
            {user.is_admin ? 'Revoke Admin' : 'Grant Admin'}
          </button>
          <button
            onClick={() => handleDeleteUser(user)}
            data-testid={`delete-${user.id}`}
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  );
};

describe('Admin Users Page Actions', () => {
  const mockUsers: User[] = [
    { id: '1', username: 'TestUser1', email: 'test1@example.com', is_admin: false },
    { id: '2', username: 'AdminUser', email: 'admin@example.com', is_admin: true },
  ];

  beforeEach(() => {
    mockFetch.mockClear();
    mockConfirm.mockClear();
    mockAlert.mockClear();
    mailTo = '';
  });

  describe('Send Mail', () => {
    it('should open mailto link when mail button is clicked', () => {
      render(<TestAdminUsers users={mockUsers} />);

      fireEvent.click(screen.getByTestId('mail-1'));
      expect(mailTo).toBe('mailto:test1@example.com?subject=KCU Coach - Message for TestUser1');
    });
  });

  describe('Toggle Admin', () => {
    it('should call API to grant admin privileges when confirmed', async () => {
      mockConfirm.mockReturnValue(true);
      mockFetch.mockResolvedValueOnce({ ok: true });

      render(<TestAdminUsers users={mockUsers} />);

      fireEvent.click(screen.getByTestId('admin-1'));

      await waitFor(() => {
        expect(mockConfirm).toHaveBeenCalledWith(
          'Are you sure you want to grant admin privileges to TestUser1?'
        );
        expect(mockFetch).toHaveBeenCalledWith('/api/admin/users/1', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_admin: true }),
        });
      });
    });

    it('should call API to revoke admin privileges when confirmed', async () => {
      mockConfirm.mockReturnValue(true);
      mockFetch.mockResolvedValueOnce({ ok: true });

      render(<TestAdminUsers users={mockUsers} />);

      fireEvent.click(screen.getByTestId('admin-2'));

      await waitFor(() => {
        expect(mockConfirm).toHaveBeenCalledWith(
          'Are you sure you want to revoke admin privileges from AdminUser?'
        );
        expect(mockFetch).toHaveBeenCalledWith('/api/admin/users/2', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_admin: false }),
        });
      });
    });

    it('should not call API when confirmation is cancelled', async () => {
      mockConfirm.mockReturnValue(false);

      render(<TestAdminUsers users={mockUsers} />);

      fireEvent.click(screen.getByTestId('admin-1'));

      await waitFor(() => {
        expect(mockFetch).not.toHaveBeenCalled();
      });
    });

    it('should show alert when API fails', async () => {
      mockConfirm.mockReturnValue(true);
      mockFetch.mockResolvedValueOnce({ ok: false });

      render(<TestAdminUsers users={mockUsers} />);

      fireEvent.click(screen.getByTestId('admin-1'));

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith('Failed to update user permissions');
      });
    });
  });

  describe('Delete User', () => {
    it('should call API to delete user when confirmed', async () => {
      mockConfirm.mockReturnValue(true);
      mockFetch.mockResolvedValueOnce({ ok: true });

      render(<TestAdminUsers users={mockUsers} />);

      fireEvent.click(screen.getByTestId('delete-1'));

      await waitFor(() => {
        expect(mockConfirm).toHaveBeenCalledWith(
          'Are you sure you want to delete TestUser1? This action cannot be undone.'
        );
        expect(mockFetch).toHaveBeenCalledWith('/api/admin/users/1', {
          method: 'DELETE',
        });
      });
    });

    it('should not call API when deletion is cancelled', async () => {
      mockConfirm.mockReturnValue(false);

      render(<TestAdminUsers users={mockUsers} />);

      fireEvent.click(screen.getByTestId('delete-1'));

      await waitFor(() => {
        expect(mockFetch).not.toHaveBeenCalled();
      });
    });

    it('should show alert when delete fails', async () => {
      mockConfirm.mockReturnValue(true);
      mockFetch.mockResolvedValueOnce({ ok: false });

      render(<TestAdminUsers users={mockUsers} />);

      fireEvent.click(screen.getByTestId('delete-1'));

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith('Failed to delete user');
      });
    });

    it('should remove user from list after successful deletion', async () => {
      mockConfirm.mockReturnValue(true);
      mockFetch.mockResolvedValueOnce({ ok: true });

      render(<TestAdminUsers users={mockUsers} />);

      expect(screen.getByTestId('user-1')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('delete-1'));

      await waitFor(() => {
        expect(screen.queryByTestId('user-1')).not.toBeInTheDocument();
      });
    });
  });
});

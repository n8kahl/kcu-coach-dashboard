'use client';

import { useState, useCallback, useEffect } from 'react';
import { Header } from '@/components/layout/header';
import { PageShell, PageSection } from '@/components/layout/page-shell';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Stat, StatGrid } from '@/components/ui/stat';
import { useToast } from '@/components/ui/toast';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { formatDateTime, formatNumber } from '@/lib/utils';
import {
  Search,
  Filter,
  Download,
  Users,
  UserCheck,
  TrendingUp,
  BookOpen,
  Mail,
  Shield,
  Trash2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface User {
  id: string;
  username: string;
  discord_id: string;
  discord_username?: string;
  email: string | null;
  avatar_url: string | null;
  experience_level: string;
  subscription_tier: string;
  is_admin: boolean;
  streak_days: number;
  total_quizzes: number;
  total_questions: number;
  current_module: string;
  created_at: string;
  updated_at: string;
  disabled_at: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface Stats {
  totalUsers: number;
  activeToday: number;
}

export default function UsersPage() {
  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    activeToday: 0,
  });

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch users from API
  const fetchUsers = useCallback(async (page = 1, search = '') => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
        ...(search && { search }),
      });

      const res = await fetch(`/api/admin/users?${params}`);
      if (!res.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await res.json();
      setUsers(data.users);
      setPagination(data.pagination);
      if (data.stats) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      showToast({
        type: 'error',
        title: 'Failed to Load Users',
        message: 'Could not fetch user list. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // Initial fetch and refetch on search/page change
  useEffect(() => {
    fetchUsers(pagination.page, debouncedSearch);
  }, [debouncedSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle page change
  const handlePageChange = useCallback((newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
    fetchUsers(newPage, debouncedSearch);
  }, [fetchUsers, debouncedSearch]);

  // Export users to CSV
  const handleExport = useCallback(() => {
    const headers = ['Username', 'Email', 'Level', 'Questions', 'Quizzes', 'Streak', 'Joined', 'Last Active'];
    const rows = users.map(user => [
      user.username,
      user.email || '',
      user.experience_level,
      user.total_questions.toString(),
      user.total_quizzes.toString(),
      user.streak_days.toString(),
      new Date(user.created_at).toLocaleDateString(),
      new Date(user.updated_at).toLocaleDateString(),
    ]);

    const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [users]);

  // Send message to user (opens mailto)
  const handleSendMail = useCallback((user: User) => {
    if (!user.email) {
      showToast({
        type: 'warning',
        title: 'No Email',
        message: 'This user has no email address on file.',
      });
      return;
    }
    window.location.href = `mailto:${user.email}?subject=KCU Coach - Message for ${user.username}`;
  }, [showToast]);

  // Toggle admin status
  const handleToggleAdmin = useCallback(async (user: User) => {
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
        showToast({
          type: 'success',
          title: 'Permissions Updated',
          message: `${newAdminStatus ? 'Granted' : 'Revoked'} admin privileges for ${user.username}`,
        });
      } else {
        const error = await res.json();
        showToast({
          type: 'error',
          title: 'Update Failed',
          message: error.error || 'Failed to update user permissions',
        });
      }
    } catch (error) {
      console.error('Error updating user:', error);
      showToast({
        type: 'error',
        title: 'Update Failed',
        message: 'Failed to update user permissions',
      });
    }
  }, [showToast]);

  // Delete user (soft delete)
  const handleDeleteUser = useCallback(async (user: User) => {
    if (!confirm(`Are you sure you want to disable ${user.username}? This user will no longer be able to access the platform.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setUsers(prev => prev.filter(u => u.id !== user.id));
        showToast({
          type: 'success',
          title: 'User Disabled',
          message: `${user.username} has been disabled`,
        });
      } else {
        const error = await res.json();
        showToast({
          type: 'error',
          title: 'Delete Failed',
          message: error.error || 'Failed to disable user',
        });
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      showToast({
        type: 'error',
        title: 'Delete Failed',
        message: 'Failed to disable user',
      });
    }
  }, [showToast]);

  return (
    <>
      <Header
        title="Users"
        subtitle="Manage Discord users and their progress"
        breadcrumbs={[{ label: 'Admin' }, { label: 'Users' }]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              icon={<RefreshCw className="w-4 h-4" />}
              onClick={() => fetchUsers(pagination.page, debouncedSearch)}
              disabled={loading}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Download className="w-4 h-4" />}
              onClick={handleExport}
              disabled={users.length === 0}
            >
              Export
            </Button>
          </div>
        }
      />

      <PageShell>
        {/* Stats */}
        <PageSection>
          <StatGrid columns={4}>
            <Card padding="md">
              <Stat
                label="Total Users"
                value={formatNumber(stats.totalUsers)}
                icon={<Users className="w-4 h-4" />}
              />
            </Card>
            <Card padding="md">
              <Stat
                label="Active Today"
                value={formatNumber(stats.activeToday)}
                icon={<UserCheck className="w-4 h-4" />}
                valueColor="profit"
              />
            </Card>
            <Card padding="md">
              <Stat
                label="Total Questions"
                value={formatNumber(users.reduce((sum, u) => sum + (u.total_questions || 0), 0))}
                icon={<TrendingUp className="w-4 h-4" />}
              />
            </Card>
            <Card padding="md">
              <Stat
                label="Total Quizzes"
                value={formatNumber(users.reduce((sum, u) => sum + (u.total_quizzes || 0), 0))}
                icon={<BookOpen className="w-4 h-4" />}
              />
            </Card>
          </StatGrid>
        </PageSection>

        {/* Users Table */}
        <PageSection>
          <Card>
            <CardHeader
              title={`All Users ${pagination.total > 0 ? `(${pagination.total})` : ''}`}
              action={
                <div className="flex items-center gap-3">
                  <div className="w-64">
                    <Input
                      placeholder="Search users..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      leftIcon={<Search className="w-4 h-4" />}
                    />
                  </div>
                </div>
              }
            />

            {loading && users.length === 0 ? (
              <CardContent>
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-6 h-6 animate-spin text-[var(--text-tertiary)]" />
                  <span className="ml-2 text-[var(--text-secondary)]">Loading users...</span>
                </div>
              </CardContent>
            ) : users.length === 0 ? (
              <CardContent>
                <div className="flex flex-col items-center justify-center py-12">
                  <Users className="w-12 h-12 text-[var(--text-tertiary)] mb-4" />
                  <p className="text-[var(--text-secondary)]">
                    {debouncedSearch ? 'No users match your search' : 'No users found'}
                  </p>
                </div>
              </CardContent>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow hoverable={false}>
                      <TableHead>User</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead>Questions</TableHead>
                      <TableHead>Quizzes</TableHead>
                      <TableHead>Streak</TableHead>
                      <TableHead>Last Active</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar
                              src={user.avatar_url || undefined}
                              alt={user.username}
                              fallback={user.username}
                              size="sm"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-[var(--text-primary)]">
                                  {user.username}
                                </p>
                                {user.is_admin && (
                                  <Badge variant="gold" size="sm">Admin</Badge>
                                )}
                              </div>
                              <p className="text-xs text-[var(--text-tertiary)]">
                                {user.email || user.discord_username || user.discord_id}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              user.experience_level === 'advanced'
                                ? 'gold'
                                : user.experience_level === 'intermediate'
                                ? 'success'
                                : 'default'
                            }
                            size="sm"
                          >
                            {user.experience_level || 'beginner'}
                          </Badge>
                        </TableCell>
                        <TableCell mono>{user.total_questions || 0}</TableCell>
                        <TableCell mono>{user.total_quizzes || 0}</TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1 text-[var(--accent-primary)]">
                            {user.streak_days > 0 && '🔥'} {user.streak_days || 0}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-[var(--text-tertiary)]">
                            {formatDateTime(user.updated_at)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <button
                              className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                              onClick={() => handleSendMail(user)}
                              title={user.email ? `Send email to ${user.username}` : 'No email available'}
                            >
                              <Mail className="w-4 h-4" />
                            </button>
                            <button
                              className={`p-1.5 hover:text-[var(--accent-primary)] ${
                                user.is_admin
                                  ? 'text-[var(--accent-primary)]'
                                  : 'text-[var(--text-tertiary)]'
                              }`}
                              onClick={() => handleToggleAdmin(user)}
                              title={user.is_admin ? 'Revoke admin' : 'Grant admin'}
                            >
                              <Shield className="w-4 h-4" />
                            </button>
                            <button
                              className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--error)]"
                              onClick={() => handleDeleteUser(user)}
                              title={`Disable ${user.username}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border-primary)]">
                    <p className="text-sm text-[var(--text-secondary)]">
                      Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                      {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                      {pagination.total} users
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<ChevronLeft className="w-4 h-4" />}
                        onClick={() => handlePageChange(pagination.page - 1)}
                        disabled={pagination.page === 1 || loading}
                      >
                        Previous
                      </Button>
                      <span className="text-sm text-[var(--text-secondary)]">
                        Page {pagination.page} of {pagination.totalPages}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePageChange(pagination.page + 1)}
                        disabled={pagination.page >= pagination.totalPages || loading}
                      >
                        Next
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>
        </PageSection>
      </PageShell>
    </>
  );
}

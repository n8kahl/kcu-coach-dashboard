'use client';

import { useState, useCallback } from 'react';
import { Header } from '@/components/layout/header';
import { PageShell, PageSection } from '@/components/layout/page-shell';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Stat, StatGrid } from '@/components/ui/stat';
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
  MoreVertical,
  Mail,
  Shield,
  Trash2,
} from 'lucide-react';

interface User {
  id: string;
  username: string;
  discord_id: string;
  email: string;
  experience_level: string;
  total_questions_asked: number;
  total_quizzes_taken: number;
  current_streak: number;
  joined_at: string;
  last_active: string;
  is_admin: boolean;
}

// Mock user data
const mockUsers = [
  {
    id: '1',
    username: 'PrinterKing',
    discord_id: '123456789',
    email: 'printer@example.com',
    experience_level: 'advanced',
    total_questions_asked: 234,
    total_quizzes_taken: 45,
    current_streak: 8,
    joined_at: '2023-11-15T10:00:00Z',
    last_active: '2024-01-16T09:30:00Z',
    is_admin: false,
  },
  {
    id: '2',
    username: 'LTPMaster',
    discord_id: '987654321',
    email: 'ltp@example.com',
    experience_level: 'intermediate',
    total_questions_asked: 156,
    total_quizzes_taken: 32,
    current_streak: 5,
    joined_at: '2023-12-01T14:00:00Z',
    last_active: '2024-01-16T08:15:00Z',
    is_admin: false,
  },
  {
    id: '3',
    username: 'TraderJoe',
    discord_id: '456789123',
    email: 'joe@example.com',
    experience_level: 'beginner',
    total_questions_asked: 89,
    total_quizzes_taken: 18,
    current_streak: 3,
    joined_at: '2024-01-01T09:00:00Z',
    last_active: '2024-01-16T10:45:00Z',
    is_admin: false,
  },
];

export default function UsersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  const filteredUsers = users.filter((user) =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Export users to CSV
  const handleExport = useCallback(() => {
    const headers = ['Username', 'Email', 'Level', 'Questions', 'Quizzes', 'Streak', 'Joined', 'Last Active'];
    const rows = filteredUsers.map(user => [
      user.username,
      user.email,
      user.experience_level,
      user.total_questions_asked.toString(),
      user.total_quizzes_taken.toString(),
      user.current_streak.toString(),
      new Date(user.joined_at).toLocaleDateString(),
      new Date(user.last_active).toLocaleDateString(),
    ]);

    const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredUsers]);

  // Send message to user (opens mailto)
  const handleSendMail = useCallback((user: User) => {
    window.location.href = `mailto:${user.email}?subject=KCU Coach - Message for ${user.username}`;
  }, []);

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
      } else {
        alert('Failed to update user permissions');
      }
    } catch (error) {
      console.error('Error updating user:', error);
      alert('Failed to update user permissions');
    }
  }, []);

  // Delete user
  const handleDeleteUser = useCallback(async (user: User) => {
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
      console.error('Error deleting user:', error);
      alert('Failed to delete user');
    }
  }, []);

  return (
    <>
      <Header
        title="Users"
        subtitle="Manage Discord users and their progress"
        breadcrumbs={[{ label: 'Admin' }, { label: 'Users' }]}
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={<Download className="w-4 h-4" />}
            onClick={handleExport}
          >
            Export
          </Button>
        }
      />

      <PageShell>
        {/* Stats */}
        <PageSection>
          <StatGrid columns={4}>
            <Card padding="md">
              <Stat
                label="Total Users"
                value={formatNumber(1247)}
                icon={<Users className="w-4 h-4" />}
              />
            </Card>
            <Card padding="md">
              <Stat
                label="Active Today"
                value={formatNumber(89)}
                icon={<UserCheck className="w-4 h-4" />}
                valueColor="profit"
              />
            </Card>
            <Card padding="md">
              <Stat
                label="Questions Today"
                value={formatNumber(342)}
                icon={<TrendingUp className="w-4 h-4" />}
              />
            </Card>
            <Card padding="md">
              <Stat
                label="Quizzes Today"
                value={formatNumber(67)}
                icon={<BookOpen className="w-4 h-4" />}
              />
            </Card>
          </StatGrid>
        </PageSection>

        {/* Users Table */}
        <PageSection>
          <Card>
            <CardHeader
              title="All Users"
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
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Filter className="w-4 h-4" />}
                    onClick={() => setShowFilterMenu(!showFilterMenu)}
                  >
                    Filter
                  </Button>
                </div>
              }
            />
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
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar
                          alt={user.username}
                          fallback={user.username}
                          size="sm"
                        />
                        <div>
                          <p className="font-medium text-[var(--text-primary)]">
                            {user.username}
                          </p>
                          <p className="text-xs text-[var(--text-tertiary)]">
                            {user.email}
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
                        {user.experience_level}
                      </Badge>
                    </TableCell>
                    <TableCell mono>{user.total_questions_asked}</TableCell>
                    <TableCell mono>{user.total_quizzes_taken}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1 text-[var(--accent-primary)]">
                        🔥 {user.current_streak}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-[var(--text-tertiary)]">
                        {formatDateTime(user.last_active)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <button
                          className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                          onClick={() => handleSendMail(user)}
                          title={`Send email to ${user.username}`}
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
                          title={`Delete ${user.username}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </PageSection>
      </PageShell>
    </>
  );
}

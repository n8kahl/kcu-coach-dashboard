'use client';

import { useState } from 'react';
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

  const filteredUsers = mockUsers.filter((user) =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <Header
        title="Users"
        subtitle="Manage Discord users and their progress"
        breadcrumbs={[{ label: 'Admin' }, { label: 'Users' }]}
        actions={
          <Button variant="primary" size="sm" icon={<Download className="w-4 h-4" />}>
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
                  <Button variant="ghost" size="sm" icon={<Filter className="w-4 h-4" />}>
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
                        <button className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
                          <Mail className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--accent-primary)]">
                          <Shield className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--error)]">
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

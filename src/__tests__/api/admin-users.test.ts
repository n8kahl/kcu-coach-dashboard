/**
 * Tests for Admin User Management API
 *
 * Verifies:
 * - Admin-only access (non-admin gets 403)
 * - GET /api/admin/users returns paginated users
 * - PATCH /api/admin/users/:id updates user fields
 * - DELETE /api/admin/users/:id soft-deletes users
 * - Self-protection (can't remove own admin or delete self)
 */

// Mock next/server before imports
jest.mock('next/server', () => {
  class MockNextResponse {
    body: string;
    status: number;
    statusText: string;
    headers: Map<string, string>;

    constructor(body: unknown, init?: { status?: number; statusText?: string; headers?: Record<string, string> }) {
      this.body = typeof body === 'string' ? body : JSON.stringify(body);
      this.status = init?.status || 200;
      this.statusText = init?.statusText || 'OK';
      this.headers = new Map();
      if (init?.headers) {
        Object.entries(init.headers).forEach(([k, v]) => this.headers.set(k, v));
      }
    }

    async json() {
      return JSON.parse(this.body);
    }

    static json(data: unknown, init?: { status?: number }) {
      const headers = new Map<string, string>();
      return {
        body: JSON.stringify(data),
        status: init?.status || 200,
        statusText: 'OK',
        headers: {
          get: (key: string) => headers.get(key),
          set: (key: string, value: string) => headers.set(key, value),
          forEach: (callback: (value: string, key: string) => void) => headers.forEach(callback),
        },
        json: async () => data,
      };
    }
  }

  return {
    NextRequest: jest.fn(),
    NextResponse: MockNextResponse,
  };
});

// Mock auth module
const mockGetSession = jest.fn();
jest.mock('@/lib/auth', () => ({
  getSession: () => mockGetSession(),
}));

// Mock Supabase - using a flexible chainable mock
const mockSupabaseResult = jest.fn();

// Create a chainable mock that returns itself for any method call
function createChainableMock(): Record<string, jest.Mock> {
  const chainable: Record<string, jest.Mock> = {};
  const methods = ['select', 'insert', 'update', 'delete', 'eq', 'is', 'or', 'order', 'range', 'gte', 'single', 'limit'];

  methods.forEach(method => {
    chainable[method] = jest.fn().mockImplementation(() => {
      if (method === 'single') {
        return mockSupabaseResult();
      }
      return chainable;
    });
  });

  // Override for returning data directly (for queries without .single())
  chainable.range = jest.fn().mockImplementation(() => mockSupabaseResult());

  return chainable;
}

const mockChain = createChainableMock();

jest.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn().mockImplementation(() => mockChain),
  },
}));

// Helper to create mock request
function createMockRequest(options: {
  url?: string;
  method?: string;
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
}) {
  const url = options.url || 'http://localhost/api/admin/users';
  const headerMap = new Map(Object.entries(options.headers || {}));

  return {
    url,
    method: options.method || 'GET',
    headers: {
      get: (key: string) => headerMap.get(key),
      set: (key: string, value: string) => headerMap.set(key, value),
    },
    json: async () => options.body || {},
    nextUrl: { searchParams: new URLSearchParams(url.split('?')[1] || '') },
  };
}

describe('Admin Users API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication & Authorization', () => {
    it('should return 401 when not authenticated', async () => {
      mockGetSession.mockResolvedValue({ user: null });

      // Import dynamically to get fresh module with mocks
      const { GET } = await import('@/app/api/admin/users/route');
      const request = createMockRequest({ url: 'http://localhost/api/admin/users' });

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 when user is not admin', async () => {
      mockGetSession.mockResolvedValue({
        userId: 'user-123',
        isAdmin: false,
      });

      const { GET } = await import('@/app/api/admin/users/route');
      const request = createMockRequest({ url: 'http://localhost/api/admin/users' });

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
    });

    it('should allow access for admin users', async () => {
      mockGetSession.mockResolvedValue({
        userId: 'admin-123',
        isAdmin: true,
      });

      // Mock successful database query
      mockSupabaseResult.mockResolvedValue({
        data: [],
        count: 0,
        error: null,
      });

      const { GET } = await import('@/app/api/admin/users/route');
      const request = createMockRequest({ url: 'http://localhost/api/admin/users' });

      const response = await GET(request as any);

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/admin/users', () => {
    beforeEach(() => {
      mockGetSession.mockResolvedValue({
        userId: 'admin-123',
        isAdmin: true,
      });
    });

    it('should return paginated users', async () => {
      const mockUsers = [
        { id: '1', username: 'user1', email: 'user1@test.com' },
        { id: '2', username: 'user2', email: 'user2@test.com' },
      ];

      mockSupabaseResult.mockResolvedValue({
        data: mockUsers,
        count: 2,
        error: null,
      });

      const { GET } = await import('@/app/api/admin/users/route');
      const request = createMockRequest({ url: 'http://localhost/api/admin/users?page=1&limit=50' });

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.users).toBeDefined();
      expect(data.pagination).toBeDefined();
    });

    it('should filter users by search query', async () => {
      mockSupabaseResult.mockResolvedValue({
        data: [{ id: '1', username: 'testuser', email: 'test@test.com' }],
        count: 1,
        error: null,
      });

      const { GET } = await import('@/app/api/admin/users/route');
      const request = createMockRequest({
        url: 'http://localhost/api/admin/users?search=testuser',
      });

      const response = await GET(request as any);

      expect(response.status).toBe(200);
      // Verify search filter was applied
      expect(mockChain.or).toHaveBeenCalled();
    });
  });

  describe('PATCH /api/admin/users/:id', () => {
    beforeEach(() => {
      mockGetSession.mockResolvedValue({
        userId: 'admin-123',
        isAdmin: true,
      });
    });

    it('should update user admin status', async () => {
      const currentUser = { id: 'user-456', username: 'testuser', is_admin: false };
      const updatedUser = { ...currentUser, is_admin: true };

      // First call: get current user
      mockSupabaseResult
        .mockResolvedValueOnce({ data: currentUser, error: null })
        // Second call: update result
        .mockResolvedValueOnce({ data: updatedUser, error: null });

      const { PATCH } = await import('@/app/api/admin/users/[id]/route');
      const request = createMockRequest({
        method: 'PATCH',
        url: 'http://localhost/api/admin/users/user-456',
        body: { is_admin: true },
      });

      const response = await PATCH(request as any, { params: Promise.resolve({ id: 'user-456' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should prevent admin from removing own admin status', async () => {
      mockGetSession.mockResolvedValue({
        userId: 'admin-123',
        isAdmin: true,
      });

      const { PATCH } = await import('@/app/api/admin/users/[id]/route');
      const request = createMockRequest({
        method: 'PATCH',
        url: 'http://localhost/api/admin/users/admin-123',
        body: { is_admin: false },
      });

      const response = await PATCH(request as any, { params: Promise.resolve({ id: 'admin-123' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Cannot remove your own admin privileges');
    });

    it('should reject updates with no valid fields', async () => {
      const { PATCH } = await import('@/app/api/admin/users/[id]/route');
      const request = createMockRequest({
        method: 'PATCH',
        url: 'http://localhost/api/admin/users/user-456',
        body: { invalid_field: 'value' },
      });

      const response = await PATCH(request as any, { params: Promise.resolve({ id: 'user-456' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('No valid fields to update');
    });
  });

  describe('DELETE /api/admin/users/:id', () => {
    beforeEach(() => {
      mockGetSession.mockResolvedValue({
        userId: 'admin-123',
        isAdmin: true,
      });
    });

    it('should soft-delete a user', async () => {
      const currentUser = { id: 'user-456', username: 'testuser', disabled_at: null };
      const disabledUser = { ...currentUser, disabled_at: new Date().toISOString() };

      mockSupabaseResult
        .mockResolvedValueOnce({ data: currentUser, error: null })
        .mockResolvedValueOnce({ data: disabledUser, error: null });

      const { DELETE } = await import('@/app/api/admin/users/[id]/route');
      const request = createMockRequest({
        method: 'DELETE',
        url: 'http://localhost/api/admin/users/user-456',
      });

      const response = await DELETE(request as any, { params: Promise.resolve({ id: 'user-456' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should prevent admin from deleting themselves', async () => {
      const { DELETE } = await import('@/app/api/admin/users/[id]/route');
      const request = createMockRequest({
        method: 'DELETE',
        url: 'http://localhost/api/admin/users/admin-123',
      });

      const response = await DELETE(request as any, { params: Promise.resolve({ id: 'admin-123' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Cannot delete your own account');
    });

    it('should return 400 if user is already disabled', async () => {
      const disabledUser = {
        id: 'user-456',
        username: 'testuser',
        disabled_at: new Date().toISOString(),
      };

      mockSupabaseResult.mockResolvedValueOnce({ data: disabledUser, error: null });

      const { DELETE } = await import('@/app/api/admin/users/[id]/route');
      const request = createMockRequest({
        method: 'DELETE',
        url: 'http://localhost/api/admin/users/user-456',
      });

      const response = await DELETE(request as any, { params: Promise.resolve({ id: 'user-456' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('User is already disabled');
    });
  });
});

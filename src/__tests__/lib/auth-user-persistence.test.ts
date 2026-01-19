/**
 * Tests for user persistence across logins
 *
 * Verifies that:
 * 1. The same userId persists across multiple logins
 * 2. No duplicate rows are created
 * 3. User data is never deleted on login
 */

// Mock all dependencies BEFORE importing the module under test
jest.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn(),
  },
}));

jest.mock('@/lib/jwt', () => ({
  createSessionToken: jest.fn(),
  verifySessionToken: jest.fn(),
  shouldRefreshSession: jest.fn(),
  refreshSessionToken: jest.fn(),
}));

jest.mock('next/headers', () => ({
  cookies: jest.fn().mockResolvedValue({
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  }),
}));

// Now import after mocks are set up
import { supabaseAdmin } from '@/lib/supabase';
import {
  findOrCreateUserInUsersTable,
  upsertUserProfile,
  type DiscordUserData,
} from '@/lib/auth';

describe('User Persistence Across Logins', () => {
  const mockDiscordId = '123456789012345678';
  const mockUsername = 'testuser';
  const mockEmail = 'test@example.com';
  const mockUserId = 'existing-user-uuid-1234';
  const newUserId = 'new-user-uuid-5678';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findOrCreateUserInUsersTable', () => {
    it('should return existing userId when user already exists', async () => {
      // Setup: Mock existing user in database
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: mockUserId },
          error: null,
        }),
      };

      (supabaseAdmin.from as jest.Mock).mockReturnValue(mockChain);

      // Execute
      const result = await findOrCreateUserInUsersTable(
        mockDiscordId,
        newUserId,
        { username: mockUsername, email: mockEmail }
      );

      // Verify: Returns existing user ID, not new one
      expect(result.userId).toBe(mockUserId);
      expect(result.isNew).toBe(false);

      // Verify: Correct table was queried
      expect(supabaseAdmin.from).toHaveBeenCalledWith('users');
      expect(mockChain.select).toHaveBeenCalledWith('id');
    });

    it('should create new user when user does not exist', async () => {
      // Setup: Mock no existing user, then successful insert
      let callCount = 0;
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            // First call: user lookup returns not found
            return Promise.resolve({
              data: null,
              error: { code: 'PGRST116', message: 'No rows found' },
            });
          }
          // Second call: insert returns created user
          return Promise.resolve({
            data: { id: newUserId },
            error: null,
          });
        }),
      };

      (supabaseAdmin.from as jest.Mock).mockReturnValue(mockChain);

      // Execute
      const result = await findOrCreateUserInUsersTable(
        mockDiscordId,
        newUserId,
        { username: mockUsername, email: mockEmail }
      );

      // Verify: Returns new user ID
      expect(result.userId).toBe(newUserId);
      expect(result.isNew).toBe(true);

      // Verify: Insert was called with correct data
      expect(mockChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: newUserId,
          discord_id: mockDiscordId,
          username: mockUsername,
        })
      );
    });

    it('should handle race condition with unique constraint violation', async () => {
      // Setup: Mock insert failure due to unique constraint, then successful lookup
      let callCount = 0;
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            // First call: user lookup returns not found
            return Promise.resolve({
              data: null,
              error: { code: 'PGRST116', message: 'No rows found' },
            });
          }
          if (callCount === 2) {
            // Second call: insert fails with unique constraint
            return Promise.resolve({
              data: null,
              error: { code: '23505', message: 'Unique constraint violation' },
            });
          }
          // Third call: lookup returns the user created by race condition
          return Promise.resolve({
            data: { id: 'race-winner-uuid' },
            error: null,
          });
        }),
      };

      (supabaseAdmin.from as jest.Mock).mockReturnValue(mockChain);

      // Execute
      const result = await findOrCreateUserInUsersTable(
        mockDiscordId,
        newUserId,
        { username: mockUsername, email: mockEmail }
      );

      // Verify: Returns the user created by the race winner
      expect(result.userId).toBe('race-winner-uuid');
      expect(result.isNew).toBe(false);
    });
  });

  describe('upsertUserProfile', () => {
    const mockDiscordData: DiscordUserData = {
      id: mockDiscordId,
      username: mockUsername,
      email: mockEmail,
      avatar: 'abc123',
    };

    it('should update existing profile without overwriting user data', async () => {
      // Setup: Mock existing profile with user-specific data
      const existingProfile = {
        id: mockUserId,
        discord_id: mockDiscordId,
        username: mockUsername,
        discord_username: 'oldusername',
        email: mockEmail,
        avatar_url: 'old-avatar.png',
        is_admin: true, // User-specific data that should be preserved
        experience_level: 'advanced',
        subscription_tier: 'pro',
        streak_days: 42,
        total_quizzes: 100,
        total_questions: 500,
        current_module: 'advanced-patterns',
      };

      let callCount = 0;
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            // First call: profile lookup returns existing
            return Promise.resolve({
              data: existingProfile,
              error: null,
            });
          }
          // Second call: update returns updated profile
          return Promise.resolve({
            data: {
              ...existingProfile,
              discord_username: mockUsername,
              avatar_url: `https://cdn.discordapp.com/avatars/${mockDiscordId}/abc123.png`,
            },
            error: null,
          });
        }),
      };

      (supabaseAdmin.from as jest.Mock).mockReturnValue(mockChain);

      // Execute
      const result = await upsertUserProfile(mockUserId, mockDiscordData);

      // Verify: User-specific data is preserved
      expect(result.is_admin).toBe(true);
      expect(result.experience_level).toBe('advanced');
      expect(result.subscription_tier).toBe('pro');
      expect(result.streak_days).toBe(42);
      expect(result.total_quizzes).toBe(100);

      // Verify: Discord data is updated
      expect(result.discord_username).toBe(mockUsername);

      // Verify: Update was called with only Discord fields
      expect(mockChain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          discord_username: mockUsername,
          avatar_url: expect.stringContaining('abc123.png'),
        })
      );

      // Verify: Update did NOT include user-specific fields
      const updateCall = mockChain.update.mock.calls[0][0];
      expect(updateCall).not.toHaveProperty('is_admin');
      expect(updateCall).not.toHaveProperty('streak_days');
      expect(updateCall).not.toHaveProperty('subscription_tier');
    });

    it('should create new profile with defaults when none exists', async () => {
      // Setup: Mock no existing profile, then successful insert
      let callCount = 0;
      const newProfile = {
        id: mockUserId,
        discord_id: mockDiscordId,
        username: mockUsername,
        discord_username: mockUsername,
        email: mockEmail,
        avatar_url: `https://cdn.discordapp.com/avatars/${mockDiscordId}/abc123.png`,
        is_admin: false,
        experience_level: 'beginner',
        subscription_tier: 'free',
        streak_days: 0,
        total_quizzes: 0,
        total_questions: 0,
        current_module: 'fundamentals',
      };

      const mockChain = {
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            // First call: profile lookup returns not found
            return Promise.resolve({
              data: null,
              error: { code: 'PGRST116', message: 'No rows found' },
            });
          }
          // Second call: insert returns new profile
          return Promise.resolve({
            data: newProfile,
            error: null,
          });
        }),
      };

      (supabaseAdmin.from as jest.Mock).mockReturnValue(mockChain);

      // Execute
      const result = await upsertUserProfile(mockUserId, mockDiscordData);

      // Verify: New profile has correct defaults
      expect(result.is_admin).toBe(false);
      expect(result.experience_level).toBe('beginner');
      expect(result.subscription_tier).toBe('free');
      expect(result.streak_days).toBe(0);
    });
  });

  describe('Integration: Two consecutive logins preserve userId', () => {
    it('should return same userId on second login without creating duplicates', async () => {
      const discordData = {
        id: mockDiscordId,
        username: mockUsername,
        email: mockEmail,
      };

      // Mock for first login - user doesn't exist, gets created
      const createFirstLoginMock = () => {
        let callCount = 0;
        return {
          select: jest.fn().mockReturnThis(),
          insert: jest.fn().mockReturnThis(),
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
              // User lookup - not found
              return Promise.resolve({
                data: null,
                error: { code: 'PGRST116' },
              });
            }
            // Insert returns new user
            return Promise.resolve({
              data: { id: mockUserId },
              error: null,
            });
          }),
        };
      };

      // Mock for second login - user already exists
      const createSecondLoginMock = () => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: mockUserId },
          error: null,
        }),
      });

      // First login
      (supabaseAdmin.from as jest.Mock).mockReturnValue(createFirstLoginMock());
      const firstResult = await findOrCreateUserInUsersTable(
        mockDiscordId,
        'potential-new-id-1',
        discordData
      );

      // Second login
      (supabaseAdmin.from as jest.Mock).mockReturnValue(createSecondLoginMock());
      const secondResult = await findOrCreateUserInUsersTable(
        mockDiscordId,
        'potential-new-id-2',
        discordData
      );

      // Verify: Both logins return the SAME userId
      expect(firstResult.userId).toBe(mockUserId);
      expect(secondResult.userId).toBe(mockUserId);

      // Verify: First login created new user, second found existing
      expect(firstResult.isNew).toBe(true);
      expect(secondResult.isNew).toBe(false);

      // Verify: The new IDs passed in were NOT used for second login
      expect(secondResult.userId).not.toBe('potential-new-id-2');
    });
  });
});

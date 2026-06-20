import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '../route';
import { prismaMock } from '@/lib/__mocks__/prisma';
import { auth, currentUser } from '@clerk/nextjs/server';

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
}));

vi.mock('@/lib/prisma');

describe('Campaigns API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET', () => {
    it('should return 401 if unauthorized', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: null } as any);

      const request = new Request('http://localhost/api/campaigns');
      const response = await GET(request, {});

      expect(response!.status).toBe(401);
    });

    it('should return campaigns for authorized user', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'user_123' } as any);
      
      const mockUser = { id: 'user_123', workspaces: [{ id: 'workspace_123' }] };
      prismaMock.user.findUnique.mockResolvedValue(mockUser as any);
      
      const mockCampaigns = [{ id: 'campaign_1', name: 'Test Campaign' }];
      prismaMock.campaign.findMany.mockResolvedValue(mockCampaigns as any);
      prismaMock.campaign.count.mockResolvedValue(1);

      const request = new Request('http://localhost/api/campaigns');
      const response = await GET(request, {});
      const _data = await response!.json();

      expect(response!.status).toBe(200);
      expect(prismaMock.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ workspaceId: 'workspace_123' })
        })
      );
    });
  });

  describe('POST', () => {
    it('should return 401 if unauthorized', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: null } as any);

      const request = new Request('http://localhost/api/campaigns', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test' }),
      });
      const response = await POST(request, {});

      expect(response!.status).toBe(401);
    });

    it('should return 429 if rate limited', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'user_123' } as any);
      
      const { rateLimiter } = await import('@/lib/rate-limit');
      vi.spyOn(rateLimiter, 'check').mockReturnValue({ success: false, remaining: 0 });

      const request = new Request('http://localhost/api/campaigns', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test' }),
      });
      const response = await POST(request, {});

      expect(response!.status).toBe(429);
      expect(await response!.json()).toEqual({ error: 'Too Many Requests', code: 'RATE_LIMIT_EXCEEDED' });
    });

    it('should return 400 if validation fails', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'user_123' } as any);
      const { rateLimiter } = await import('@/lib/rate-limit');
      vi.spyOn(rateLimiter, 'check').mockReturnValue({ success: true, remaining: 19 });
      
      const mockUser = { id: 'user_123', workspaces: [{ id: 'workspace_123' }] };
      prismaMock.user.findUnique.mockResolvedValue(mockUser as any);

      const request = new Request('http://localhost/api/campaigns', {
        method: 'POST',
        body: JSON.stringify({ name: '' }), // Invalid name
      });
      const response = await POST(request, {});

      expect(response!.status).toBe(400);
      expect(await response!.json()).toEqual({ error: 'Validation failed', code: 'VALIDATION_ERROR' });
    });

    it('should return 401 if user provisioning fails (user not in DB, Clerk returns no user)', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'user_123' } as any);
      const { rateLimiter } = await import('@/lib/rate-limit');
      vi.spyOn(rateLimiter, 'check').mockReturnValue({ success: true, remaining: 19 });

      // User not found in our DB, and Clerk also returns null (e.g. token mismatch)
      prismaMock.user.findUnique.mockResolvedValue(null);
      vi.mocked(currentUser).mockResolvedValue(null as any);

      const request = new Request('http://localhost/api/campaigns', {
        method: 'POST',
        body: JSON.stringify({ name: 'Valid Name' }),
      });
      const response = await POST(request, {});

      // getOrCreateWorkspace throws UnauthorizedError when DB has no user AND Clerk returns null
      expect(response!.status).toBe(401);
    });

    it('should create a campaign and return 200', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'user_123' } as any);
      const { rateLimiter } = await import('@/lib/rate-limit');
      vi.spyOn(rateLimiter, 'check').mockReturnValue({ success: true, remaining: 19 });
      
      const mockUser = { id: 'user_123', workspaces: [{ id: 'workspace_123' }] };
      prismaMock.user.findUnique.mockResolvedValue(mockUser as any);
      
      const newCampaign = { id: 'campaign_new', name: 'Valid Name', goal: 'Test', targetAudience: 'Testing' };
      prismaMock.campaign.create.mockResolvedValue(newCampaign as any);

      const request = new Request('http://localhost/api/campaigns', {
        method: 'POST',
        body: JSON.stringify({ name: 'Valid Name', goal: 'Test', targetAudience: 'Testing' }),
      });
      const response = await POST(request, {});

      expect(response!.status).toBe(200);
      expect(await response!.json()).toEqual(newCampaign);
      expect(prismaMock.campaign.create).toHaveBeenCalledWith({
        data: {
          name: 'Valid Name',
          goal: 'Test',
          targetAudience: 'Testing',
          workspaceId: 'workspace_123',
        }
      });
    });
  });
});
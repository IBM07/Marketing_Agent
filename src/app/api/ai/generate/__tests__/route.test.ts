import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../route';
import { auth } from '@clerk/nextjs/server';

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));

vi.mock('groq-sdk', () => {
  return {
    Groq: class {
      chat = {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: '{"subject": "Test Subject", "body": "Test Body"}',
                },
              },
            ],
          }),
        },
      };
    },
  };
});

describe('AI Generate API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if unauthorized', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as any);

    const request = new Request('http://localhost/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'test' }),
    });
    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it('should return 429 if rate limited', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'user_123' } as any);
    
    const { rateLimiter } = await import('@/lib/rate-limit');
    vi.spyOn(rateLimiter, 'check').mockReturnValue({ success: false });

    const request = new Request('http://localhost/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'test' }),
    });
    const response = await POST(request);

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: 'Too Many Requests', code: 'RATE_LIMIT_EXCEEDED' });
  });

  it('should return 400 if validation fails', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'user_123' } as any);
    const { rateLimiter } = await import('@/lib/rate-limit');
    vi.spyOn(rateLimiter, 'check').mockReturnValue({ success: true });

    const request = new Request('http://localhost/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt: '' }), // invalid prompt length
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Validation failed', code: 'VALIDATION_ERROR' });
  });

  it('should handle successful generation', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'user_123' } as any);
    const { rateLimiter } = await import('@/lib/rate-limit');
    vi.spyOn(rateLimiter, 'check').mockReturnValue({ success: true });

    const request = new Request('http://localhost/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'test prompt', goal: 'Lead Gen', productName: 'TestProduct' }),
    });
    const response = await POST(request);
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('subject', 'Test Subject');
    expect(data).toHaveProperty('body', 'Test Body');
  });
});
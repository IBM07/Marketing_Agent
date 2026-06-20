import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DashboardOverview from '../page';

// Mock fetch API globally
global.fetch = vi.fn();

// Health response that indicates a healthy system (no banners)
const healthyResponse = {
  json: async () => ({
    status: 'ok',
    db: 'connected',
    redis: 'connected',
    serperCircuit: 'closed',
    llmProviders: { cerebras: 'configured', groq: 'configured', gemini: 'configured' },
  }),
};

describe('DashboardOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    // Health resolves immediately; campaigns + stats never resolve → keeps loading
    (global.fetch as any)
      .mockResolvedValueOnce(healthyResponse)           // /api/health
      .mockImplementationOnce(() => new Promise(() => {}))  // /api/campaigns — never resolves
      .mockImplementationOnce(() => new Promise(() => {})); // /api/stats — never resolves

    render(<DashboardOverview />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders stats after loading', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce(healthyResponse) // /api/health
      .mockResolvedValueOnce({               // /api/campaigns
        json: async () => ({ data: [{ id: '1', name: 'Campaign 1', status: 'ACTIVE' }] }),
      })
      .mockResolvedValueOnce({               // /api/stats
        json: async () => ({ activeCampaigns: 1, totalSent: 42, deliveryRate: '95%' }),
      });

    render(<DashboardOverview />);

    await waitFor(() => {
      expect(screen.getByText('Campaign 1')).toBeInTheDocument();
    });
  });

  it('renders empty state when no campaigns exist', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce(healthyResponse) // /api/health
      .mockResolvedValueOnce({               // /api/campaigns
        json: async () => ({ data: [] }),
      })
      .mockResolvedValueOnce({               // /api/stats
        json: async () => ({ activeCampaigns: 0, totalSent: 0, deliveryRate: '0%' }),
      });

    render(<DashboardOverview />);

    await waitFor(() => {
      expect(screen.getByText(/No campaigns yet\. Deploy your first agent swarm above\./i)).toBeInTheDocument();
    });
  });

  it('handles fetch failure gracefully', async () => {
    // Suppress console.error for this test
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Health rejects — but the dashboard catches all errors silently
    (global.fetch as any)
      .mockRejectedValueOnce(new Error('Fetch failed')) // /api/health — silent fail
      .mockRejectedValueOnce(new Error('Fetch failed')) // /api/campaigns
      .mockRejectedValueOnce(new Error('Fetch failed')); // /api/stats

    render(<DashboardOverview />);

    await waitFor(() => {
      expect(screen.getByText(/No campaigns yet\. Deploy your first agent swarm above\./i)).toBeInTheDocument();
    });

    consoleError.mockRestore();
  });
});
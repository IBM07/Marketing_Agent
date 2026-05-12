import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DashboardOverview from '../page';

// Mock fetch API globally
global.fetch = vi.fn();

describe('DashboardOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    (global.fetch as any).mockImplementationOnce(() => new Promise(() => {})); // Never resolves to keep loading state
    
    render(<DashboardOverview />);
    expect(screen.getByRole('status')).toBeInTheDocument(); // Expecting loader icon/content
  });

  it('renders stats after loading', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      json: async () => ({ data: [{ id: '1', name: 'Campaign 1', status: 'ACTIVE' }] }),
    });

    render(<DashboardOverview />);
    
    await waitFor(() => {
      expect(screen.getByText('Campaign 1')).toBeInTheDocument();
    });
  });

  it('renders empty state when no campaigns exist', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      json: async () => ({ data: [] }),
    });

    render(<DashboardOverview />);
    
    await waitFor(() => {
      expect(screen.getByText(/No campaigns yet\. Deploy your first agent swarm above\./i)).toBeInTheDocument();
    });
  });

  it('handles fetch failure gracefully', async () => {
    // Suppress console.error for this test
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    (global.fetch as any).mockRejectedValueOnce(new Error('Fetch failed'));

    render(<DashboardOverview />);
    
    await waitFor(() => {
      expect(screen.getByText(/No campaigns yet\. Deploy your first agent swarm above\./i)).toBeInTheDocument();
    });

    consoleError.mockRestore();
  });
});
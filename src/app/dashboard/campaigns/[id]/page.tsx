"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Send, Activity, Users, AlertCircle, Loader2 } from "lucide-react";

type EmailLog = {
  id: string;
  recipient: string;
  subject: string;
  status: string;
  createdAt: string;
};

type Campaign = {
  id: string;
  name: string;
  status: string;
  emailLogs: EmailLog[];
};

export default function CampaignDetailsPage({ params }: { params: { id: string } }) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const logsPerPage = 10;

  useEffect(() => {
    const fetchCampaign = async () => {
      try {
        const res = await fetch(`/api/campaigns/${params.id}`);
        if (res.ok) {
          const data = await res.json();
          setCampaign(data);
        }
      } catch (err) {
        console.error("Failed to fetch campaign details", err);
      } finally {
        setLoading(false);
      }
    };
    fetchCampaign();
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="text-center py-24">
        <h2 className="text-2xl font-bold mb-2">Campaign Not Found</h2>
        <p className="text-muted-foreground mb-6">This campaign may have been deleted or you don&apos;t have access.</p>
        <Link href="/dashboard/campaigns" className="text-primary hover:underline">
          Return to Campaigns
        </Link>
      </div>
    );
  }

  // Calculate Metrics
  const logs = campaign.emailLogs || [];
  const totalLeads = logs.length;
  const sentLogs = logs.filter(l => ["SENT", "DELIVERED", "OPENED", "CLICKED"].includes(l.status));
  const openedLogs = logs.filter(l => ["OPENED", "CLICKED"].includes(l.status));
  const bouncedLogs = logs.filter(l => ["BOUNCED", "FAILED"].includes(l.status));

  const totalSent = sentLogs.length;
  const openRate = totalSent > 0 ? ((openedLogs.length / totalSent) * 100).toFixed(1) : "0";
  const bouncedCount = bouncedLogs.length;

  const paginatedLogs = logs.slice((page - 1) * logsPerPage, page * logsPerPage);
  const totalPages = Math.ceil(totalLeads / logsPerPage);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link 
          href="/dashboard/campaigns"
          className="p-2 hover:bg-card/40 rounded-full transition-colors text-muted-foreground"
          aria-label="Back to campaigns"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{campaign.name}</h1>
          <p className="text-muted-foreground text-sm">ID: {campaign.id}</p>
        </div>
        <div className="ml-auto">
          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
            campaign.status === "ACTIVE" ? "bg-green-500/10 text-green-500 border-green-500/20" :
            campaign.status === "COMPLETED" ? "bg-blue-500/10 text-blue-500 border-blue-500/20" :
            "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
          }`}>
            {campaign.status}
          </span>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <div className="p-6 rounded-xl border border-card-border/50 bg-card/10 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-5 h-5 text-muted-foreground" />
            <h3 className="text-sm font-medium text-muted-foreground">Total Leads</h3>
          </div>
          <p className="text-3xl font-bold">{totalLeads}</p>
        </div>
        <div className="p-6 rounded-xl border border-card-border/50 bg-card/10 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-2">
            <Send className="w-5 h-5 text-muted-foreground" />
            <h3 className="text-sm font-medium text-muted-foreground">Sent Emails</h3>
          </div>
          <p className="text-3xl font-bold">{totalSent}</p>
        </div>
        <div className="p-6 rounded-xl border border-card-border/50 bg-card/10 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-2">
            <Activity className="w-5 h-5 text-muted-foreground" />
            <h3 className="text-sm font-medium text-muted-foreground">Open Rate</h3>
          </div>
          <p className="text-3xl font-bold">{openRate}%</p>
        </div>
        <div className="p-6 rounded-xl border border-card-border/50 bg-card/10 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-2">
            <AlertCircle className="w-5 h-5 text-muted-foreground" />
            <h3 className="text-sm font-medium text-muted-foreground">Bounced</h3>
          </div>
          <p className={`text-3xl font-bold ${bouncedCount > 0 ? "text-destructive" : ""}`}>{bouncedCount}</p>
        </div>
      </div>

      <div className="rounded-xl border border-card-border/50 bg-card/5 overflow-hidden flex flex-col">
        <div className="border-b border-card-border/50 px-6 py-4 bg-card/20 flex justify-between items-center">
          <h2 className="font-semibold">Email Activity Log</h2>
          <span className="text-xs text-muted-foreground">{totalLeads} Records</span>
        </div>
        
        {logs.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-muted-foreground mb-4">No email activity recorded yet.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-card/10 border-b border-card-border/50">
                  <tr>
                    <th className="px-6 py-3 font-medium">Recipient</th>
                    <th className="px-6 py-3 font-medium">Subject</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-card-border/50">
                  {paginatedLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-card/20 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs">{log.recipient}</td>
                      <td className="px-6 py-4 truncate max-w-[200px]">{log.subject}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-[10px] uppercase tracking-wider font-medium border ${
                          log.status === "DELIVERED" ? "bg-green-500/10 text-green-500 border-green-500/20" :
                          ["OPENED", "CLICKED"].includes(log.status) ? "bg-blue-500/10 text-blue-500 border-blue-500/20" :
                          ["FAILED", "BOUNCED", "COMPLAINED"].includes(log.status) ? "bg-red-500/10 text-red-500 border-red-500/20" :
                          "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                        }`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-muted-foreground whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {totalPages > 1 && (
              <div className="p-4 border-t border-card-border/50 flex items-center justify-between bg-card/10">
                <button 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 text-xs font-medium rounded-md bg-card border border-card-border hover:bg-card-hover disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-xs text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <button 
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 text-xs font-medium rounded-md bg-card border border-card-border hover:bg-card-hover disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

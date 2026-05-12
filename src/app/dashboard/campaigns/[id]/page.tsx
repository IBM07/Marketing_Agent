import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Send, Activity, Users, AlertCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Campaign Details | HyperDrive AI",
  description: "View details and performance of your AI marketing campaign.",
};

export default function CampaignDetailsPage({ params }: { params: { id: string } }) {
  // In a real app, you would fetch campaign details from DB here.
  const campaignId = params.id;

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
          <h1 className="text-3xl font-bold tracking-tight">Campaign Details</h1>
          <p className="text-muted-foreground">ID: {campaignId}</p>
        </div>
        <div className="ml-auto">
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-primary/20 text-primary border border-primary/30" role="status">
            Active
          </span>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <div className="p-6 rounded-xl border border-card-border/50 bg-card/10 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-5 h-5 text-muted-foreground" />
            <h3 className="text-sm font-medium text-muted-foreground">Total Leads</h3>
          </div>
          <p className="text-3xl font-bold">0</p>
        </div>
        <div className="p-6 rounded-xl border border-card-border/50 bg-card/10 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-2">
            <Send className="w-5 h-5 text-muted-foreground" />
            <h3 className="text-sm font-medium text-muted-foreground">Sent Emails</h3>
          </div>
          <p className="text-3xl font-bold">0</p>
        </div>
        <div className="p-6 rounded-xl border border-card-border/50 bg-card/10 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-2">
            <Activity className="w-5 h-5 text-muted-foreground" />
            <h3 className="text-sm font-medium text-muted-foreground">Open Rate</h3>
          </div>
          <p className="text-3xl font-bold">0%</p>
        </div>
        <div className="p-6 rounded-xl border border-card-border/50 bg-card/10 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-2">
            <AlertCircle className="w-5 h-5 text-muted-foreground" />
            <h3 className="text-sm font-medium text-muted-foreground">Bounced</h3>
          </div>
          <p className="text-3xl font-bold text-destructive">0</p>
        </div>
      </div>

      <div className="rounded-xl border border-card-border/50 bg-card/5 overflow-hidden">
        <div className="border-b border-card-border/50 px-6 py-4 bg-card/20">
          <h2 className="font-semibold">Email Activity Log</h2>
        </div>
        <div className="p-8 text-center">
          <p className="text-muted-foreground mb-4">No email activity recorded yet.</p>
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary border border-primary/20 font-medium rounded-md hover:bg-primary/20 transition-colors">
            <Send className="w-4 h-4" />
            Start Sending
          </button>
        </div>
      </div>
    </div>
  );
}

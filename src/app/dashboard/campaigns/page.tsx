import { Metadata } from "next";
import Link from "next/link";
import { Plus, Search, Filter } from "lucide-react";

export const metadata: Metadata = {
  title: "Campaigns | HyperDrive AI",
  description: "Manage your AI-powered marketing campaigns.",
};

export default function CampaignsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground">Manage and monitor all your email campaigns.</p>
        </div>
        <Link
          href="/dashboard/campaigns/new"
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-medium rounded-md hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Campaign
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search campaigns..."
            className="w-full pl-9 pr-4 py-2 bg-card/20 border border-card-border/50 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-card/20 border border-card-border/50 rounded-md hover:bg-card/40 transition-colors text-sm font-medium">
          <Filter className="w-4 h-4" />
          Filter
        </button>
      </div>

      <div className="rounded-xl border border-card-border/50 bg-card/5 overflow-hidden">
        <div className="p-8 text-center">
          <p className="text-muted-foreground mb-4">No campaigns found. Create your first campaign to get started.</p>
          <Link
            href="/dashboard/campaigns/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary border border-primary/20 font-medium rounded-md hover:bg-primary/20 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Campaign
          </Link>
        </div>
      </div>
    </div>
  );
}

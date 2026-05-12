import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Analytics | HyperDrive AI",
  description: "View performance analytics of your AI marketing campaigns.",
};

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">Monitor your campaign performance and email delivery rates.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="p-6 rounded-xl border border-card-border/50 bg-card/10 backdrop-blur-sm">
          <h3 className="text-sm font-medium text-muted-foreground mb-1">Total Sent</h3>
          <p className="text-3xl font-bold">0</p>
        </div>
        <div className="p-6 rounded-xl border border-card-border/50 bg-card/10 backdrop-blur-sm">
          <h3 className="text-sm font-medium text-muted-foreground mb-1">Open Rate</h3>
          <p className="text-3xl font-bold">0%</p>
        </div>
        <div className="p-6 rounded-xl border border-card-border/50 bg-card/10 backdrop-blur-sm">
          <h3 className="text-sm font-medium text-muted-foreground mb-1">Click Rate</h3>
          <p className="text-3xl font-bold">0%</p>
        </div>
      </div>

      <div className="h-[400px] w-full rounded-xl border border-card-border/50 bg-card/5 flex items-center justify-center border-dashed">
        <p className="text-muted-foreground">Detailed charts will appear here once you have active campaigns.</p>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

type ChartData = {
  date: string;
  sent: number;
  opened: number;
  clicked: number;
  failed: number;
};

type Summary = {
  totalSent: number;
  openRate: string;
  clickRate: string;
};

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ChartData[]>([]);
  const [summary, setSummary] = useState<Summary>({ totalSent: 0, openRate: "0.0", clickRate: "0.0" });

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await fetch("/api/analytics");
        if (res.ok) {
          const json = await res.json();
          setData(json.chartData);
          setSummary(json.summary);
        }
      } catch (err) {
        console.error("Failed to fetch analytics:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  const maxSent = Math.max(...data.map((d) => d.sent), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">Monitor your campaign performance and email delivery rates.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="p-6 rounded-xl border border-card-border/50 bg-card/10 backdrop-blur-sm">
          <h3 className="text-sm font-medium text-muted-foreground mb-1">Total Sent</h3>
          <div className="text-3xl font-bold flex items-center h-9">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : summary.totalSent}
          </div>
        </div>
        <div className="p-6 rounded-xl border border-card-border/50 bg-card/10 backdrop-blur-sm">
          <h3 className="text-sm font-medium text-muted-foreground mb-1">Open Rate</h3>
          <div className="text-3xl font-bold flex items-center h-9">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : `${summary.openRate}%`}
          </div>
        </div>
        <div className="p-6 rounded-xl border border-card-border/50 bg-card/10 backdrop-blur-sm">
          <h3 className="text-sm font-medium text-muted-foreground mb-1">Click Rate</h3>
          <div className="text-3xl font-bold flex items-center h-9">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : `${summary.clickRate}%`}
          </div>
        </div>
      </div>

      <div className="h-[400px] w-full rounded-xl border border-card-border/50 bg-card/10 flex flex-col p-6 overflow-hidden">
        <h3 className="text-sm font-medium text-muted-foreground mb-4">Volume Over Time</h3>
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : data.length === 0 ? (
          <div className="flex-1 flex items-center justify-center border border-dashed border-card-border/50 rounded-lg bg-card/5">
            <p className="text-muted-foreground">Detailed charts will appear here once you have active campaigns.</p>
          </div>
        ) : (
          <div className="flex-1 flex items-end gap-2 relative mt-4 pt-8">
            {data.map((d, i) => {
              const heightPercentage = (d.sent / maxSent) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-2 group relative h-full justify-end">
                  <div className="absolute -top-12 opacity-0 group-hover:opacity-100 transition-opacity bg-card text-xs p-2 rounded shadow border border-card-border/50 pointer-events-none z-10 whitespace-nowrap">
                    {d.date}: {d.sent} sent
                  </div>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(heightPercentage, 2)}%` }}
                    transition={{ duration: 0.5, delay: i * 0.05 }}
                    className="w-full bg-primary/20 hover:bg-primary/40 rounded-t-sm transition-colors relative"
                  >
                    <div 
                      className="absolute bottom-0 w-full bg-primary rounded-t-sm transition-all" 
                      style={{ height: `${(d.opened / Math.max(d.sent, 1)) * 100}%` }}
                    />
                  </motion.div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

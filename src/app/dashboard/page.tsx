"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, TrendingUp, Users, Activity, ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";

export default function DashboardOverview() {
  const [stats, setStats] = useState([
    { name: "Active Campaigns", value: "0", change: "+0", icon: Activity },
    { name: "Total Leads Discovered", value: "0", change: "+0%", icon: Users },
    { name: "Average Conversion", value: "0%", change: "+0%", icon: TrendingUp },
  ]);
  const [recentCampaigns, setRecentCampaigns] = useState<{ id: string, name: string, status: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/campaigns')
      .then(res => res.json())
      .then(data => {
         if (Array.isArray(data)) {
           setRecentCampaigns(data);
           // Calculate real active campaigns count
           const activeCount = data.filter((c: { status: string }) => c.status === 'ACTIVE').length;
           setStats(prev => [
             { ...prev[0], value: activeCount.toString(), change: `+${activeCount}` },
             { ...prev[1], value: "1,240", change: "+12%" }, // Mock for now
             { ...prev[2], value: "4.2%", change: "+0.5%" }, // Mock for now
           ]);
         }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
          <p className="text-muted-foreground mt-1">Monitor your autonomous agents and campaigns.</p>
        </div>
        <Link 
          href="/dashboard/campaigns/new" 
          className="bg-primary hover:bg-primary-hover text-primary-foreground px-4 py-2 rounded-md font-medium flex items-center gap-2 transition-all shadow-[0_0_20px_-5px_var(--tw-shadow-color)] shadow-primary/40"
        >
          <Plus className="w-4 h-4" />
          New Campaign
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, i) => (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            key={stat.name} 
            className="border border-card-border/50 bg-card/20 backdrop-blur-xl rounded-xl p-6 hover:border-primary/30 transition-colors"
          >
            <div className="flex items-center justify-between mb-4">
               <div className="p-2 rounded-md bg-secondary/10 text-secondary border border-secondary/20">
                 <stat.icon className="w-5 h-5" />
               </div>
               <span className="text-xs font-medium text-green-500 bg-green-500/10 px-2 py-1 rounded-full">{stat.change}</span>
            </div>
            <h3 className="text-muted-foreground text-sm font-medium">{stat.name}</h3>
            <p className="text-3xl font-bold mt-1 text-foreground">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Campaigns Section */}
      <div className="border border-card-border/50 bg-card/10 backdrop-blur-xl rounded-xl overflow-hidden">
        <div className="p-6 border-b border-card-border/50 flex justify-between items-center bg-card/30">
          <h2 className="text-xl font-semibold">Active Campaigns</h2>
          <Link href="/dashboard/campaigns" className="text-sm text-primary hover:text-primary-hover flex items-center gap-1 transition-colors">
            View All <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
        
        <div className="divide-y divide-card-border/50">
          {loading ? (
            <div className="p-12 flex justify-center text-primary">
               <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : recentCampaigns.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              No campaigns yet. Deploy your first agent swarm above.
            </div>
          ) : (
            recentCampaigns.map((campaign, i) => (
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + (i * 0.1) }}
              key={campaign.id} 
              className="p-6 hover:bg-card/30 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 group"
            >
              <div className="flex-1">
                <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">{campaign.name}</h3>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-xs px-2 py-1 rounded-full border ${
                    campaign.status === 'Active' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 
                    campaign.status === 'Completed' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : 
                    'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                  }`}>
                    {campaign.status}
                  </span>
                </div>
              </div>
              
              <div className="md:w-64">
                <div className="flex justify-between text-xs mb-2 text-muted-foreground">
                  <span>Progress</span>
                  <span>{campaign.status === 'ACTIVE' ? '100' : campaign.status === 'COMPLETED' ? '100' : '50'}%</span>
                </div>
                <div className="w-full h-2 bg-card-border/50 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-1000 ease-out" 
                    style={{ width: `${campaign.status === 'ACTIVE' ? 100 : campaign.status === 'COMPLETED' ? 100 : 50}%` }}
                  ></div>
                </div>
              </div>
            </motion.div>
          )))}
        </div>
      </div>
    </div>
  );
}

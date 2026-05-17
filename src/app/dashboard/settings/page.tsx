"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Key, Mail, RefreshCw, XCircle, Bot } from "lucide-react";
import Link from "next/link";

export default function SettingsPage() {
  const [resendStatus, setResendStatus] = useState<"checking" | "configured" | "missing">("checking");
  const [groqStatus, setGroqStatus] = useState<"checking" | "configured" | "missing">("checking");

  const checkIntegrations = async () => {
    setResendStatus("checking");
    setGroqStatus("checking");

    try {
      const res = await fetch("/api/settings/check");
      if (res.ok) {
        const data = await res.json();
        setResendStatus(data.resendConfigured ? "configured" : "missing");
        setGroqStatus(data.groqConfigured ? "configured" : "missing");
      } else {
        throw new Error("Failed to fetch settings status");
      }
    } catch {
      setResendStatus("missing");
      setGroqStatus("missing");
    }
  };

  useEffect(() => {
    checkIntegrations();
  }, []);

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Workspace Settings</h1>
        <p className="text-muted-foreground mt-1">Manage global integrations and deployment configurations.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Email Dispatch Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="border border-card-border/50 bg-card/20 backdrop-blur-xl rounded-2xl p-6 shadow-lg"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                <Mail className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Email Dispatch</h3>
                <p className="text-xs text-muted-foreground">Resend Integration</p>
              </div>
            </div>
            
            <div className={`px-2 py-1 text-xs rounded-full border flex items-center gap-1 ${
              resendStatus === 'configured' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 
              resendStatus === 'missing' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 
              'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
            }`}>
              {resendStatus === 'configured' && <CheckCircle2 className="w-3 h-3" />}
              {resendStatus === 'missing' && <XCircle className="w-3 h-3" />}
              {resendStatus === 'checking' && <RefreshCw className="w-3 h-3 animate-spin" />}
              {resendStatus.charAt(0).toUpperCase() + resendStatus.slice(1)}
            </div>
          </div>

          <div className="space-y-4 mt-6">
            <div className="bg-background/40 p-3 rounded-lg border border-card-border/50">
              <label className="text-xs font-medium text-muted-foreground block mb-1">API Status</label>
              <div className="flex justify-between items-center text-sm">
                <span>Environment Variable</span>
                <Key className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Email dispatch is handled via the Resend API. Ensure RESEND_API_KEY is present in your server environment to fully activate autonomous campaigns.
            </p>
            <Link 
              href="/dashboard/campaigns/new"
              className="block w-full text-center py-2 border border-primary/30 hover:bg-primary/10 text-primary text-sm font-medium rounded-md transition-colors"
            >
              Test Dispatch Flow
            </Link>
          </div>
        </motion.div>

        {/* Groq AI Engine Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="border border-card-border/50 bg-card/20 backdrop-blur-xl rounded-2xl p-6 shadow-lg"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-secondary/10 rounded-lg border border-secondary/20">
                <Bot className="w-6 h-6 text-secondary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">AI Engine</h3>
                <p className="text-xs text-muted-foreground">Groq Integration</p>
              </div>
            </div>
            
            <div className={`px-2 py-1 text-xs rounded-full border flex items-center gap-1 ${
              groqStatus === 'configured' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 
              groqStatus === 'missing' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 
              'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
            }`}>
              {groqStatus === 'configured' && <CheckCircle2 className="w-3 h-3" />}
              {groqStatus === 'missing' && <XCircle className="w-3 h-3" />}
              {groqStatus === 'checking' && <RefreshCw className="w-3 h-3 animate-spin" />}
              {groqStatus.charAt(0).toUpperCase() + groqStatus.slice(1)}
            </div>
          </div>

          <div className="space-y-4 mt-6">
            <div className="bg-background/40 p-3 rounded-lg border border-card-border/50">
              <label className="text-xs font-medium text-muted-foreground block mb-1">API Status</label>
              <div className="flex justify-between items-center text-sm">
                <span>Environment Variable</span>
                <Key className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              AI content generation is powered by Groq. Ensure GROQ_API_KEY is present in your server environment to synthesize market data and generate copy.
            </p>
            <Link 
              href="/dashboard/campaigns/new"
              className="block w-full text-center py-2 border border-secondary/30 hover:bg-secondary/10 text-secondary text-sm font-medium rounded-md transition-colors"
            >
              Test Generation Engine
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

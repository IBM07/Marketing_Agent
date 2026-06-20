"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Key, RefreshCw, XCircle, Bot, Save, Loader2, Server, Shield } from "lucide-react";
import Link from "next/link";

type SettingsData = {
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  smtpPassword: string | null;
  senderEmail: string | null;
  senderName: string | null;
  quota: { used: number; limit: number; remaining: number };
};

export default function SettingsPage() {
  const [groqStatus, setGroqStatus] = useState<"checking" | "configured" | "missing">("checking");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [form, setForm] = useState({
    smtpHost: "",
    smtpPort: "",
    smtpUser: "",
    smtpPassword: "",
    senderEmail: "",
    senderName: "",
  });

  const [quota, setQuota] = useState({ used: 0, limit: 100, remaining: 100 });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const [settingsRes, checkRes] = await Promise.all([
          fetch("/api/settings"),
          fetch("/api/settings/check"),
        ]);

        if (settingsRes.ok) {
          const data: SettingsData = await settingsRes.json();
          setForm({
            smtpHost: data.smtpHost || "",
            smtpPort: data.smtpPort?.toString() || "",
            smtpUser: data.smtpUser || "",
            smtpPassword: data.smtpPassword || "",
            senderEmail: data.senderEmail || "",
            senderName: data.senderName || "",
          });
          setQuota(data.quota);
        }

        if (checkRes.ok) {
          const checkData = await checkRes.json();
          setGroqStatus(checkData.groqConfigured ? "configured" : "missing");
        } else {
          setGroqStatus("missing");
        }
      } catch {
        setGroqStatus("missing");
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);

    try {
      const payload: Record<string, string | number | null> = {
        smtpHost: form.smtpHost || null,
        smtpPort: form.smtpPort ? parseInt(form.smtpPort) : null,
        smtpUser: form.smtpUser || null,
        smtpPassword: form.smtpPassword,
        senderEmail: form.senderEmail || null,
        senderName: form.senderName || null,
      };

      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSaveMessage({ type: "success", text: "Settings saved successfully!" });
        // Refresh quota after save
        const refreshRes = await fetch("/api/settings");
        if (refreshRes.ok) {
          const data: SettingsData = await refreshRes.json();
          setQuota(data.quota);
        }
      } else {
        const errData = await res.json();
        setSaveMessage({ type: "error", text: errData.error || "Failed to save settings." });
      }
    } catch {
      setSaveMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMessage(null), 5000);
    }
  };

  const quotaPercentage = quota.limit > 0 ? (quota.used / quota.limit) * 100 : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Workspace Settings</h1>
        <p className="text-muted-foreground mt-1">Manage email credentials, SMTP config, and daily usage.</p>
      </div>

      <div className="space-y-6">

        {/* Section 2 — SMTP Credentials */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="border border-card-border/50 bg-card/20 backdrop-blur-xl rounded-2xl p-6 shadow-lg"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-secondary/10 rounded-lg border border-secondary/20">
              <Server className="w-6 h-6 text-secondary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">SMTP Credentials</h3>
              <p className="text-xs text-muted-foreground">Direct SMTP server configuration for email dispatch</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="smtpHost" className="block text-sm font-medium mb-2">SMTP Host</label>
              <input
                id="smtpHost"
                type="text"
                value={form.smtpHost}
                onChange={(e) => setForm({ ...form, smtpHost: e.target.value })}
                placeholder="smtp.gmail.com"
                className="w-full bg-background/50 border border-card-border rounded-md px-4 py-3 focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all text-sm"
              />
            </div>
            <div>
              <label htmlFor="smtpPort" className="block text-sm font-medium mb-2">SMTP Port</label>
              <input
                id="smtpPort"
                type="number"
                value={form.smtpPort}
                onChange={(e) => setForm({ ...form, smtpPort: e.target.value })}
                placeholder="587"
                className="w-full bg-background/50 border border-card-border rounded-md px-4 py-3 focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all text-sm"
              />
            </div>
            <div>
              <label htmlFor="smtpUser" className="block text-sm font-medium mb-2">Username</label>
              <input
                id="smtpUser"
                type="text"
                value={form.smtpUser}
                onChange={(e) => setForm({ ...form, smtpUser: e.target.value })}
                placeholder="user@gmail.com"
                className="w-full bg-background/50 border border-card-border rounded-md px-4 py-3 focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all text-sm"
              />
            </div>
            <div>
              <label htmlFor="smtpPassword" className="block text-sm font-medium mb-2">Password</label>
              <input
                id="smtpPassword"
                type="password"
                value={form.smtpPassword}
                onChange={(e) => setForm({ ...form, smtpPassword: e.target.value })}
                placeholder="App password or SMTP password"
                className="w-full bg-background/50 border border-card-border rounded-md px-4 py-3 focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all text-sm font-mono"
              />
            </div>
            <div>
              <label htmlFor="senderName" className="block text-sm font-medium mb-2">Sender Name</label>
              <input
                id="senderName"
                type="text"
                value={form.senderName}
                onChange={(e) => setForm({ ...form, senderName: e.target.value })}
                placeholder="My Company"
                className="w-full bg-background/50 border border-card-border rounded-md px-4 py-3 focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all text-sm"
              />
            </div>
            <div>
              <label htmlFor="senderEmail" className="block text-sm font-medium mb-2">Sender Email</label>
              <input
                id="senderEmail"
                type="email"
                value={form.senderEmail}
                onChange={(e) => setForm({ ...form, senderEmail: e.target.value })}
                placeholder="noreply@company.com"
                className="w-full bg-background/50 border border-card-border rounded-md px-4 py-3 focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all text-sm"
              />
            </div>
          </div>
        </motion.div>

        {/* Section 3 — Daily Usage */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="border border-card-border/50 bg-card/20 backdrop-blur-xl rounded-2xl p-6 shadow-lg"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
              <Shield className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Daily Email Usage</h3>
              <p className="text-xs text-muted-foreground">Quota resets at midnight UTC</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{quota.used} / {quota.limit} emails sent today</span>
              <span className={`font-medium ${quota.remaining === 0 ? "text-red-400" : "text-green-400"}`}>
                {quota.remaining} remaining
              </span>
            </div>
            <div className="w-full h-3 bg-card-border/50 rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full transition-all duration-700 ${
                  quotaPercentage >= 90 ? "bg-red-500" :
                  quotaPercentage >= 70 ? "bg-orange-500" :
                  "bg-gradient-to-r from-primary to-secondary"
                }`}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(quotaPercentage, 100)}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
            </div>
            {quota.remaining === 0 && (
              <p className="text-xs text-red-400 mt-1">
                ⚠️ Daily limit reached. Emails will resume after midnight UTC.
              </p>
            )}
          </div>
        </motion.div>

        {/* Groq AI Engine Card (unchanged) */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
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

        {/* Save Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-col items-end gap-3"
        >
          {saveMessage && (
            <div className={`w-full p-3 rounded-lg text-sm font-medium border ${
              saveMessage.type === "success" 
                ? "bg-green-500/10 text-green-400 border-green-500/20" 
                : "bg-red-500/10 text-red-400 border-red-500/20"
            }`}>
              {saveMessage.type === "success" ? "✓ " : "✗ "}{saveMessage.text}
            </div>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-8 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </motion.div>
      </div>
    </div>
  );
}

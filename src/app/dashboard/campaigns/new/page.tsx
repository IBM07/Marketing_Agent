"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Sparkles, Target, Rocket, Loader2, CheckCircle2, Users, Bot, Send, Upload, Zap, Globe } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function NewCampaign() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    goal: "Lead Generation",
    niche: "",
    valueProp: ""
  });

  const [generatedSubject, setGeneratedSubject] = useState("");
  const [generatedCopy, setGeneratedCopy] = useState("");
  const [recipientsList, setRecipientsList] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");

  // Scraper-first state
  const [scrapePrompt, setScrapePrompt] = useState("");
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<{
    leadsExtracted: number;
    companySamples: string[];
  } | null>(null);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [leadMode, setLeadMode] = useState<"scrape" | "upload">("scrape");

  // Async job tracking state
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState<{
    status: string;
    totalUrls: number;
    processedUrls: number;
    leadsFound: number;
    progressPct: number;
  } | null>(null);

  // Add robust keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isEnter = e.key === 'Enter';
      const hasModifier = e.ctrlKey || e.metaKey;

      if (isEnter) {
        // Require Ctrl+Enter or Cmd+Enter to proceed globally in this wizard
        if (!hasModifier) return;
        
        e.preventDefault();
        if (step === 1 && recipientsList.length === 0) {
          // Block continue from Step 1 if no leads
          return;
        }
        if (step < 4) {
          setStep((s) => s + 1);
        } else if (step === 4 && !isGenerating) {
          handleGenerate();
        } else if (step === 5 && !isSaving) {
          handleActivate();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, isGenerating, isSaving, formData, generatedSubject, generatedCopy, recipientsList]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const XLSX = await import("xlsx");
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        const emails = new Set<string>();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        data.forEach((row: unknown) => {
          if (row && typeof row === 'object') {
            Object.values(row).forEach((val: unknown) => {
              if (typeof val === 'string' && emailRegex.test(val.trim())) {
                emails.add(val.trim());
              }
            });
          }
        });

        setRecipientsList(Array.from(emails));
      } catch (err) {
        console.error("Error parsing file:", err);
        alert("Failed to parse file. Please ensure it's a valid CSV or Excel file.");
      }
    };

    reader.readAsBinaryString(file);
  };


  const handleScrape = async () => {
    if (!scrapePrompt.trim()) return;
    setIsScraping(true);
    setScrapeError(null);
    setScrapeResult(null);
    setActiveJobId(null);
    setJobProgress(null);

    try {
      // Step 1: Submit the job — returns immediately with { jobId }
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: scrapePrompt }),
      });
      const data = await res.json();

      if (!res.ok || !data.success || !data.jobId) {
        setScrapeError(data.error || "Failed to start scraping job. Try again.");
        setIsScraping(false);
        return;
      }

      const jobId: string = data.jobId;
      setActiveJobId(jobId);

      // Step 2: Poll /api/agent/status every 3 seconds until DONE or FAILED
      await new Promise<void>((resolve) => {
        const poll = setInterval(async () => {
          try {
            const statusRes = await fetch(`/api/agent/status?jobId=${jobId}`);
            if (!statusRes.ok) return; // transient error — keep polling
            const status = await statusRes.json();

            setJobProgress({
              status: status.status,
              totalUrls: status.totalUrls,
              processedUrls: status.processedUrls,
              leadsFound: status.leadsFound,
              progressPct: status.progressPct,
            });

            if (status.status === "DONE" || status.status === "FAILED") {
              clearInterval(poll);
              resolve();
            }
          } catch {
            // network hiccup — keep polling
          }
        }, 3000);
      });

      // Step 3: Evaluate final state
      const finalStatus = await fetch(`/api/agent/status?jobId=${jobId}`).then(r => r.json());

      if (finalStatus.status === "FAILED") {
        setScrapeError(finalStatus.errorMessage || "Pipeline job failed. Try again.");
        return;
      }

      if (finalStatus.leadsFound === 0) {
        setScrapeError("No leads found. Try broadening your search description.");
        return;
      }

      // Fetch the actual lead emails from the leads API for this workspace
      // so we can populate recipientsList for the campaign
      const leadsRes = await fetch(`/api/leads?jobId=${jobId}&limit=500`);
      const leadsData = await leadsRes.json();
      const leads: { email: string; companyName: string }[] = leadsData.data || leadsData || [];

      setRecipientsList(leads.map((l) => l.email));
      setScrapeResult({
        leadsExtracted: finalStatus.leadsFound,
        companySamples: leads.slice(0, 3).map((l) => l.companyName),
      });
    } catch {
      setScrapeError("Network error. Please try again.");
    } finally {
      setIsScraping(false);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const prompt = `Campaign Name: ${formData.name}\nGoal: ${formData.goal}\nTarget Audience: ${formData.niche}\nValue Proposition: ${formData.valueProp}`;
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (res.ok) {
        setGeneratedSubject(data.subject || "Action Required");
        setGeneratedCopy(data.body || data.result || "No copy generated.");
        setStep(5);
      } else {
        alert(data || "Failed to generate copy");
      }
    } catch (e) {
      console.error(e);
      alert("Generation failed. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleActivate = async () => {
    // Client-side guard: prevent sending if name was lost (e.g. by Fast Refresh)
    if (!formData.name.trim()) {
      alert("Campaign name is required. Please go back to Step 2 and enter a name.");
      return;
    }
    setIsSaving(true);
    try {
      const campRes = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          goal: formData.goal,
          targetAudience: formData.niche,
        }),
      });
      if (!campRes.ok) {
        const errBody = await campRes.json().catch(() => ({}));
        throw new Error(errBody.error || `Server returned ${campRes.status}`);
      }
      const campaign = await campRes.json();

      if (recipientsList.length > 0) {
        const sendRes = await fetch("/api/campaigns/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            campaignId: campaign.id,
            recipients: recipientsList,
            subject: generatedSubject || `Action Required: Info on ${formData.name}`,
            content: generatedCopy,
          }),
        });
        const sendData = await sendRes.json();
        if (!sendRes.ok && sendRes.status === 429) {
          // Don't show error — campaign saved, partial is expected
          setIsSaving(false);
          setIsSuccess(true);
          // Redirect to campaign detail instead of dashboard so user sees the PARTIAL banner
          setTimeout(() => router.push(`/dashboard/campaigns/${campaign.id}`), 2000);
          return;
        }
        // If partial send (some sent, some skipped) — still show success
        if (sendData.isPartial) {
          setIsSaving(false);
          setIsSuccess(true);
          setTimeout(() => router.push(`/dashboard/campaigns/${campaign.id}`), 2000);
          return;
        }
      }

      setIsSaving(false);
      setIsSuccess(true);
      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "Unknown error";
      alert(`Error saving campaign: ${msg}`);
      setIsSaving(false);
    }
  };

  // Adjust progress bar logic for 5 steps now
  const progressPercentage = (step / 5) * 100;

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <div className="mb-8">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Deploy New Agent</h1>
        <p className="text-muted-foreground mt-1">Configure your AI marketing agent parameters.</p>
      </div>

      <div className="bg-card/10 border border-card-border/50 backdrop-blur-xl rounded-2xl overflow-hidden relative">
        {/* Progress Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-card-border/50">
          <motion.div
            className="h-full bg-gradient-to-r from-primary to-secondary"
            initial={{ width: "20%" }}
            animate={{ width: `${progressPercentage}%` }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          />
        </div>

        <div className="p-8 md:p-12">

          <AnimatePresence mode="wait">
            {isSuccess ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-24 text-center"
              >
                <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mb-6 border border-green-500/20">
                  <CheckCircle2 className="w-10 h-10 text-green-500" />
                </div>
                <h2 className="text-3xl font-bold mb-2">Agent Deployed</h2>
                <p className="text-muted-foreground max-w-md">Your autonomous marketing swarm has been initialized and is active.</p>
              </motion.div>
            ) : isGenerating ? (
              <motion.div
                key="generating"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="flex flex-col items-center justify-center py-24 text-center"
              >
                <div className="relative w-24 h-24 flex items-center justify-center mb-8">
                  <div className="absolute inset-0 border-t-2 border-primary rounded-full animate-spin"></div>
                  <div className="absolute inset-2 border-r-2 border-secondary rounded-full animate-spin [animation-duration:1.5s] [animation-direction:reverse]"></div>
                  <Bot className="w-8 h-8 text-white relative z-10 animate-pulse" />
                </div>
                <h2 className="text-2xl font-bold mb-2 flex items-center justify-center gap-2 w-full text-center">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  Synthesizing Market Data...
                </h2>
                <p className="text-muted-foreground font-mono text-sm max-w-sm mt-4 text-center">
                  Generating highly personalized email...
                </p>
              </motion.div>
            ) : (
              <motion.div
                key={`step-${step}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                {step === 1 && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 mb-8">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <Globe className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold">Find Leads</h2>
                        <p className="text-sm text-muted-foreground">Describe who you want to reach</p>
                      </div>
                    </div>

                    {/* Tab: Scrape vs Upload */}
                    <div className="flex gap-2 p-1 bg-background/30 rounded-lg border border-card-border/50 w-fit">
                      <button
                        onClick={() => setLeadMode("scrape")}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${leadMode === "scrape" ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        <Bot className="w-4 h-4" /> Auto-Scrape (AI)
                      </button>
                      <button
                        onClick={() => setLeadMode("upload")}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${leadMode === "upload" ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        <Upload className="w-4 h-4" /> Upload CSV
                      </button>
                    </div>

                    {leadMode === "scrape" && (
                      <div className="space-y-4">
                        <textarea
                          id="scrapePrompt"
                          rows={3}
                          placeholder='e.g. "SaaS founders in NYC doing $10k-50k MRR without a marketing team"'
                          value={scrapePrompt}
                          onChange={e => setScrapePrompt(e.target.value)}
                          className="w-full bg-background/50 border border-card-border rounded-md px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-sm font-mono resize-none"
                        />

                        {/* Async job progress panel */}
                        {isScraping && (
                          <div className="p-4 rounded-lg border border-card-border/50 bg-card/10 space-y-4">
                            {!activeJobId ? (
                              <div className="flex items-center gap-3 text-sm font-mono text-muted-foreground">
                                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                <span>Submitting job to pipeline...</span>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
                                  <div className="flex items-center gap-2">
                                    {jobProgress?.status === "RUNNING" || jobProgress?.status === "QUEUED" ? (
                                      <Loader2 className="w-3 h-3 animate-spin text-primary" />
                                    ) : (
                                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                                    )}
                                    <span className="uppercase tracking-widest">
                                      {jobProgress?.status === "QUEUED" ? "Queued — waiting for worker..." :
                                       jobProgress?.status === "RUNNING" ? "Pipeline running..." :
                                       jobProgress?.status === "DONE" ? "Complete!" : "Processing..."}
                                    </span>
                                  </div>
                                  <span className="tabular-nums">
                                    {jobProgress?.processedUrls ?? 0} / {jobProgress?.totalUrls ?? "?"} URLs
                                    {(jobProgress?.leadsFound ?? 0) > 0 && (
                                      <span className="ml-2 text-green-400">· {jobProgress?.leadsFound} leads</span>
                                    )}
                                  </span>
                                </div>

                                {/* Live progress bar */}
                                <div className="w-full h-2 bg-card-border/50 rounded-full overflow-hidden">
                                  <motion.div
                                    className="h-full bg-gradient-to-r from-primary to-secondary rounded-full"
                                    initial={{ width: "0%" }}
                                    animate={{ width: `${jobProgress?.progressPct ?? 0}%` }}
                                    transition={{ duration: 0.8, ease: "easeOut" }}
                                  />
                                </div>

                                <div className="grid grid-cols-3 gap-3 pt-1">
                                  {[
                                    { label: "🔍 Discovered", value: jobProgress?.totalUrls ?? 0, unit: "URLs" },
                                    { label: "🕷 Scraped", value: jobProgress?.processedUrls ?? 0, unit: "pages" },
                                    { label: "✉️ Leads Found", value: jobProgress?.leadsFound ?? 0, unit: "contacts" },
                                  ].map((stat) => (
                                    <div key={stat.label} className="text-center p-2 rounded-md bg-background/30 border border-card-border/30">
                                      <div className="text-lg font-bold tabular-nums text-foreground">{stat.value}</div>
                                      <div className="text-[10px] text-muted-foreground font-mono">{stat.label}</div>
                                    </div>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        )}

                        {/* Success state */}
                        {scrapeResult && (
                          <div className="text-sm text-green-500 font-medium bg-green-500/10 p-4 rounded-lg border border-green-500/20 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                            <span>
                              <strong>{scrapeResult.leadsExtracted}</strong> verified leads found
                              — {scrapeResult.companySamples.join(", ")}
                              {scrapeResult.leadsExtracted > 3 ? " and more" : ""}
                            </span>
                          </div>
                        )}

                        {/* Error / 0-leads state */}
                        {scrapeError && (
                          <div className="p-4 rounded-lg border border-orange-500/20 bg-orange-500/10 space-y-3">
                            <p className="text-sm text-orange-400">⚠️ {scrapeError}</p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => { setScrapeError(null); setScrapeResult(null); }}
                                className="px-4 py-2 text-xs font-medium rounded-md bg-card border border-card-border hover:bg-card-hover transition-all"
                              >
                                🔄 Try Again
                              </button>
                              <button
                                onClick={() => { setScrapeError(null); setLeadMode("upload"); }}
                                className="px-4 py-2 text-xs font-medium rounded-md bg-card border border-card-border hover:bg-card-hover transition-all"
                              >
                                📂 Upload CSV Instead
                              </button>
                            </div>
                          </div>
                        )}

                        {!scrapeResult && !scrapeError && (
                          <button
                            onClick={handleScrape}
                            disabled={isScraping || !scrapePrompt.trim()}
                            className="bg-primary hover:bg-primary-hover text-primary-foreground px-6 py-2.5 rounded-md font-medium flex items-center gap-2 transition-all disabled:opacity-50 shadow-[0_0_20px_-5px_var(--tw-shadow-color)] shadow-primary/40"
                          >
                            {isScraping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                            {isScraping ? "Finding leads..." : "⚡ Find Leads"}
                          </button>
                        )}
                      </div>
                    )}

                    {leadMode === "upload" && (
                      <div className="space-y-4">
                        <label className="flex items-center justify-center w-full min-h-[120px] border-2 border-dashed border-card-border/50 rounded-lg hover:border-primary/50 transition-colors cursor-pointer bg-background/30">
                          <div className="flex flex-col items-center justify-center py-4">
                            <Upload className="w-6 h-6 text-muted-foreground mb-2" />
                            <p className="text-sm text-muted-foreground text-center px-4">
                              {fileName ? fileName : "Click to upload .csv, .xlsx, or .xls files"}
                            </p>
                          </div>
                          <input
                            type="file"
                            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                            onChange={handleFileUpload}
                            className="hidden"
                          />
                        </label>
                        {recipientsList.length > 0 && (
                          <div className="text-sm text-green-500 font-medium bg-green-500/10 p-3 rounded-md border border-green-500/20">
                            ✓ {recipientsList.length} valid email recipients extracted.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 mb-8">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <Target className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold">Campaign Context</h2>
                        <p className="text-sm text-muted-foreground">What is the high-level objective?</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label htmlFor="campaignName" className="block text-sm font-medium mb-2">Campaign Name</label>
                        <input
                          id="campaignName"
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="e.g. Q3 Founders Outreach"
                          className="w-full bg-background/50 border border-card-border rounded-md px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-mono text-sm"
                        />
                      </div>
                      <div>
                        <label htmlFor="primaryGoal" className="block text-sm font-medium mb-2">Primary Goal</label>
                        <div className="relative">
                          <select
                            id="primaryGoal"
                            value={formData.goal}
                            onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
                            className="w-full bg-background/50 border border-card-border rounded-md px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-sm appearance-none"
                          >
                            <option>Lead Generation</option>
                            <option>Brand Awareness</option>
                            <option>Product Launch</option>
                            <option>Newsletter Growth</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 mb-8">
                      <div className="w-10 h-10 rounded-lg bg-secondary/10 border border-secondary/20 flex items-center justify-center">
                        <Users className="w-5 h-5 text-secondary" />
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold">Target Audience</h2>
                        <p className="text-sm text-muted-foreground">Who are we deploying agents against?</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label htmlFor="niche" className="block text-sm font-medium mb-2">Niche / ICP Description</label>
                        <textarea
                          id="niche"
                          rows={4}
                          value={formData.niche}
                          onChange={(e) => setFormData({ ...formData, niche: e.target.value })}
                          placeholder="e.g. SaaS founders doing $10k-$50k MRR looking to scale organic acquisition..."
                          className="w-full bg-background/50 border border-card-border rounded-md px-4 py-3 focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all text-sm font-mono resize-none"
                        ></textarea>
                      </div>
                    </div>
                  </div>
                )}

                {step === 4 && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 mb-8">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/20">
                        <Sparkles className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold">Value Proposition</h2>
                        <p className="text-sm text-muted-foreground">What makes the offer irresistible?</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label htmlFor="valueProp" className="block text-sm font-medium mb-2">Core Product / Offer</label>
                        <textarea
                          id="valueProp"
                          rows={4}
                          value={formData.valueProp}
                          onChange={(e) => setFormData({ ...formData, valueProp: e.target.value })}
                          placeholder="e.g. AI Marketing agent that automates outreach, reducing CAC by 40% while 10x'ing touchpoints..."
                          className="w-full bg-background/50 border border-card-border rounded-md px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-sm font-mono resize-none"
                        ></textarea>
                      </div>
                    </div>
                  </div>
                )}

                {step === 5 && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 mb-8">
                      <div className="w-10 h-10 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center shadow-lg">
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold">Review & Activate</h2>
                        <p className="text-sm text-muted-foreground">Review the agent&apos;s generated copy before deploying.</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label htmlFor="generatedSubject" className="block text-sm font-medium mb-2">Generated Subject</label>
                        <input
                          id="generatedSubject"
                          type="text"
                          value={generatedSubject}
                          onChange={(e) => setGeneratedSubject(e.target.value)}
                          className="w-full bg-background/50 border border-card-border rounded-md px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-sm font-mono mb-4"
                        />
                        <label htmlFor="generatedCopy" className="block text-sm font-medium mb-2">Generated Outreach Body</label>
                        <textarea
                          id="generatedCopy"
                          rows={6}
                          value={generatedCopy}
                          onChange={(e) => setGeneratedCopy(e.target.value)}
                          className="w-full bg-background/50 border border-card-border rounded-md px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-sm font-mono resize-none"
                        ></textarea>
                      </div>
                      <div className="pt-4 border-t border-card-border/50">
                        <div className="flex items-center gap-2 p-3 rounded-md bg-card/10 border border-card-border/50">
                          <Send className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">
                            📧 <strong>{recipientsList.length}</strong> recipients ready to receive this email
                            {recipientsList.length === 0 && (
                              <span className="text-orange-400 ml-1"> — go back to Step 1 to find leads</span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Navigation Buttons */}
                <div className="mt-10 pt-6 border-t border-card-border/50 flex justify-between items-center">
                  <button
                    onClick={() => setStep(Math.max(1, step - 1))}
                    disabled={step === 1 || isSaving}
                    className={`px-6 py-2 rounded-md font-medium transition-all ${step === 1 ? 'opacity-0 pointer-events-none' : 'text-muted-foreground hover:text-foreground hover:bg-card/50 disabled:opacity-50'}`}
                  >
                    Previous
                  </button>

                  {step < 4 ? (
                    <button
                      onClick={() => setStep(step + 1)}
                      disabled={step === 1 && recipientsList.length === 0}
                      className="bg-foreground text-background hover:bg-white/90 px-6 py-2 rounded-md font-medium transition-all flex items-center gap-3 disabled:opacity-50"
                    >
                      Continue
                      <span className="text-[10px] uppercase font-mono tracking-widest opacity-60 flex items-center gap-1"><kbd className="bg-background/10 px-1.5 py-0.5 rounded">Ctrl</kbd>+<kbd className="bg-background/10 px-1.5 py-0.5 rounded">Enter</kbd></span>
                    </button>
                  ) : step === 4 ? (
                    <button
                      onClick={handleGenerate}
                      className="bg-primary hover:bg-primary-hover text-primary-foreground px-8 py-2 rounded-md font-medium flex items-center gap-3 transition-all shadow-[0_0_20px_-5px_var(--tw-shadow-color)] shadow-primary/40 relative overflow-hidden group"
                    >
                      <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
                      <Rocket className="w-4 h-4 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
                      Generate Strategy
                      <span className="text-[10px] uppercase font-mono tracking-widest opacity-80 flex items-center gap-1 border-l border-primary-foreground/30 pl-3 ml-1"><kbd>Ctrl</kbd>+<kbd>Enter</kbd></span>
                    </button>
                  ) : (
                    <button
                      onClick={handleActivate}
                      disabled={isSaving}
                      className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-8 py-2 rounded-md font-medium flex items-center gap-3 transition-all shadow-lg shadow-green-600/30 relative overflow-hidden group"
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />}
                      {isSaving ? "Activating..." : "Save & Deploy Swarm"}
                      {!isSaving && <span className="text-[10px] uppercase font-mono tracking-widest opacity-80 flex items-center gap-1 border-l border-white/30 pl-3 ml-1"><kbd>Ctrl</kbd>+<kbd>Enter</kbd></span>}
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>
    </div>
  );
}

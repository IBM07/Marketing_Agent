"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Sparkles, Target, Rocket, Loader2, CheckCircle2, Users, Bot, Send, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setFileName(file.name);
    const reader = new FileReader();
    
    reader.onload = (evt) => {
      try {
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
        setStep(4);
      } else {
        alert(data || "Failed to generate copy");
      }
    } catch (e) {
      console.error(e);
      alert("Error generating copy. Ensure Ollama is running.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleActivate = async () => {
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
      if (!campRes.ok) throw new Error("Failed to save campaign");
      const campaign = await campRes.json();

      if (recipientsList.length > 0) {
        await fetch("/api/campaigns/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            campaignId: campaign.id,
            recipients: recipientsList,
            subject: generatedSubject || `Action Required: Info on ${formData.name}`,
            content: generatedCopy,
          }),
        });
      }

      setIsSaving(false);
      setIsSuccess(true);
      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);
    } catch (e) {
      console.error(e);
      alert("Error saving campaign");
      setIsSaving(false);
    }
  };

  // Adjust progress bar logic for 4 steps now
  const progressPercentage = (step / 4) * 100;

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
             initial={{ width: "25%" }}
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
                  Connecting to local Ollama instance... <br />
                  Generating hyper-personalized email sequences...
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
                        <Target className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold">Campaign Context</h2>
                        <p className="text-sm text-muted-foreground">What is the high-level objective?</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Campaign Name</label>
                        <input 
                          type="text" 
                          value={formData.name}
                          onChange={(e) => setFormData({...formData, name: e.target.value})}
                          placeholder="e.g. Q3 Founders Outreach" 
                          className="w-full bg-background/50 border border-card-border rounded-md px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-mono text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Primary Goal</label>
                        <div className="relative">
                          <select 
                            value={formData.goal}
                            onChange={(e) => setFormData({...formData, goal: e.target.value})}
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

                {step === 2 && (
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
                        <label className="block text-sm font-medium mb-2">Niche / ICP Description</label>
                        <textarea 
                          rows={4}
                          value={formData.niche}
                          onChange={(e) => setFormData({...formData, niche: e.target.value})}
                          placeholder="e.g. SaaS founders doing $10k-$50k MRR looking to scale organic acquisition..." 
                          className="w-full bg-background/50 border border-card-border rounded-md px-4 py-3 focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all text-sm font-mono resize-none"
                        ></textarea>
                      </div>
                    </div>
                  </div>
                )}

                {step === 3 && (
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
                        <label className="block text-sm font-medium mb-2">Core Product / Offer</label>
                        <textarea 
                          rows={4}
                          value={formData.valueProp}
                          onChange={(e) => setFormData({...formData, valueProp: e.target.value})}
                          placeholder="e.g. AI Marketing agent that automates outreach, reducing CAC by 40% while 10x'ing touchpoints..." 
                          className="w-full bg-background/50 border border-card-border rounded-md px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-sm font-mono resize-none"
                        ></textarea>
                      </div>
                    </div>
                  </div>
                )}

                {step === 4 && (
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
                        <label className="block text-sm font-medium mb-2">Generated Subject</label>
                        <input 
                          type="text" 
                          value={generatedSubject}
                          onChange={(e) => setGeneratedSubject(e.target.value)}
                          className="w-full bg-background/50 border border-card-border rounded-md px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-sm font-mono mb-4"
                        />
                        <label className="block text-sm font-medium mb-2">Generated Outreach Body</label>
                        <textarea 
                          rows={6}
                          value={generatedCopy}
                          onChange={(e) => setGeneratedCopy(e.target.value)}
                          className="w-full bg-background/50 border border-card-border rounded-md px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-sm font-mono resize-none"
                        ></textarea>
                      </div>
                      <div className="pt-4 border-t border-card-border/50">
                        <label className="block text-sm font-medium mb-2 text-muted-foreground">Upload Recipients List (CSV, Excel)</label>
                        <div className="flex flex-col gap-4">
                          <label className="flex items-center justify-center w-full min-h-[100px] border-2 border-dashed border-card-border/50 rounded-lg hover:border-primary/50 transition-colors cursor-pointer bg-background/30">
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
                  
                  {step < 3 ? (
                    <button 
                      onClick={() => setStep(step + 1)}
                      className="bg-foreground text-background hover:bg-white/90 px-6 py-2 rounded-md font-medium transition-all"
                    >
                      Continue
                    </button>
                  ) : step === 3 ? (
                    <button 
                      onClick={handleGenerate}
                      className="bg-primary hover:bg-primary-hover text-primary-foreground px-8 py-2 rounded-md font-medium flex items-center gap-2 transition-all shadow-[0_0_20px_-5px_var(--tw-shadow-color)] shadow-primary/40 relative overflow-hidden group"
                    >
                      <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
                      <Rocket className="w-4 h-4 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
                      Generate Strategy
                    </button>
                  ) : (
                    <button 
                      onClick={handleActivate}
                      disabled={isSaving}
                      className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-8 py-2 rounded-md font-medium flex items-center gap-2 transition-all shadow-lg shadow-green-600/30 relative overflow-hidden group"
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />}
                      {isSaving ? "Activating..." : "Save & Deploy Swarm"}
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

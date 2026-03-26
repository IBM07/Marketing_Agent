"use client";

import Link from "next/link";
import { ArrowRight, Play, Terminal, BarChart3, Target, Sparkles } from "lucide-react";
import dynamic from "next/dynamic";
const HeroScene = dynamic(() => import("@/components/canvas/HeroScene"), { ssr: false });
import { motion } from "framer-motion";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between overflow-x-hidden pt-32 relative">
      <HeroScene />
      <div className="absolute top-0 z-[-2] h-screen w-screen bg-background bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(168,85,247,0.15),rgba(255,255,255,0))]"></div>
      
      {/* Background Grid */}
      <div className="absolute top-0 z-[-1] h-[100vh] w-full bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>

      {/* Navigation */}
      <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 px-6">
        <header className="w-full max-w-7xl flex items-center justify-between px-6 py-4 rounded-2xl bg-[#050505]/95 shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur-xl border border-card-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight">HYPERDRIVE AI</span>
          </div>
          
          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground font-medium">
            <Link href="#features" className="hover:text-foreground transition-colors">Features</Link>
            <Link href="#solutions" className="hover:text-foreground transition-colors">Solutions</Link>
            <Link href="#pricing" className="hover:text-foreground transition-colors">Pricing</Link>
            <Link href="#docs" className="hover:text-foreground transition-colors">Docs</Link>
          </nav>

          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-sm font-medium px-4 py-2 rounded-md border border-card-border hover:bg-card hover:text-foreground transition-colors text-muted-foreground">
              Login
            </Link>
          </div>
        </header>
      </div>

      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center text-center px-6 max-w-5xl z-10 my-12 min-h-[60vh] relative">
        {/* Subtle dark radial anchor behind text */}
        <div className="absolute inset-0 z-[-1] bg-[radial-gradient(ellipse_70%_60%_at_50%_50%,rgba(0,0,0,0.7)_0%,rgba(0,0,0,0)_100%)] pointer-events-none"></div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-card-border bg-card/50 backdrop-blur-sm mb-8"
        >
          <span className="w-2 h-2 rounded-full bg-secondary"></span>
          <span className="text-xs font-medium text-secondary tracking-widest uppercase">Next-Gen Marketing Infrastructure</span>
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter mb-6 drop-shadow-[0_4px_24px_rgba(0,0,0,1)]"
        >
          Autonomous AI <br />
          <span className="text-gradient">Marketing on Steroids</span>
        </motion.h1>
        
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
          className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-10 text-balance leading-relaxed drop-shadow-[0_2px_12px_rgba(0,0,0,1)] text-[#e5e5e5]"
        >
          Deploy agents that research, create, and optimize your entire growth engine 24/7. No prompts required.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6, ease: "easeOut" }}
          className="flex flex-col sm:flex-row items-center gap-4"
        >
          <Link href="/dashboard" className="px-8 py-4 rounded-md bg-primary hover:bg-primary-hover text-primary-foreground font-medium flex items-center gap-2 transition-all shadow-[0_0_30px_-5px_var(--tw-shadow-color)] shadow-primary/30">
            Deploy Agent
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="#demo" className="px-8 py-4 rounded-md border border-secondary text-secondary hover:bg-secondary/10 font-medium flex items-center gap-2 transition-colors">
            View Demo
            <Play className="w-4 h-4" />
          </Link>
        </motion.div>
      </section>

      {/* Partners / Social Proof */}
      <section className="w-full border-y border-card-border/50 bg-background/50 backdrop-blur-md py-8 mt-24 z-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col items-center">
          <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-6">Powering 500+ High-Growth Teams</p>
          <div className="flex flex-wrap justify-center gap-8 md:gap-16 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
            <span className="text-xl font-bold tracking-widest text-muted-foreground">TECHNO</span>
            <span className="text-xl font-black italic tracking-tighter text-muted-foreground">HYPERDRIVE</span>
            <span className="text-xl font-medium tracking-widest text-muted-foreground">QUANTUM</span>
            <span className="text-xl font-bold tracking-wide text-muted-foreground">CYBERNET</span>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="w-full max-w-7xl mx-auto px-6 py-32 z-10" id="features">
        <div className="mb-16">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">Engineered for Velocity</h2>
          <p className="text-muted-foreground max-w-xl text-lg">
            A full-stack marketing suite that operates independently of human intervention.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Feature Card 1 - Local AI */}
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="col-span-1 border border-card-border bg-background/85 backdrop-blur-3xl rounded-xl p-8 shadow-2xl lg:col-span-7 flex flex-col justify-between overflow-hidden relative group"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            
            <div className="w-full rounded-md bg-background border border-card-border p-4 mb-8 font-mono text-xs sm:text-sm shadow-xl relative z-10">
              <div className="flex items-center gap-2 mb-4 border-b border-card-border pb-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-muted-foreground ml-2">hyper-drive-core.exe</span>
              </div>
              <div className="text-secondary flex gap-2"><span>&gt;</span> <span className="animate-pulse">initializing_marketing_swarm...|</span></div>
              <div className="text-primary mt-2 flex gap-2"><span>&gt;</span> <span>Optimizing local LLM context: 128k tokens</span></div>
              <div className="text-muted-foreground mt-2 flex gap-2"><span>&gt;</span> <span>Targeting 5,000 ICP leads via LinkedIn API...</span></div>
              <div className="text-green-500 mt-2 flex gap-2"><span>&gt;</span> <span>Conversion rate uplift: +24%</span></div>
            </div>

            <div className="relative z-10 mt-auto">
              <h3 className="text-2xl font-bold mb-2 flex items-center gap-3">
                <Terminal className="text-primary w-6 h-6" /> Local AI Power
              </h3>
              <p className="text-muted-foreground">
                Run proprietary models locally or in the cloud. Zero data leakage, maximum inference speed.
              </p>
            </div>
          </motion.div>

          {/* Feature Card 2 - Omnichannel */}
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="col-span-1 border border-card-border bg-background/85 backdrop-blur-3xl rounded-xl p-8 shadow-2xl lg:col-span-5 flex flex-col justify-between relative group"
          >
             <div className="absolute inset-0 bg-gradient-to-br from-secondary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
             
             <div className="mb-8 w-full h-32 flex flex-col justify-center gap-4 relative z-10">
                <div className="h-2 w-3/4 bg-primary/20 rounded-full overflow-hidden">
                  <div className="h-full bg-primary w-[80%]"></div>
                </div>
                <div className="h-2 w-full bg-secondary/20 rounded-full overflow-hidden">
                  <div className="h-full bg-secondary w-[60%] ml-[20%]"></div>
                </div>
                <div className="h-2 w-2/3 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-white w-[90%]"></div>
                </div>
             </div>

             <div className="relative z-10 mt-auto">
              <h3 className="text-2xl font-bold mb-2 flex items-center gap-3">
                <BarChart3 className="text-secondary w-6 h-6" /> Omnichannel
              </h3>
              <p className="text-muted-foreground">
                Synchronize social, email, and ad spends through a single neural brain.
              </p>
            </div>
          </motion.div>

          {/* Feature Card 3 - Personalization */}
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="col-span-1 border border-card-border bg-background/85 backdrop-blur-3xl rounded-xl p-8 shadow-2xl lg:col-span-6 flex flex-col justify-between relative group"
          >
             <div className="absolute inset-0 bg-gradient-to-br from-secondary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
             
             <div className="mb-12 h-32 flex items-center justify-center relative z-10">
               <div className="relative w-16 h-16 rounded-full border-2 border-secondary flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-secondary"></div>
                  <div className="absolute -left-12 w-12 h-[1px] bg-secondary/50"></div>
                  <div className="absolute -top-12 w-[1px] h-12 bg-secondary/50"></div>
                  <div className="absolute -bottom-12 w-[1px] h-12 bg-secondary/50"></div>
               </div>
             </div>

             <div className="relative z-10 mt-auto">
              <h3 className="text-2xl font-bold mb-2 flex items-center gap-3">
                <Target className="text-secondary w-6 h-6" /> Hyper-Personalization
              </h3>
              <p className="text-muted-foreground">
                Target segments of one. Mapping 400+ data points per user to generate bespoke experiences.
              </p>
            </div>
          </motion.div>

          {/* Feature Card 4 - ROI */}
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="col-span-1 border border-card-border bg-background/85 backdrop-blur-3xl rounded-xl p-8 shadow-2xl lg:col-span-6 flex flex-col justify-between relative group"
          >
             <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
             
             <div className="mb-12 h-32 flex items-end justify-center gap-2 relative z-10">
                {[40, 60, 45, 80, 55, 90, 70].map((height, i) => (
                  <div 
                    key={i} 
                    className="w-4 rounded-t-sm"
                    style={{ 
                      height: `${height}%`,
                      backgroundColor: i % 2 === 0 ? 'var(--primary)' : 'var(--secondary)'
                    }}
                  ></div>
                ))}
             </div>

             <div className="relative z-10 mt-auto">
              <h3 className="text-2xl font-bold mb-2 flex items-center gap-3">
                <BarChart3 className="text-primary w-6 h-6" /> Predictive ROI
              </h3>
              <p className="text-muted-foreground">
                Know your CAC before you spend a cent. Our model forecasts revenue trajectories with 94% accuracy.
              </p>
            </div>
          </motion.div>

        </div>
      </section>

      {/* Footer */}
      <div className="w-full px-6 pb-6 mt-12 z-10 relative">
        <footer className="w-full max-w-7xl mx-auto border border-card-border py-8 bg-[#050505]/95 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
          <div className="px-6 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <Sparkles className="w-3 h-3 text-white" />
              </div>
              <span className="font-bold text-sm tracking-tight text-muted-foreground uppercase">HyperDrive AI</span>
            </div>
            
            <div className="flex gap-6 text-sm text-muted-foreground">
              <Link href="#" className="hover:text-foreground transition-colors">Privacy</Link>
              <Link href="#" className="hover:text-foreground transition-colors">Terms</Link>
              <Link href="#" className="hover:text-foreground transition-colors">Twitter (X)</Link>
              <Link href="#" className="hover:text-foreground transition-colors">LinkedIn</Link>
            </div>

            <p className="text-sm text-muted-foreground">
              © 2024. Powered by <span className="font-bold text-secondary">HyperDrive AI</span>.
            </p>
          </div>
        </footer>
      </div>
    </main>
  );
}

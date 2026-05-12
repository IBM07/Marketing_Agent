"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Megaphone, BarChart, Settings, Zap, Menu, X } from "lucide-react";
import { UserButton } from "@clerk/nextjs";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navigation = [
    { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
    { name: "Campaigns", href: "/dashboard/campaigns", icon: Megaphone },
    { name: "Analytics", href: "/dashboard/analytics", icon: BarChart },
    { name: "Settings", href: "/dashboard/settings", icon: Settings },
  ];

  return (
    <div className="flex min-h-screen bg-[#000]">
      {/* Sidebar background grid */}
      <div className="fixed inset-0 z-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]"></div>

      {/* Sidebar (Desktop) */}
      <aside className="w-64 border-r border-card-border/50 bg-card/10 backdrop-blur-xl z-20 flex-col hidden md:flex">
        <div className="h-16 flex items-center px-6 border-b border-card-border/50">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <Zap className="w-3 h-3 text-white" />
            </div>
            <span className="font-bold tracking-tight">HyperDrive</span>
          </Link>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-2">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md transition-all ${
                  isActive 
                    ? "bg-primary/10 text-primary border border-primary/20" 
                    : "text-muted-foreground hover:bg-card/40 hover:text-foreground"
                }`}
              >
                <item.icon className="w-4 h-4" />
                <span className="text-sm font-medium">{item.name}</span>
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
          <aside className="w-64 border-r border-card-border/50 bg-background relative z-50 flex flex-col h-full">
            <div className="h-16 flex items-center justify-between px-6 border-b border-card-border/50">
              <Link href="/" className="flex items-center gap-2" onClick={() => setIsMobileMenuOpen(false)}>
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                  <Zap className="w-3 h-3 text-white" />
                </div>
                <span className="font-bold tracking-tight">HyperDrive</span>
              </Link>
              <button onClick={() => setIsMobileMenuOpen(false)} aria-label="Close menu" className="p-2">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <nav className="flex-1 px-4 py-6 space-y-2">
              {navigation.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md transition-all ${
                      isActive 
                        ? "bg-primary/10 text-primary border border-primary/20" 
                        : "text-muted-foreground hover:bg-card/40 hover:text-foreground"
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{item.name}</span>
                  </Link>
                )
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 relative z-10 flex flex-col min-h-screen">
        <header className="h-16 border-b border-card-border/50 bg-card/10 backdrop-blur-xl flex items-center justify-between px-6 sticky top-0 md:justify-end z-30">
           {/* Mobile Menu Toggle */}
           <button 
             className="md:hidden p-2 text-muted-foreground hover:text-foreground hover:bg-card/40 rounded-md transition-colors"
             onClick={() => setIsMobileMenuOpen(true)}
             aria-label="Open menu"
           >
             <Menu className="w-6 h-6" />
           </button>
           <div className="flex items-center gap-4">
              <UserButton />
           </div>
        </header>
        <div className="flex-1 p-6 lg:p-10 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

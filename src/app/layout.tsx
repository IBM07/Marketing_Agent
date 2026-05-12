import type { Metadata } from "next";
import { Inter, Fira_Code } from "next/font/google";
import "./globals.css";
import SmoothScroll from "@/components/providers/SmoothScroll";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const firaCode = Fira_Code({
  subsets: ["latin"],
  variable: "--font-fira-code",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: "HyperDrive AI | Autonomous Marketing on Steroids",
  description: "Deploy agents that research, create, and optimize your entire growth engine 24/7. No prompts required.",
  openGraph: {
    title: "HyperDrive AI | Autonomous Marketing on Steroids",
    description: "Deploy agents that research, create, and optimize your entire growth engine 24/7. No prompts required.",
    url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    siteName: "HyperDrive AI",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "HyperDrive AI | Autonomous Marketing on Steroids",
    description: "Deploy agents that research, create, and optimize your entire growth engine 24/7. No prompts required.",
  },
  alternates: {
    canonical: "/",
  },
};

import { ClerkProvider } from '@clerk/nextjs'

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className="dark">
        <body className={`${inter.variable} ${firaCode.variable} font-sans antialiased min-h-screen bg-background text-foreground`}>
          <SmoothScroll>
            {children}
          </SmoothScroll>
          <Analytics />
          <SpeedInsights />
        </body>
      </html>
    </ClerkProvider>
  );
}

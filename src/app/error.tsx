"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center bg-background">
      <AlertTriangle className="w-16 h-16 text-destructive mb-6" />
      <h2 className="text-3xl font-bold tracking-tight mb-3">Application Error</h2>
      <p className="text-muted-foreground mb-8 max-w-md">
        We encountered a critical error. Please try refreshing the page or navigating back home.
      </p>
      <div className="flex gap-4">
        <button
          onClick={() => reset()}
          className="px-6 py-2 bg-primary text-primary-foreground font-medium rounded-md hover:bg-primary/90 transition-colors"
        >
          Try again
        </button>
        <Link
          href="/"
          className="px-6 py-2 bg-secondary text-secondary-foreground font-medium rounded-md hover:bg-secondary/80 transition-colors"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}

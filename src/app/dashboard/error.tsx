"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function DashboardError({
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
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
      <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
        <AlertTriangle className="w-8 h-8 text-destructive" />
      </div>
      <h2 className="text-2xl font-semibold mb-2">Dashboard Error</h2>
      <p className="text-muted-foreground mb-6 max-w-md">
        Unable to load this section of the dashboard. This might be a temporary issue.
      </p>
      <button
        onClick={() => reset()}
        className="px-4 py-2 bg-primary/10 text-primary border border-primary/20 font-medium rounded-md hover:bg-primary/20 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}

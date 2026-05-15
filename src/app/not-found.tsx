import Link from "next/link";
import { Ghost } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center bg-background">
      <Ghost className="w-20 h-20 text-muted-foreground/30 mb-6" />
      <h2 className="text-4xl font-bold tracking-tight mb-3">404 - Not Found</h2>
      <p className="text-muted-foreground mb-8 max-w-md text-lg">
        The page you are looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/"
        className="px-6 py-3 bg-primary text-primary-foreground font-medium rounded-md hover:bg-primary/90 transition-colors"
      >
        Return Home
      </Link>
    </div>
  );
}

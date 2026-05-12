export default function DashboardLoading() {
  return (
    <div className="flex-1 w-full h-[60vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
        <p className="text-sm text-muted-foreground animate-pulse">Loading dashboard...</p>
      </div>
    </div>
  );
}

export function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-6 w-40 bg-bg-elevated rounded-md" />
          <div className="h-3 w-56 bg-bg-surface rounded-md mt-2" />
        </div>
      </div>

      {/* Stat cards skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-bg-panel border border-border-subtle rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 bg-bg-surface rounded-lg" />
              <div className="w-10 h-4 bg-bg-surface rounded-full" />
            </div>
            <div className="h-7 w-12 bg-bg-elevated rounded-md mb-1" />
            <div className="h-3 w-20 bg-bg-surface rounded-md" />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="bg-bg-panel border border-border-subtle rounded-xl overflow-hidden">
        <div className="h-10 bg-bg-surface/50 border-b border-border-subtle" />
        {[...Array(rows)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-border-subtle last:border-0">
            <div className="w-8 h-8 bg-bg-surface rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-32 bg-bg-elevated rounded-md" />
              <div className="h-2.5 w-48 bg-bg-surface rounded-md" />
            </div>
            <div className="h-3 w-16 bg-bg-surface rounded-md" />
            <div className="h-5 w-14 bg-bg-surface rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center pt-32 pb-20">
      <div className="relative w-20 h-20">
        <div className="absolute inset-0 border-[3px] border-accent/10 border-t-accent rounded-full animate-spin" />
        <div className="absolute inset-4 flex items-center justify-center">
          <div className="relative w-10 h-10">
            <span className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-accent" />
            <span className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-accent" />
            <span className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-accent" />
            <span className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-accent" />
            <svg width="24" height="24" viewBox="0 0 14 14" fill="none" className="absolute inset-0 m-auto">
              <rect x="3" y="1" width="8" height="12" rx="1" stroke="#ED6103" strokeWidth="1.5" />
              <line x1="5" y1="4.5" x2="9" y2="4.5" stroke="#ED6103" strokeWidth="1.2" strokeLinecap="round" />
              <line x1="5" y1="6.5" x2="9" y2="6.5" stroke="#ED6103" strokeWidth="1.2" strokeLinecap="round" />
              <line x1="5" y1="8.5" x2="7.5" y2="8.5" stroke="#ED6103" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LoadingPage() {
  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-24 h-24">
          <div className="absolute inset-0 border-[3px] border-accent/10 border-t-accent rounded-full animate-spin" />
          <div className="absolute inset-4 flex items-center justify-center">
            <div className="relative w-12 h-12">
              <span className="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-accent" />
              <span className="absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2 border-accent" />
              <span className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2 border-accent" />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 border-accent" />
              <svg width="32" height="32" viewBox="0 0 14 14" fill="none" className="absolute inset-0 m-auto">
                <rect x="3" y="1" width="8" height="12" rx="1" stroke="#ED6103" strokeWidth="1.5" />
                <line x1="5" y1="4.5" x2="9" y2="4.5" stroke="#ED6103" strokeWidth="1.2" strokeLinecap="round" />
                <line x1="5" y1="6.5" x2="9" y2="6.5" stroke="#ED6103" strokeWidth="1.2" strokeLinecap="round" />
                <line x1="5" y1="8.5" x2="7.5" y2="8.5" stroke="#ED6103" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        </div>
        <span className="text-[13px] text-text-muted font-medium">Loading...</span>
      </div>
    </div>
  );
}

import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("skeleton-shimmer rounded-xl", className)} {...props} />;
}

function BoardSkeleton() {
  return (
    <div className="w-full max-w-sm rounded-3xl border p-5 shadow-sm" style={{ background: "rgba(255,255,255,0.78)", borderColor: "var(--border)", backdropFilter: "blur(12px)" }}>
      <div className="flex items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-2xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-2.5 w-1/2" />
        </div>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2">
        <Skeleton className="h-16" />
        <Skeleton className="h-24" />
        <Skeleton className="h-20" />
        <Skeleton className="h-24" />
        <Skeleton className="h-16" />
        <Skeleton className="h-20" />
      </div>
    </div>
  );
}

export { BoardSkeleton, Skeleton };

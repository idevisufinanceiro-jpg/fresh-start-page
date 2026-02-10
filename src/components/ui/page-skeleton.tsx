import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Table Skeleton - for data tables
export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex gap-4 pb-2 border-b">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4 py-2">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton 
              key={colIndex} 
              className={cn("h-4 flex-1", colIndex === 0 && "max-w-[200px]")} 
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// Card Skeleton - for metric cards
export function CardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-4 rounded-lg border bg-card">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-20" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Chart Skeleton - for graphs
export function ChartSkeleton({ height = "h-64" }: { height?: string }) {
  return (
    <div className={cn("rounded-lg border bg-card p-4", height)}>
      <div className="flex items-center gap-2 mb-4">
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="flex items-end gap-2 h-[calc(100%-40px)]">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton 
            key={i} 
            className="flex-1 rounded-t" 
            style={{ height: `${30 + Math.random() * 60}%` }} 
          />
        ))}
      </div>
    </div>
  );
}

// Kanban Skeleton - for kanban boards
export function KanbanSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {Array.from({ length: columns }).map((_, colIndex) => (
        <div key={colIndex} className="flex-shrink-0 w-72 space-y-3">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-5 rounded-full ml-auto" />
          </div>
          {Array.from({ length: 2 + Math.floor(Math.random() * 2) }).map((_, cardIndex) => (
            <div key={cardIndex} className="p-3 rounded-lg border bg-card space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-3/4" />
              <div className="flex gap-2 pt-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-12 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// List Skeleton - for simple lists
export function ListSkeleton({ items = 5 }: { items?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-lg border">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-8 w-8 rounded" />
        </div>
      ))}
    </div>
  );
}

// Dashboard Skeleton - for full dashboard page
export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Stats Cards */}
      <CardSkeleton count={4} />
      
      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
      
      {/* Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <Skeleton className="h-5 w-40 mb-4" />
          <ListSkeleton items={3} />
        </div>
        <div className="rounded-lg border bg-card p-4">
          <Skeleton className="h-5 w-40 mb-4" />
          <ListSkeleton items={3} />
        </div>
      </div>
    </div>
  );
}

// Mobile Dashboard Skeleton
export function MobileDashboardSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-4 rounded-xl bg-card border">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-1">
                <Skeleton className="h-2 w-12" />
                <Skeleton className="h-5 w-16" />
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Break-even Card */}
      <div className="p-4 rounded-xl bg-card border space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-1 flex-1">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        </div>
      </div>
      
      {/* Lists */}
      <div className="rounded-xl bg-card border p-4 space-y-3">
        <Skeleton className="h-4 w-32" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-2 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Tasks Page Skeleton
export function TasksSkeleton({ viewMode = "table" }: { viewMode?: "table" | "kanban" | "list" }) {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-20" />
        </div>
      </div>
      
      {/* Stats */}
      <CardSkeleton count={4} />
      
      {/* Quick Create */}
      <Skeleton className="h-10 w-full rounded-lg" />
      
      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-32" />
      </div>
      
      {/* Content */}
      {viewMode === "kanban" ? (
        <KanbanSkeleton />
      ) : (
        <TableSkeleton rows={6} columns={5} />
      )}
    </div>
  );
}

// Reports Skeleton
export function ReportsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Filters Card */}
      <div className="p-4 rounded-lg border bg-card">
        <div className="flex flex-wrap gap-4">
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-9 w-48" />
        </div>
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-4 rounded-lg border bg-card space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-2 w-16" />
          </div>
        ))}
      </div>
      
      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartSkeleton height="h-72" />
        <ChartSkeleton height="h-72" />
      </div>
    </div>
  );
}

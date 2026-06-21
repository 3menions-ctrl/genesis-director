import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "text" | "circular" | "rectangular" | "card";
  shimmer?: boolean;
}

function Skeleton({ 
  className, 
  variant = "default",
  shimmer = true,
  ...props 
}: SkeletonProps) {
  const baseClasses = "relative overflow-hidden bg-muted";
  
  const variantClasses = {
    default: "rounded-md",
    text: "rounded h-4 w-full",
    circular: "rounded-full aspect-square",
    rectangular: "rounded-lg",
    card: "rounded-2xl",
  };

  const shimmerClasses = shimmer 
    ? "after:absolute after:inset-0 after:translate-x-[-100%] after:bg-gradient-to-r after:from-transparent after:via-white/20 after:to-transparent after:animate-[shimmer_2s_infinite]"
    : "animate-pulse";

  return (
    <div 
      className={cn(
        baseClasses,
        variantClasses[variant],
        shimmerClasses,
        className
      )} 
      {...props} 
    />
  );
}

// Pre-composed skeleton patterns for common use cases
function SkeletonCard({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("space-y-4 p-6", className)} {...props}>
      <Skeleton variant="rectangular" className="h-40 w-full" />
      <div className="space-y-2">
        <Skeleton variant="text" className="h-5 w-3/4" />
        <Skeleton variant="text" className="h-4 w-1/2" />
      </div>
    </div>
  );
}

function SkeletonAvatar({ className, size = "md", ...props }: React.HTMLAttributes<HTMLDivElement> & { size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-14 w-14",
  };

  return (
    <Skeleton 
      variant="circular" 
      className={cn(sizeClasses[size], className)} 
      {...props} 
    />
  );
}

function SkeletonText({ 
  lines = 3, 
  className,
  ...props 
}: React.HTMLAttributes<HTMLDivElement> & { lines?: number }) {
  return (
    <div className={cn("space-y-2", className)} {...props}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton 
          key={i} 
          variant="text" 
          className={cn(
            "h-4",
            i === lines - 1 ? "w-2/3" : "w-full"
          )}
          style={{ animationDelay: `${i * 100}ms` }}
        />
      ))}
    </div>
  );
}

function SkeletonButton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <Skeleton 
      className={cn("h-10 w-24 rounded-xl", className)} 
      {...props} 
    />
  );
}

function SkeletonInput({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <Skeleton 
      className={cn("h-10 w-full rounded-lg", className)} 
      {...props} 
    />
  );
}

function SkeletonVideo({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("relative aspect-video", className)} {...props}>
      <Skeleton variant="rectangular" className="absolute inset-0" />
      <div className="absolute inset-0 flex items-center justify-center">
        <Skeleton variant="circular" className="h-16 w-16 opacity-50" />
      </div>
    </div>
  );
}

function SkeletonTable({ 
  rows = 5, 
  columns = 4,
  className,
  ...props 
}: React.HTMLAttributes<HTMLDivElement> & { rows?: number; columns?: number }) {
  return (
    <div className={cn("space-y-3", className)} {...props}>
      {/* Header */}
      <div className="flex gap-4 pb-2 border-b border-border">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div 
          key={rowIndex} 
          className="flex gap-4"
          style={{ animationDelay: `${rowIndex * 50}ms` }}
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton 
              key={colIndex} 
              className="h-4 flex-1" 
              style={{ animationDelay: `${(rowIndex * columns + colIndex) * 25}ms` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export { 
  Skeleton, 
  SkeletonCard, 
  SkeletonAvatar, 
  SkeletonText, 
  SkeletonButton, 
  SkeletonInput,
  SkeletonVideo,
  SkeletonTable
};

import { Skeleton } from "@/components/ui/skeleton";

export function PostSkeleton() {
  return (
    <article className="border-b px-4 py-3 flex flex-col relative w-full">
      {/* Header Row */}
      <div className="flex items-start mb-2 gap-2">
        <Skeleton className="w-10 h-10 rounded-full shrink-0" />
        <div className="flex flex-col gap-1 w-full mt-1">
          <div className="flex gap-2 items-center">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-3 w-24" />
        </div>
      </div>

      {/* Content wrapper */}
      <div className="flex flex-col min-w-0 mt-2 gap-2">
        {/* Body Text */}
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-[85%]" />
        <Skeleton className="h-4 w-[60%]" />

        {/* Actions Skeleton */}
        <div className="flex justify-between items-center mt-5">
          <Skeleton className="h-5 w-14" />
          <Skeleton className="h-5 w-14" />
          <Skeleton className="h-5 w-14" />
          <Skeleton className="h-5 w-14" />
        </div>
      </div>
    </article>
  );
}

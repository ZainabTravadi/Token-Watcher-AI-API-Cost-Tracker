import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

export function PageLoadingState({ rows = 3 }: { rows?: number }) {
  return (
    <div className="min-h-[220px] space-y-5">
      <div className="border-t border-hairline pt-4">
        <Skeleton className="h-9 w-72" />
      </div>
      <div className="grid grid-cols-1 gap-6 border-y border-hairline py-5 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="space-y-2 border-t border-hairline pt-3">
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} className="h-7 w-full" />
        ))}
      </div>
    </div>
  );
}

export function PageErrorState({ title, message }: { title: string; message: string }) {
  return (
    <Alert className="border-negative/40 bg-negative/5">
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

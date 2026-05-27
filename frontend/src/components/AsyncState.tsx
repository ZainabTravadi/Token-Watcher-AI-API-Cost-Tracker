import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

export function PageLoadingState({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-4 min-h-[220px]">
      <Skeleton className="h-10 w-72" />
      <div className="grid grid-cols-4 gap-8 pb-6">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} className="h-8 w-full" />
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
/* eslint-disable react-refresh/only-export-components */
import { AlertTriangle, CircleAlert, ShieldCheck, ShieldX } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { fmtUSD } from "@/lib/data";
import { cn } from "@/lib/utils";

export type BudgetAlertStatus = "healthy" | "near-threshold" | "threshold-reached" | "budget-exceeded" | "unavailable";

export interface BudgetAlertState {
  status: BudgetAlertStatus;
  statusLabel: string;
  statusDescription: string;
  spendToday: number;
  monthlyBudget: number;
  alertThresholdPercent: number;
  usagePercent: number | null;
  progressPercent: number;
}

export interface BudgetAlertInput {
  spendToday: number;
  monthlyBudget: number;
  alertThresholdPercent?: number | null;
}

export interface BudgetAlertCardProps extends BudgetAlertInput {
  className?: string;
}

const DEFAULT_ALERT_THRESHOLD = 80;
const NEAR_THRESHOLD_BUFFER = 10;

const clampPercent = (value: number): number => Math.min(100, Math.max(0, value));

const toFiniteNumber = (value: number, fallback = 0): number => (Number.isFinite(value) ? value : fallback);

const normalizeThresholdPercent = (value: number | null | undefined): number => {
  const threshold = toFiniteNumber(value ?? DEFAULT_ALERT_THRESHOLD, DEFAULT_ALERT_THRESHOLD);
  return Math.min(100, Math.max(1, Math.round(threshold)));
};

export function deriveBudgetAlertState({ spendToday, monthlyBudget, alertThresholdPercent }: BudgetAlertInput): BudgetAlertState {
  const spend = Math.max(0, toFiniteNumber(spendToday));
  const budget = toFiniteNumber(monthlyBudget);
  const threshold = normalizeThresholdPercent(alertThresholdPercent);

  if (!(budget > 0)) {
    return {
      status: "unavailable",
      statusLabel: "Budget Unavailable",
      statusDescription: "Set a positive monthly budget to see budget health.",
      spendToday: spend,
      monthlyBudget: budget,
      alertThresholdPercent: threshold,
      usagePercent: null,
      progressPercent: 0,
    };
  }

  const usagePercent = (spend / budget) * 100;

  if (usagePercent > 100) {
    return {
      status: "budget-exceeded",
      statusLabel: "Budget Exceeded",
      statusDescription: "Monthly spend is above the configured budget.",
      spendToday: spend,
      monthlyBudget: budget,
      alertThresholdPercent: threshold,
      usagePercent,
      progressPercent: 100,
    };
  }

  if (usagePercent >= threshold) {
    return {
      status: "threshold-reached",
      statusLabel: "Threshold Reached",
      statusDescription: "Spend has reached the configured alert threshold.",
      spendToday: spend,
      monthlyBudget: budget,
      alertThresholdPercent: threshold,
      usagePercent,
      progressPercent: clampPercent(usagePercent),
    };
  }

  if (usagePercent >= Math.max(0, threshold - NEAR_THRESHOLD_BUFFER)) {
    return {
      status: "near-threshold",
      statusLabel: "Near Threshold",
      statusDescription: "Spend is close to the alert threshold.",
      spendToday: spend,
      monthlyBudget: budget,
      alertThresholdPercent: threshold,
      usagePercent,
      progressPercent: clampPercent(usagePercent),
    };
  }

  return {
    status: "healthy",
    statusLabel: "Healthy",
    statusDescription: "Budget is still comfortably below the alert threshold.",
    spendToday: spend,
    monthlyBudget: budget,
    alertThresholdPercent: threshold,
    usagePercent,
    progressPercent: clampPercent(usagePercent),
  };
}

function statusIcon(status: BudgetAlertStatus) {
  switch (status) {
    case "budget-exceeded":
      return <ShieldX className="h-4 w-4" />;
    case "threshold-reached":
      return <AlertTriangle className="h-4 w-4" />;
    case "near-threshold":
      return <CircleAlert className="h-4 w-4" />;
    case "healthy":
      return <ShieldCheck className="h-4 w-4" />;
    case "unavailable":
      return <CircleAlert className="h-4 w-4" />;
  }
}

function statusTone(status: BudgetAlertStatus): string {
  switch (status) {
    case "budget-exceeded":
      return "border-destructive/30 bg-destructive/5 text-destructive";
    case "threshold-reached":
      return "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400";
    case "near-threshold":
      return "border-yellow-500/30 bg-yellow-500/5 text-yellow-700 dark:text-yellow-400";
    case "healthy":
      return "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400";
    case "unavailable":
      return "border-muted-foreground/20 bg-muted/30 text-muted-foreground";
  }
}

function statusBadgeVariant(status: BudgetAlertStatus): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "budget-exceeded":
      return "destructive";
    case "threshold-reached":
      return "default";
    case "near-threshold":
      return "secondary";
    case "healthy":
      return "outline";
    case "unavailable":
      return "outline";
  }
}

export function BudgetAlertCard({ spendToday, monthlyBudget, alertThresholdPercent, className }: BudgetAlertCardProps) {
  const state = deriveBudgetAlertState({ spendToday, monthlyBudget, alertThresholdPercent });
  const usageLabel = state.usagePercent === null ? "n/a" : `${Math.round(state.usagePercent)}%`;
  const thresholdLabel = `${state.alertThresholdPercent}%`;

  return (
    <Card className={cn("overflow-hidden border-hairline/80 shadow-sm", className)} data-status={state.status}>
      <CardHeader className={cn("space-y-4 border-b border-hairline/60", statusTone(state.status))}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 font-serif text-xl">
              {statusIcon(state.status)}
              Budget health
            </CardTitle>
            <CardDescription>Track spend against your monthly budget and alert threshold.</CardDescription>
          </div>
          <Badge variant={statusBadgeVariant(state.status)} className="whitespace-nowrap">
            {state.statusLabel}
          </Badge>
        </div>
        <p className="font-mono text-xs text-muted-foreground">
          Threshold {thresholdLabel} · Usage {usageLabel}
        </p>
      </CardHeader>

      <CardContent className="space-y-6 py-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-md border border-hairline/60 bg-background/60 p-4">
            <div className="label-mono mb-1">Current spend</div>
            <div className="font-serif text-2xl num">{fmtUSD(state.spendToday)}</div>
          </div>
          <div className="rounded-md border border-hairline/60 bg-background/60 p-4">
            <div className="label-mono mb-1">Monthly budget</div>
            <div className="font-serif text-2xl num">{fmtUSD(state.monthlyBudget)}</div>
          </div>
          <div className="rounded-md border border-hairline/60 bg-background/60 p-4">
            <div className="label-mono mb-1">Usage</div>
            <div className="font-serif text-2xl num">{usageLabel}</div>
          </div>
          <div className="rounded-md border border-hairline/60 bg-background/60 p-4">
            <div className="label-mono mb-1">Alert threshold</div>
            <div className="font-serif text-2xl num">{thresholdLabel}</div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
            <span>Budget usage</span>
            <span>{state.statusDescription}</span>
          </div>
          <Progress value={state.progressPercent} className={cn("h-2", state.status === "budget-exceeded" ? "bg-destructive/10" : undefined)} />
          <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
            <span>{state.statusLabel}</span>
            <span>{state.usagePercent === null ? "Budget unavailable" : `${Math.round(state.usagePercent)}% of budget used`}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

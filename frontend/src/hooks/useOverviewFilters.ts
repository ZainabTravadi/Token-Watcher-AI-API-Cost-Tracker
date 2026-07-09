import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { TelemetryRow } from "@/lib/api";
import { formatLocalDateInputValue } from "@/lib/dates";

export type DateRangePreset = "today" | "yesterday" | "7d" | "30d" | "90d" | "custom";

export interface DateRangeValue {
  preset: DateRangePreset;
  from: string;
  to: string;
}

export interface OverviewFilters {
  provider: string[];
  workspace: string[];
  model: string[];
  endpoint: string[];
  status: string[];
}

export type OverviewFilterKey = keyof OverviewFilters;

const FILTER_KEYS: OverviewFilterKey[] = ["provider", "workspace", "model", "endpoint", "status"];

function toDateInputValue(date: Date): string {
  return formatLocalDateInputValue(date);
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

export function getPresetRange(preset: DateRangePreset): DateRangeValue {
  const now = new Date();
  const today = startOfDay(now);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (preset === "yesterday") {
    return { preset, from: toDateInputValue(yesterday), to: toDateInputValue(yesterday) };
  }

  if (preset === "30d" || preset === "90d" || preset === "7d") {
    const days = preset === "90d" ? 90 : preset === "30d" ? 30 : 7;
    const from = new Date(today);
    from.setDate(today.getDate() - (days - 1));
    return { preset, from: toDateInputValue(from), to: toDateInputValue(today) };
  }

  return { preset: "today", from: toDateInputValue(today), to: toDateInputValue(today) };
}

export function getRowStatus(row: TelemetryRow): string {
  if (!row.error) return "200";
  const normalized = row.error.toLowerCase();
  if (normalized.includes("429") || normalized.includes("rate")) return "429";
  if (normalized.includes("500") || normalized.includes("server")) return "500";
  return "ERR";
}

export function useOverviewFilters(rows: TelemetryRow[], workspaceId?: string) {
  const [searchParams, setSearchParams] = useSearchParams();

  const dateRange = useMemo<DateRangeValue>(() => {
    const preset = (searchParams.get("range") as DateRangePreset | null) ?? "7d";
    const fallback = getPresetRange(["today", "yesterday", "7d", "30d", "90d", "custom"].includes(preset) ? preset : "today");
    if (preset === "custom") {
      return {
        preset,
        from: searchParams.get("from") || fallback.from,
        to: searchParams.get("to") || fallback.to,
      };
    }
    return getPresetRange(fallback.preset);
  }, [searchParams]);

  const filters = useMemo<OverviewFilters>(() => {
    return FILTER_KEYS.reduce(
      (acc, key) => {
        acc[key] = searchParams.getAll(key);
        return acc;
      },
      { provider: [], workspace: [], model: [], endpoint: [], status: [] } as OverviewFilters,
    );
  }, [searchParams]);

  const setDateRange = useCallback(
    (next: DateRangeValue) => {
      setSearchParams((params) => {
        const updated = new URLSearchParams(params);
        updated.set("range", next.preset);
        updated.set("from", next.from);
        updated.set("to", next.to);
        return updated;
      });
    },
    [setSearchParams],
  );

  const setFilter = useCallback(
    (key: OverviewFilterKey, values: string[]) => {
      setSearchParams((params) => {
        const updated = new URLSearchParams(params);
        updated.delete(key);
        values.forEach((value) => updated.append(key, value));
        return updated;
      });
    },
    [setSearchParams],
  );

  const clearFilters = useCallback(() => {
    setSearchParams((params) => {
      const updated = new URLSearchParams(params);
      FILTER_KEYS.forEach((key) => updated.delete(key));
      return updated;
    });
  }, [setSearchParams]);

  const clearAll = useCallback(() => {
    setSearchParams(new URLSearchParams());
  }, [setSearchParams]);

  const filteredRows = useMemo(() => {
    const from = startOfDay(new Date(`${dateRange.from}T00:00:00`)).getTime();
    const to = endOfDay(new Date(`${dateRange.to}T00:00:00`)).getTime();

    return rows.filter((row) => {
      if (row.timestamp < from || row.timestamp > to) return false;
      if (filters.provider.length > 0 && !filters.provider.includes(row.provider)) return false;
      if (filters.workspace.length > 0 && !filters.workspace.includes(row.workspace_id || workspaceId || "")) return false;
      if (filters.model.length > 0 && !filters.model.includes(row.model)) return false;
      if (filters.endpoint.length > 0 && !filters.endpoint.includes(row.route)) return false;
      if (filters.status.length > 0 && !filters.status.includes(getRowStatus(row))) return false;
      return true;
    });
  }, [dateRange.from, dateRange.to, filters.endpoint, filters.model, filters.provider, filters.status, filters.workspace, rows, workspaceId]);

  const hasActiveFilters = FILTER_KEYS.some((key) => filters[key].length > 0);

  return {
    dateRange,
    filters,
    filteredRows,
    hasActiveFilters,
    setDateRange,
    setFilter,
    clearFilters,
    clearAll,
  };
}

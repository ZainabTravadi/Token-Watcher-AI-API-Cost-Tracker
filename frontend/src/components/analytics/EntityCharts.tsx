import { memo } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { fmtCompactNum, fmtLatency, fmtPercent, fmtUSD } from "@/lib/data";

export interface EntityTrendPoint {
  label: string;
  cost_usd: number;
  requests: number;
  tokens: number;
  latency_ms: number;
  error_rate: number;
}

const config = {
  cost_usd: { label: "Cost", color: "#111827" },
  requests: { label: "Requests", color: "#2563eb" },
  tokens: { label: "Tokens", color: "#16a34a" },
  latency_ms: { label: "Latency", color: "#7c3aed" },
  error_rate: { label: "Error rate", color: "#d97706" },
} satisfies ChartConfig;

export const CostTrendChart = memo(function CostTrendChart({ data }: { data: EntityTrendPoint[] }) {
  return (
    <ChartContainer config={config} className="h-[260px] w-full">
      <LineChart data={data} margin={{ left: 6, right: 18, top: 12, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={22} />
        <YAxis tickLine={false} axisLine={false} width={58} tickFormatter={(value) => fmtUSD(Number(value))} />
        <ChartTooltip content={<ChartTooltipContent formatter={(value) => <span className="font-mono">{fmtUSD(Number(value))}</span>} />} />
        <Line type="monotone" dataKey="cost_usd" stroke="var(--color-cost_usd)" strokeWidth={2.5} dot={false} animationDuration={450} />
      </LineChart>
    </ChartContainer>
  );
});

export const RequestTrendChart = memo(function RequestTrendChart({ data }: { data: EntityTrendPoint[] }) {
  return (
    <ChartContainer config={config} className="h-[260px] w-full">
      <AreaChart data={data} margin={{ left: 6, right: 18, top: 12, bottom: 0 }}>
        <defs>
          <linearGradient id="entityRequestsFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-requests)" stopOpacity={0.32} />
            <stop offset="95%" stopColor="var(--color-requests)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={22} />
        <YAxis tickLine={false} axisLine={false} width={46} tickFormatter={(value) => fmtCompactNum(Number(value))} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Area type="monotone" dataKey="requests" stroke="var(--color-requests)" fill="url(#entityRequestsFill)" strokeWidth={2.5} animationDuration={450} />
      </AreaChart>
    </ChartContainer>
  );
});

export const TokenTrendChart = memo(function TokenTrendChart({ data }: { data: EntityTrendPoint[] }) {
  return (
    <ChartContainer config={config} className="h-[260px] w-full">
      <AreaChart data={data} margin={{ left: 6, right: 18, top: 12, bottom: 0 }}>
        <defs>
          <linearGradient id="entityTokensFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-tokens)" stopOpacity={0.32} />
            <stop offset="95%" stopColor="var(--color-tokens)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={22} />
        <YAxis tickLine={false} axisLine={false} width={52} tickFormatter={(value) => fmtCompactNum(Number(value))} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Area type="monotone" dataKey="tokens" stroke="var(--color-tokens)" fill="url(#entityTokensFill)" strokeWidth={2.5} animationDuration={450} />
      </AreaChart>
    </ChartContainer>
  );
});

export const LatencyTrendChart = memo(function LatencyTrendChart({ data }: { data: EntityTrendPoint[] }) {
  return (
    <ChartContainer config={config} className="h-[260px] w-full">
      <LineChart data={data} margin={{ left: 6, right: 18, top: 12, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={22} />
        <YAxis tickLine={false} axisLine={false} width={54} tickFormatter={(value) => fmtLatency(Number(value))} />
        <ChartTooltip content={<ChartTooltipContent formatter={(value) => <span className="font-mono">{fmtLatency(Number(value))}</span>} />} />
        <Line type="monotone" dataKey="latency_ms" stroke="var(--color-latency_ms)" strokeWidth={2.5} dot={false} animationDuration={450} />
      </LineChart>
    </ChartContainer>
  );
});

export const ErrorRateTrendChart = memo(function ErrorRateTrendChart({ data }: { data: EntityTrendPoint[] }) {
  return (
    <ChartContainer config={config} className="h-[260px] w-full">
      <BarChart data={data} margin={{ left: 6, right: 18, top: 12, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={22} />
        <YAxis tickLine={false} axisLine={false} width={52} tickFormatter={(value) => fmtPercent(Number(value), 0)} />
        <ChartTooltip content={<ChartTooltipContent formatter={(value) => <span className="font-mono">{fmtPercent(Number(value), 1)}</span>} />} />
        <ChartLegendContent />
        <Bar dataKey="error_rate" fill="var(--color-error_rate)" radius={[4, 4, 0, 0]} animationDuration={450} />
      </BarChart>
    </ChartContainer>
  );
});

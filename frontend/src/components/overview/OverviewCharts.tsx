import { memo } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { fmtCompactNum, fmtUSD } from "@/lib/data";

export interface TimelinePoint {
  label: string;
  requests: number;
  cost_usd: number;
}

export interface NameValuePoint {
  name: string;
  value: number;
  requests?: number;
}

const COLORS = ["#111827", "#2563eb", "#16a34a", "#d97706", "#7c3aed", "#dc2626", "#0891b2"];

const timelineConfig = {
  cost_usd: { label: "Cost", color: "#111827" },
  requests: { label: "Requests", color: "#2563eb" },
} satisfies ChartConfig;

export const DailyCostTrendChart = memo(function DailyCostTrendChart({ data }: { data: TimelinePoint[] }) {
  return (
    <ChartContainer config={timelineConfig} className="h-[260px] w-full">
      <LineChart data={data} margin={{ left: 6, right: 18, top: 12, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={22} />
        <YAxis tickLine={false} axisLine={false} width={58} tickFormatter={(value) => fmtUSD(Number(value))} />
        <ChartTooltip content={<ChartTooltipContent formatter={(value) => <span className="font-mono">{fmtUSD(Number(value))}</span>} />} />
        <Legend content={<ChartLegendContent />} />
        <Line type="monotone" dataKey="cost_usd" stroke="var(--color-cost_usd)" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} animationDuration={450} />
      </LineChart>
    </ChartContainer>
  );
});

export const DailyRequestTrendChart = memo(function DailyRequestTrendChart({ data }: { data: TimelinePoint[] }) {
  return (
    <ChartContainer config={timelineConfig} className="h-[260px] w-full">
      <AreaChart data={data} margin={{ left: 6, right: 18, top: 12, bottom: 0 }}>
        <defs>
          <linearGradient id="requestsFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-requests)" stopOpacity={0.32} />
            <stop offset="95%" stopColor="var(--color-requests)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={22} />
        <YAxis tickLine={false} axisLine={false} width={46} tickFormatter={(value) => fmtCompactNum(Number(value))} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Legend content={<ChartLegendContent />} />
        <Area type="monotone" dataKey="requests" stroke="var(--color-requests)" fill="url(#requestsFill)" strokeWidth={2.5} animationDuration={450} />
      </AreaChart>
    </ChartContainer>
  );
});

export const ProviderDistributionChart = memo(function ProviderDistributionChart({ data }: { data: NameValuePoint[] }) {
  const config = Object.fromEntries(data.map((point, index) => [point.name, { label: point.name, color: COLORS[index % COLORS.length] }])) satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="h-[260px] w-full">
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent formatter={(value) => <span className="font-mono">{fmtUSD(Number(value))}</span>} nameKey="name" />} />
        <Legend content={<ChartLegendContent nameKey="name" />} />
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={2} animationDuration={450}>
          {data.map((point, index) => (
            <Cell key={point.name} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  );
});

export const HorizontalCostBarChart = memo(function HorizontalCostBarChart({ data }: { data: NameValuePoint[] }) {
  const config = { value: { label: "Cost", color: "#111827" } } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="h-[260px] w-full">
      <BarChart data={data} layout="vertical" margin={{ left: 10, right: 28, top: 10, bottom: 0 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(value) => fmtUSD(Number(value))} />
        <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={120} tick={{ fontSize: 11 }} />
        <ChartTooltip content={<ChartTooltipContent formatter={(value) => <span className="font-mono">{fmtUSD(Number(value))}</span>} />} />
        <Legend content={<ChartLegendContent />} />
        <Bar dataKey="value" fill="var(--color-value)" radius={[0, 4, 4, 0]} animationDuration={450} />
      </BarChart>
    </ChartContainer>
  );
});

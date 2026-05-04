export function Stat({
  label,
  value,
  sub,
  bar,
}: {
  label: string;
  value: string;
  sub?: string;
  bar?: { value: number; max: number; label?: string };
}) {
  return (
    <div className="py-2">
      <div className="label-mono mb-2">{label}</div>
      <div className="font-serif text-3xl leading-none num">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-2 font-mono">{sub}</div>}
      {bar && (
        <div className="mt-3">
          <div className="h-1 bg-secondary relative overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-foreground"
              style={{ width: `${Math.min(100, (bar.value / bar.max) * 100)}%` }}
            />
          </div>
          {bar.label && <div className="label-mono mt-1.5">{bar.label}</div>}
        </div>
      )}
    </div>
  );
}

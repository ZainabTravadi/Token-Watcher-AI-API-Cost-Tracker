import { useEffect, useState } from "react";

export function Stat({
  label,
  value,
  sub,
  bar,
  sparkline,
}: {
  label: string;
  value: string;
  sub?: string;
  bar?: { value: number; max: number; label?: string };
  sparkline?: number[];
}) {
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    setFlash(true);
    const timer = window.setTimeout(() => setFlash(false), 220);
    return () => window.clearTimeout(timer);
  }, [value]);

  return (
    <div className="py-2">
      <div className="label-mono mb-2">{label}</div>
      <div className={`font-serif text-3xl leading-none num transition-all duration-200 ${flash ? "opacity-85 translate-y-[-1px]" : ""}`}>
        <span className="inline-block transition-transform duration-200">{value}</span>
      </div>
      {sub && <div className="text-xs text-muted-foreground mt-2 font-mono">{sub}</div>}
      {sparkline && sparkline.length > 0 && (
        <div className="mt-3 flex h-4 items-end gap-[2px]">
          {sparkline.map((point, index) => (
            <span key={index} className="w-[4px] bg-foreground/70 transition-all duration-300" style={{ height: `${Math.max(2, Math.min(16, point))}px` }} />
          ))}
        </div>
      )}
      {bar && (
        <div className="mt-3">
          <div className="h-1 bg-secondary relative overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-foreground transition-[width] duration-500 ease-out"
              style={{ width: `${bar.max > 0 ? Math.min(100, (bar.value / bar.max) * 100) : 0}%` }}
            />
          </div>
          {bar.label && <div className="label-mono mt-1.5">{bar.label}</div>}
        </div>
      )}
    </div>
  );
}

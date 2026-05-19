import type { ReactNode } from "react";

export function SettingsSection({
  n,
  title,
  desc,
  children,
}: {
  n: string;
  title: string;
  desc: string;
  children: ReactNode;
}) {
  return (
    <section className="grid grid-cols-12 gap-6 py-8 border-b">
      <div className="col-span-4">
        <div className="label-mono mb-1">S {n}</div>
        <h3 className="font-serif text-lg">{title}</h3>
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{desc}</p>
      </div>
      <div className="col-span-8">{children}</div>
    </section>
  );
}

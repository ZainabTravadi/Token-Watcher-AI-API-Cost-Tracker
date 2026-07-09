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
    <section className="grid grid-cols-1 gap-4 border-b py-8 md:grid-cols-12 md:gap-6">
      <div className="md:col-span-4">
        <div className="label-mono mb-1">S {n}</div>
        <h3 className="font-serif text-lg">{title}</h3>
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{desc}</p>
      </div>
      <div className="md:col-span-8">{children}</div>
    </section>
  );
}

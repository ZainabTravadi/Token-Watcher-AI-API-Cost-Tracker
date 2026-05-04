import { useState } from "react";
import AppLayout from "@/components/AppLayout";

export default function Settings() {
  const [alerts, setAlerts] = useState(true);
  const [saved, setSaved] = useState(false);

  const onSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <AppLayout title="Settings" meta="workspace · acme-prod">
      <form onSubmit={onSave} className="max-w-2xl">
        <Section
          n="01"
          title="API key"
          desc="Used by the TokenWatch SDK to identify this workspace. Rotate any time — old keys are revoked immediately."
        >
          <div className="flex gap-2">
            <input className="input-rect flex-1" defaultValue="tw_live_8a4f9c021e7b4d22ab09ff" type="password" />
            <button type="button" className="btn-rect-ghost text-xs">Reveal</button>
            <button type="button" className="btn-rect-ghost text-xs">Rotate</button>
          </div>
        </Section>

        <Section
          n="02"
          title="Monthly budget"
          desc="A soft limit. Requests are never blocked — TokenWatch will only notify."
        >
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm">USD</span>
            <input className="input-rect w-40" type="number" defaultValue={500} step="10" />
            <span className="text-xs text-muted-foreground font-mono">/ month</span>
          </div>
        </Section>

        <Section
          n="03"
          title="Alerts"
          desc="Notify when daily spend crosses 50%, 80%, and 100% of pro-rated budget."
        >
          <label className="inline-flex items-center gap-3 cursor-pointer select-none">
            <span
              onClick={() => setAlerts(!alerts)}
              className={`w-9 h-5 border border-foreground inline-flex items-center px-0.5 transition-colors ${alerts ? "bg-foreground" : "bg-transparent"}`}
            >
              <span className={`w-3.5 h-3.5 ${alerts ? "bg-background ml-auto" : "bg-foreground"}`} />
            </span>
            <span className="text-sm">{alerts ? "Enabled" : "Disabled"}</span>
          </label>
        </Section>

        <Section
          n="04"
          title="Webhook URL"
          desc="POST notifications to this endpoint. Payload is JSON, signed with HMAC-SHA256."
        >
          <input className="input-rect" type="url" placeholder="https://hooks.example.com/tokenwatch" defaultValue="https://hooks.acme.io/tokenwatch" />
        </Section>

        <div className="hairline-t pt-6 flex items-center gap-4">
          <button type="submit" className="btn-rect">Save changes</button>
          <button type="button" className="btn-rect-ghost">Cancel</button>
          {saved && <span className="text-xs font-mono text-positive">✓ saved</span>}
        </div>
      </form>

      <div className="mt-20 max-w-2xl">
        <div className="label-mono mb-3">Danger zone</div>
        <div className="border border-negative/40 p-5 flex items-center justify-between">
          <div>
            <div className="font-serif text-base">Delete workspace</div>
            <div className="text-xs text-muted-foreground mt-1">Removes all logs, endpoints, and stored credentials. This is permanent.</div>
          </div>
          <button type="button" className="text-sm border border-negative text-negative h-9 px-4 hover:bg-negative hover:text-background transition-colors">
            Delete workspace
          </button>
        </div>
      </div>
    </AppLayout>
  );
}

function Section({ n, title, desc, children }: { n: string; title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="grid grid-cols-12 gap-6 py-8 hairline">
      <div className="col-span-4">
        <div className="label-mono mb-1">§ {n}</div>
        <h3 className="font-serif text-lg">{title}</h3>
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{desc}</p>
      </div>
      <div className="col-span-8">{children}</div>
    </section>
  );
}

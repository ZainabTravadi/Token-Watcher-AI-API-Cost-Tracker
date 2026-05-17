import { useEffect } from "react";

export default function Drawer({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: React.ReactNode; title?: string }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="mt-20 w-[90%] max-w-4xl bg-background border border-hairline rounded shadow-lg z-10 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="font-serif text-lg">{title}</div>
          <button className="link-underline" onClick={onClose} aria-label="Close">Close</button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}

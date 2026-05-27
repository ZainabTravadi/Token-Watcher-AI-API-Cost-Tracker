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
      <div className="my-3 sm:my-8 max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-4rem)] w-[96%] max-w-4xl overflow-y-auto overflow-x-hidden bg-background border border-hairline rounded shadow-lg z-10 p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="font-serif text-base sm:text-lg pr-4 truncate">{title}</div>
          <button className="link-underline" onClick={onClose} aria-label="Close">Close</button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}

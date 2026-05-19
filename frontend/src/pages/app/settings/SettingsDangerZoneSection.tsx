import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SettingsDangerZoneSectionProps {
  isDeleting: boolean;
  onRequestDelete: () => void;
}

export function SettingsDangerZoneSection({ isDeleting, onRequestDelete }: SettingsDangerZoneSectionProps) {
  return (
    <div className="mt-20 max-w-2xl">
      <div className="label-mono mb-3">Danger zone</div>
      <div className="border border-red-500/40 p-5 flex items-center justify-between bg-red-500/5">
        <div>
          <div className="font-serif text-base">Delete workspace</div>
          <div className="text-xs text-muted-foreground mt-1">
            Removes telemetry, settings, and credentials. This cannot be undone.
          </div>
        </div>
        <Button variant="destructive" onClick={onRequestDelete} disabled={isDeleting}>
          <Trash2 className="h-4 w-4 mr-2" />
          {isDeleting ? "Deleting..." : "Delete workspace"}
        </Button>
      </div>
    </div>
  );
}

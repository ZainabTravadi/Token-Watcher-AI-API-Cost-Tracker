import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { API_BASE_URL } from "@/lib/api";

interface WorkspaceWarmupState {
  isWarmingUp: boolean;
  recordsGenerated: number;
  uptime: number;
  bootstrappingPercent: number;
}

const TARGET_RECORDS_FOR_WARMUP = 50; // Consider workspace warm after 50+ records

/**
 * Hook to detect if workspace is currently warming up with telemetry simulator
 * Returns state to display "bootstrapping" messages instead of empty screens
 */
export function useWorkspaceWarmup(): WorkspaceWarmupState {
  const { currentWorkspace } = useAuth();
  const [warmupState, setWarmupState] = useState<WorkspaceWarmupState>({
    isWarmingUp: false,
    recordsGenerated: 0,
    uptime: 0,
    bootstrappingPercent: 0,
  });

  useEffect(() => {
    if (!currentWorkspace?.id) {
      return;
    }

    // Check simulator status every 2 seconds while warming up
    const checkSimulatorStatus = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/telemetry/workspace-simulator-status?workspaceId=${currentWorkspace.id}`,
          { credentials: "include" }
        );

        if (!response.ok) return;

        const json = (await response.json()) as { data: { running: boolean; recordsGenerated: number; uptime: number } };
        const { running, recordsGenerated, uptime } = json.data;

        // Calculate bootstrap progress (max 100 at TARGET_RECORDS)
        const bootstrappingPercent = Math.min((recordsGenerated / TARGET_RECORDS_FOR_WARMUP) * 100, 100);

        const isWarmingUp = running || (recordsGenerated > 0 && recordsGenerated < TARGET_RECORDS_FOR_WARMUP);

        setWarmupState({
          isWarmingUp,
          recordsGenerated,
          uptime,
          bootstrappingPercent,
        });
      } catch (error) {
        // Silent error - warmup check is optional
      }
    };

    checkSimulatorStatus();
    const interval = setInterval(checkSimulatorStatus, 2000);

    return () => clearInterval(interval);
  }, [currentWorkspace?.id]);

  return warmupState;
}

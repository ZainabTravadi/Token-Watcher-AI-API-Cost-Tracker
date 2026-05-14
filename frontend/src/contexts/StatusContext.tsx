import { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  fetchHealth,
  getJwtToken,
  type HealthResponse,
  type TelemetryStreamStatus,
  formatTelemetryCount
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

interface StatusContextType {
  // Health data
  health: HealthResponse | null;
  isHealthLoading: boolean;
  healthError: Error | null;

  // Stream status
  streamStatus: TelemetryStreamStatus;

  // Derived state
  appVersion: string;
  releaseChannel: string;
  environment: string;
  environmentBadgeColor: string;
  databaseStatus: string;
  databaseColor: string;
  databaseResponseTime: number;
  simulatorStatus: string;
  simulatorColor: string;
  telemetryCount: number;
  telemetryCountFormatted: string;
  streamStatusColor: string;

  // Refresh functions
  refreshHealth: () => Promise<void>;
}

const StatusContext = createContext<StatusContextType | undefined>(undefined);

const ENVIRONMENT_COLORS: Record<string, string> = {
  development: "bg-blue-500/10 text-blue-700 border-blue-200",
  staging: "bg-amber-500/10 text-amber-700 border-amber-200",
  production: "bg-red-500/10 text-red-700 border-red-200"
};

const STATUS_COLORS = {
  connected: "bg-green-500/10 text-green-700",
  reconnecting: "bg-amber-500/10 text-amber-700",
  offline: "bg-red-500/10 text-red-700",
  degraded: "bg-orange-500/10 text-orange-700"
};

export function StatusProvider({ children }: { children: React.ReactNode }) {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [isHealthLoading, setIsHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState<Error | null>(null);
  const [streamStatus, setStreamStatus] = useState<TelemetryStreamStatus>("offline");
  const { user, currentWorkspace } = useAuth();

  // Refresh health data
  const refreshHealth = useCallback(async () => {
    try {
      setHealthError(null);
      const data = await fetchHealth();
      setHealth(data);
    } catch (err) {
      // Only log non-network errors to avoid spam
      if (err instanceof Error && !err.message.includes("Failed to fetch")) {
        console.debug("Health fetch error:", err.message);
      }
      setHealthError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsHealthLoading(false);
    }
  }, []);

  // Initial health fetch
  useEffect(() => {
    refreshHealth();
  }, [refreshHealth]);

  // Poll health data every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      void refreshHealth();
    }, 10_000);

    return () => clearInterval(interval);
  }, [refreshHealth]);

  // Set up event stream for real-time updates (only when authenticated and workspace selected)
  useEffect(() => {
    // Only set up stream if user is authenticated and workspace is selected
    if (!user || !currentWorkspace?.id) {
      setStreamStatus("offline");
      return;
    }

    // Capture workspace ID at effect start to ensure it doesn't change during reconnects
    const workspaceId = currentWorkspace.id;
    setStreamStatus("connecting");
    
    let source: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let isCleanedUp = false;

    const setupStream = () => {
      // Don't set up stream if effect has been cleaned up
      if (isCleanedUp) return;

      try {
        const token = getJwtToken();
        if (!token) {
          // User is not authenticated - this is expected, not an error
          if (!isCleanedUp) {
            setStreamStatus("offline");
          }
          return;
        }

        const apiUrl = import.meta.env.VITE_TOKENWATCH_API_URL ?? "http://localhost:3001";
        const streamUrl = `${apiUrl}/api/telemetry/stream?workspaceId=${encodeURIComponent(workspaceId)}&token=${encodeURIComponent(token)}`;
        
        // EventSource automatically includes cookies, and we're also passing the token as a query parameter
        source = new EventSource(streamUrl);

        source.onopen = () => {
          if (!isCleanedUp) {
            setStreamStatus("live");
          }
        };

        const handleUpdate = () => {
          if (!isCleanedUp) {
            void refreshHealth();
          }
        };

        source.addEventListener("telemetry", handleUpdate);
        source.addEventListener("seeded", handleUpdate);
        source.addEventListener("connected", handleUpdate);

        source.onerror = () => {
          if (!source || isCleanedUp) return;

          if (source.readyState === EventSource.CLOSED) {
            if (!isCleanedUp) {
              setStreamStatus("offline");
            }
            // Attempt to reconnect after 3 seconds
            if (!reconnectTimeout && !isCleanedUp) {
              reconnectTimeout = setTimeout(() => {
                if (!isCleanedUp) {
                  reconnectTimeout = null;
                  setupStream();
                }
              }, 3000);
            }
          } else if (!isCleanedUp) {
            setStreamStatus("reconnecting");
          }
        };
      } catch (err) {
        if (isCleanedUp) return;
        
        // Only log actual errors, not expected network timeouts
        if (err instanceof Error && !err.message.includes("NetworkError")) {
          console.error("EventSource setup error:", err.message);
        }
        if (!isCleanedUp) {
          setStreamStatus("offline");
        }
        
        // Attempt to reconnect after 5 seconds
        if (!reconnectTimeout && !isCleanedUp) {
          reconnectTimeout = setTimeout(() => {
            if (!isCleanedUp) {
              reconnectTimeout = null;
              setupStream();
            }
          }, 5000);
        }
      }
    };

    setupStream();

    return () => {
      isCleanedUp = true;
      setStreamStatus("offline");
      if (source) {
        source.close();
        source = null;
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
    };
  }, [user, currentWorkspace?.id, refreshHealth]);

  // Derive display values from health data
  const appVersion = health?.version.full ?? "1.0.0";
  const releaseChannel = health?.version.releaseChannel ?? "stable";
  const environment = health?.environment.name ?? "development";
  const environmentBadgeColor = ENVIRONMENT_COLORS[environment] || ENVIRONMENT_COLORS.development;

  const databaseStatus = health?.database.status ?? "offline";
  const databaseColor = STATUS_COLORS[databaseStatus as keyof typeof STATUS_COLORS] || STATUS_COLORS.offline;
  const databaseResponseTime = health?.database.responseTime ?? 0;

  const simulatorStatus = health?.simulator.status ?? "offline";
  const simulatorColor = {
    starting: "bg-amber-500/10 text-amber-700",
    "warming up": "bg-amber-500/10 text-amber-700",
    live: "bg-green-500/10 text-green-700",
    paused: "bg-gray-500/10 text-gray-700",
    offline: "bg-red-500/10 text-red-700"
  }[simulatorStatus] || "bg-gray-500/10 text-gray-700";

  const telemetryCount = health?.telemetry.totalRows ?? 0;
  const telemetryCountFormatted = formatTelemetryCount(telemetryCount);

  const streamStatusColor = {
    connecting: "bg-amber-500/10 text-amber-700",
    live: "bg-green-500/10 text-green-700",
    reconnecting: "bg-amber-500/10 text-amber-700",
    offline: "bg-red-500/10 text-red-700"
  }[streamStatus];

  const value: StatusContextType = {
    health,
    isHealthLoading,
    healthError,
    streamStatus,
    appVersion,
    releaseChannel,
    environment,
    environmentBadgeColor,
    databaseStatus,
    databaseColor,
    databaseResponseTime,
    simulatorStatus,
    simulatorColor,
    telemetryCount,
    telemetryCountFormatted,
    streamStatusColor,
    refreshHealth
  };

  return <StatusContext.Provider value={value}>{children}</StatusContext.Provider>;
}

export function useStatus(): StatusContextType {
  const context = useContext(StatusContext);
  if (!context) {
    throw new Error("useStatus must be used within StatusProvider");
  }
  return context;
}

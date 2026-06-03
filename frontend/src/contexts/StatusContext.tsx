/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  authFetch,
  fetchHealth,
  API_BASE_URL,
  type HealthResponse,
  type TelemetryStreamStatus,
  formatTelemetryCount,
  isRequestLogRefreshEnabled,
  setStreamStatus as setGlobalStreamStatus,
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
  telemetryCount: number;
  telemetryCountFormatted: string;
  streamStatusColor: string;
  lastTelemetryEventAt: number | null;

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
  const [streamStatus, setLocalStreamStatus] = useState<TelemetryStreamStatus>("offline");
  const [lastTelemetryEventAt, setLastTelemetryEventAt] = useState<number | null>(null);
  const { user, currentWorkspace, isAuthReady } = useAuth();
  const queryClient = useQueryClient();

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
    if (!isAuthReady) {
      setLocalStreamStatus("connecting");
      setGlobalStreamStatus("connecting");
      return;
    }

    // Only set up stream if user is authenticated and workspace is selected
    if (!user || !currentWorkspace?.id) {
      setLocalStreamStatus("offline");
      setGlobalStreamStatus("offline");
      setLastTelemetryEventAt(null);
      return;
    }

    // Capture workspace ID at effect start to ensure it doesn't change during reconnects
    const workspaceId = currentWorkspace.id;
    setLocalStreamStatus("connecting");
    setGlobalStreamStatus("connecting");
    
    let source: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let refreshTimeout: ReturnType<typeof setTimeout> | null = null;
    let staleCheckInterval: ReturnType<typeof setInterval> | null = null;
    let lastHeartbeatAt = Date.now();
    let isCleanedUp = false;

    const clearTimers = () => {
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
        refreshTimeout = null;
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
      if (staleCheckInterval) {
        clearInterval(staleCheckInterval);
        staleCheckInterval = null;
      }
    };

    const setStreamState = (status: TelemetryStreamStatus) => {
      setLocalStreamStatus(status);
      setGlobalStreamStatus(status);
    };

    const closeSource = () => {
      if (source) {
        source.close();
        source = null;
      }
    };

    const verifySessionAndSetup = async () => {
      // Don't set up stream if effect has been cleaned up
      if (isCleanedUp) return;

      try {
        const authResponse = await authFetch("/api/auth/me");

        if (isCleanedUp) {
          return;
        }

        if (authResponse.status === 401 || authResponse.status === 403) {
          closeSource();
          clearTimers();
          setLastTelemetryEventAt(null);
          setStreamState("unauthorized");
          return;
        }

        if (!authResponse.ok) {
          throw new Error(`Auth check failed with status ${authResponse.status}`);
        }

        const streamUrl = `${API_BASE_URL}/api/telemetry/stream?workspaceId=${encodeURIComponent(workspaceId)}`;

        closeSource();
        source = new EventSource(streamUrl, { withCredentials: true });

        source.onopen = () => {
          if (!isCleanedUp) {
            setStreamState("live");
          }
        };

        const handleRefresh = () => {
          if (!isCleanedUp) {
            if (!refreshTimeout) {
              refreshTimeout = setTimeout(() => {
                refreshTimeout = null;
                if (isCleanedUp) {
                  return;
                }

                void refreshHealth();
                void queryClient.invalidateQueries({ queryKey: ["analytics-snapshot"] });
                void queryClient.invalidateQueries({ queryKey: ["telemetry-rows"] });
                if (isRequestLogRefreshEnabled()) {
                  void queryClient.invalidateQueries({ queryKey: ["request-log"] });
                }
                void queryClient.invalidateQueries({ queryKey: ["health"] });
              }, 120);
            }
          }
        };

        const handleTelemetryUpdate = () => {
          lastHeartbeatAt = Date.now();
          setLastTelemetryEventAt(lastHeartbeatAt);
          handleRefresh();
        };

        const handleHeartbeat = () => {
          lastHeartbeatAt = Date.now();
          if (!isCleanedUp) {
            setStreamState("live");
          }
        };

        source.addEventListener("telemetry", handleTelemetryUpdate);
        source.addEventListener("seeded", handleRefresh);
        source.addEventListener("connected", handleHeartbeat);
        source.addEventListener("ping", handleHeartbeat);

        staleCheckInterval = setInterval(() => {
          if (isCleanedUp || !source) {
            return;
          }

          if (Date.now() - lastHeartbeatAt > 45_000) {
            setStreamState("reconnecting");
            closeSource();
            clearTimers();
            reconnectTimeout = setTimeout(() => {
              if (!isCleanedUp) {
                reconnectTimeout = null;
                void verifySessionAndSetup();
              }
            }, 1000);
          }
        }, 10_000);

        source.onerror = async () => {
          if (!source || isCleanedUp) return;

          const readyState = source.readyState;
          closeSource();

          if (readyState === EventSource.CLOSED) {
            try {
              const checkResponse = await authFetch("/api/auth/me");
              if (checkResponse.status === 401 || checkResponse.status === 403) {
                if (!isCleanedUp) {
                  setLastTelemetryEventAt(null);
                  setStreamState("unauthorized");
                }
                return;
              }
            } catch (err) {
              // If auth check fails due to network, allow reconnect behavior below.
            }

            if (!isCleanedUp) {
              setStreamState("offline");
            }
            clearTimers();
            reconnectTimeout = setTimeout(() => {
              if (!isCleanedUp) {
                reconnectTimeout = null;
                void verifySessionAndSetup();
              }
            }, 3000);
          } else if (!isCleanedUp) {
            setStreamState("reconnecting");
          }
        };
      } catch (err) {
        if (isCleanedUp) return;
        
        // Only log actual errors, not expected network timeouts
        if (err instanceof Error && !err.message.includes("NetworkError")) {
          console.error("EventSource setup error:", err.message);
        }
        if (!isCleanedUp) {
          setStreamState("offline");
        }

        closeSource();
        clearTimers();
        
        // Attempt to reconnect after 5 seconds
        if (!reconnectTimeout && !isCleanedUp) {
          reconnectTimeout = setTimeout(() => {
            if (!isCleanedUp) {
              reconnectTimeout = null;
              void verifySessionAndSetup();
            }
          }, 5000);
        }
      }
    };

    void verifySessionAndSetup();

    return () => {
      isCleanedUp = true;
      setStreamState("offline");
      setLastTelemetryEventAt(null);
      closeSource();
      clearTimers();
    };
  }, [user, currentWorkspace?.id, isAuthReady, refreshHealth, queryClient]);

  // Derive display values from health data
  const appVersion = health?.version.full ?? "1.0.0";
  const releaseChannel = health?.version.releaseChannel ?? "stable";
  const environment = health?.environment.name ?? "development";
  const environmentBadgeColor = ENVIRONMENT_COLORS[environment] || ENVIRONMENT_COLORS.development;

  const databaseStatus = health?.database.status ?? "offline";
  const databaseColor = STATUS_COLORS[databaseStatus as keyof typeof STATUS_COLORS] || STATUS_COLORS.offline;
  const databaseResponseTime = health?.database.responseTime ?? 0;

  const telemetryCount = health?.telemetry.totalRows ?? 0;
  const telemetryCountFormatted = formatTelemetryCount(telemetryCount);

  const streamStatusColor = {
    connecting: "bg-amber-500/10 text-amber-700",
    live: "bg-green-500/10 text-green-700",
    reconnecting: "bg-amber-500/10 text-amber-700",
    offline: "bg-red-500/10 text-red-700",
    unauthorized: "bg-red-500/10 text-red-700"
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
    telemetryCount,
    telemetryCountFormatted,
    streamStatusColor,
    lastTelemetryEventAt,
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

/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authFetch, subscribeAuthInvalidation, resetAuthInvalidation } from "@/lib/api";

const WORKSPACE_STORAGE_KEY = "tokenwatch.currentWorkspaceId";

export interface AuthUser {
  id: string;
  email: string;
  created_at?: number;
}

export interface WorkspaceInfo {
  id: string;
  user_id: string;
  name: string;
  monthly_budget: number;
  webhook_url: string | null;
  created_at: number;
  updated_at: number;
  apiKey?: { id: string; created_at: number } | null;
  settings?: Record<string, unknown> | null;
}

interface AuthContextType {
  user: AuthUser | null;
  workspaces: WorkspaceInfo[] | null;
  currentWorkspace: WorkspaceInfo | null;
  isAuthReady: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setCurrentWorkspace: (workspace: WorkspaceInfo | null) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getPersistedWorkspaceId = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
};

const persistWorkspaceId = (workspaceId: string | null) => {
  if (typeof window === "undefined") {
    return;
  }
  if (workspaceId) {
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, workspaceId);
  } else {
    window.localStorage.removeItem(WORKSPACE_STORAGE_KEY);
  }
};

const chooseWorkspace = (availableWorkspaces: WorkspaceInfo[] | null, preferredId: string | null): WorkspaceInfo | null => {
  if (!availableWorkspaces || availableWorkspaces.length === 0) {
    return null;
  }

  const matched = preferredId ? availableWorkspaces.find((ws) => ws.id === preferredId) : null;
  return matched ?? availableWorkspaces[0];
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[] | null>(null);
  const [currentWorkspace, setCurrentWorkspaceState] = useState<WorkspaceInfo | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const formatAuthError = (error: unknown): string => {
    if (error instanceof Error) {
      if (error.message.includes("Failed to fetch")) {
        return "Unable to reach the backend. Check your network or CORS settings.";
      }
      if (error.message.toLowerCase().includes("cors")) {
        return "The request was blocked by CORS. Confirm the frontend origin is allowed.";
      }
      return error.message;
    }
    return "Authentication failed.";
  };

  const parseResponseError = async (response: Response): Promise<string> => {
    const text = await response.text();
    try {
      const body = JSON.parse(text);
      if (body?.error) {
        return String(body.error);
      }
    } catch {
      // ignore malformed JSON
    }
    return text || `Request failed with status ${response.status}`;
  };

  const clearSession = useCallback(() => {
    queryClient.clear();
    setUser(null);
    setWorkspaces(null);
    setCurrentWorkspaceState(null);
    setError(null);
    persistWorkspaceId(null);
    resetAuthInvalidation();
  }, [queryClient]);

  const setCurrentWorkspace = useCallback((workspace: WorkspaceInfo | null) => {
    setCurrentWorkspaceState(workspace);
    persistWorkspaceId(workspace?.id ?? null);
  }, []);

  const restoreWorkspace = useCallback((availableWorkspaces: WorkspaceInfo[] | null) => {
    const persisted = getPersistedWorkspaceId();
    const workspace = chooseWorkspace(availableWorkspaces, persisted);
    setCurrentWorkspace(workspace);
  }, [setCurrentWorkspace]);

  // Check if user is already logged in on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await authFetch("/api/auth/me");

        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
          setWorkspaces(data.workspaces);
          restoreWorkspace(data.workspaces);
        } else {
          clearSession();
        }
      } catch (err) {
        console.error("Auth check failed:", err);
        clearSession();
      } finally {
        setIsLoading(false);
        setIsAuthReady(true);
      }
    };

    checkAuth();
  }, [clearSession, restoreWorkspace]);

  const login = async (email: string, password: string) => {
    try {
      setError(null);
      setIsLoading(true);

      const response = await authFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const message = await parseResponseError(response);
        throw new Error(message || "Login failed");
      }

      const data = await response.json();
      setUser(data.user);

      if (Array.isArray(data.workspaces) && data.workspaces.length > 0) {
        setWorkspaces(data.workspaces);
        setCurrentWorkspace(chooseWorkspace(data.workspaces, getPersistedWorkspaceId()));
      } else {
        await refreshUser();
      }
    } catch (err) {
      const message = formatAuthError(err);
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (email: string, password: string) => {
    try {
      setError(null);
      setIsLoading(true);

      const response = await authFetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const message = await parseResponseError(response);
        throw new Error(message || "Signup failed");
      }

      const data = await response.json();
      setUser(data.user);
      if (data.workspace) {
        setWorkspaces([data.workspace]);
        setCurrentWorkspace(data.workspace);
      } else {
        await refreshUser();
      }
    } catch (err) {
      const message = formatAuthError(err);
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authFetch("/api/auth/logout", {
        method: "POST"
      });
    } catch (err) {
      console.warn("Logout request failed:", err);
    } finally {
      clearSession();
    }
  };

  const refreshUser = async () => {
    try {
      const response = await authFetch("/api/auth/me");

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setWorkspaces(data.workspaces);

        if (currentWorkspace && data.workspaces) {
          const updated = data.workspaces.find((ws: WorkspaceInfo) => ws.id === currentWorkspace.id);
          if (updated) {
            setCurrentWorkspace(updated);
          } else {
            restoreWorkspace(data.workspaces);
          }
        } else {
          restoreWorkspace(data.workspaces);
        }
      } else {
        clearSession();
      }
    } catch (err) {
      console.error("Failed to refresh user:", err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        workspaces,
        currentWorkspace,
        isAuthReady,
        isLoading,
        error,
        login,
        signup,
        logout,
        setCurrentWorkspace,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

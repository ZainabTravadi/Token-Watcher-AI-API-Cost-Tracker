/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_TOKENWATCH_API_URL ?? "http://localhost:3001";

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
  setCurrentWorkspace: (workspace: WorkspaceInfo) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[] | null>(null);
  const [currentWorkspace, setCurrentWorkspace] = useState<WorkspaceInfo | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if user is already logged in on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
          credentials: "include"
        });

        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
          setWorkspaces(data.workspaces);
          // Set first workspace as current
          if (data.workspaces && data.workspaces.length > 0) {
            setCurrentWorkspace(data.workspaces[0]);
          }
        } else {
          setUser(null);
          setWorkspaces(null);
        }
      } catch (err) {
        console.error("Auth check failed:", err);
        setUser(null);
        setWorkspaces(null);
      } finally {
        setIsLoading(false);
        setIsAuthReady(true);
      }
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      setError(null);
      setIsLoading(true);

      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Login failed");
      }

      const data = await response.json();
      setUser(data.user);

      // Refresh workspaces
      await refreshUser();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (email: string, password: string) => {
    try {
      setError(null);
      setIsLoading(true);

      const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Signup failed");
      }

      const data = await response.json();
      setUser(data.user);
      setWorkspaces([data.workspace]);
      setCurrentWorkspace(data.workspace);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Signup failed";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include"
      });
    } finally {
      setUser(null);
      setWorkspaces(null);
      setCurrentWorkspace(null);
    }
  };

  const refreshUser = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        credentials: "include"
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setWorkspaces(data.workspaces);
        // Preserve current workspace if it exists
        if (currentWorkspace && data.workspaces) {
          const updated = data.workspaces.find((ws: WorkspaceInfo) => ws.id === currentWorkspace.id);
          if (updated) {
            setCurrentWorkspace(updated);
          } else if (data.workspaces.length > 0) {
            setCurrentWorkspace(data.workspaces[0]);
          }
        } else if (data.workspaces && data.workspaces.length > 0) {
          setCurrentWorkspace(data.workspaces[0]);
        }
      } else {
        setUser(null);
        setWorkspaces(null);
        setCurrentWorkspace(null);
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

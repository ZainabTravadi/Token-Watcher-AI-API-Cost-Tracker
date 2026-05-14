import { Router, Request, Response } from "express";
import { getConfig } from "../config/env";
import { getTelemetryCount } from "../services/telemetryRepository";
import { getDatabase } from "../db/database";

// Get version from package.json at runtime
function getVersionInfo() {
  try {
    const packageJson = require("../../../package.json");
    const version = packageJson.version || "1.0.0";
    
    // Determine release channel based on environment or version suffix
    let releaseChannel: "stable" | "beta" | "nightly" = "stable";
    if (version.includes("beta")) {
      releaseChannel = "beta";
    } else if (version.includes("nightly")) {
      releaseChannel = "nightly";
    }
    
    return {
      full: version,
      releaseChannel,
      buildTime: process.env.BUILD_TIME || new Date().toISOString()
    };
  } catch {
    return {
      full: "1.0.0",
      releaseChannel: "stable" as const,
      buildTime: new Date().toISOString()
    };
  }
}

// Get database diagnostics
function getDatabaseStatus() {
  try {
    const db = getDatabase();
    const startTime = Date.now();
    
    // Quick health check query
    const result = db.prepare("SELECT 1").get();
    const responseTime = Date.now() - startTime;
    
    return {
      status: "connected",
      responseTime,
      lastChecked: new Date().toISOString()
    };
  } catch {
    return {
      status: "offline",
      responseTime: -1,
      lastChecked: new Date().toISOString()
    };
  }
}

export function createHealthRouter(): Router {
  const router = Router();

  router.get("/health", (_request: Request, response: Response) => {
    const config = getConfig();
    const telemetryCount = getTelemetryCount();
    const versionInfo = getVersionInfo();
    const dbStatus = getDatabaseStatus();

    // Map node environment to display environment
    const envMap: Record<string, "development" | "staging" | "production"> = {
      "development": "development",
      "dev": "development",
      "staging": "staging",
      "stage": "staging",
      "production": "production",
      "prod": "production"
    };

    const displayEnv = envMap[config.nodeEnv.toLowerCase()] || "development";

    response.json({
      status: "ok",
      version: versionInfo,
      environment: {
        name: displayEnv,
        nodeEnv: config.nodeEnv,
        port: config.port
      },
      database: dbStatus,
      simulator: {
        status: "live",
        startTime: process.env.SIMULATOR_START_TIME || new Date().toISOString(),
        seededRows: 0,
        totalRows: telemetryCount
      },
      telemetry: {
        totalRows: telemetryCount,
        status: telemetryCount > 0 ? "active" : "idle"
      },
      stream: {
        status: "live",
        reconnectAttempts: 0,
        lastHeartbeat: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });
  });

  return router;
}
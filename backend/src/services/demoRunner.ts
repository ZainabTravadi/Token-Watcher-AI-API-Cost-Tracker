import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";

let demoProcess: ChildProcess | null = null;

export function startSdkDemo(apiUrl: string): ChildProcess | null {
  if (demoProcess) {
    return demoProcess;
  }

  try {
    const demoScript = path.resolve(process.cwd(), "..", "sdk", "examples", "demo.ts");
    const tsxCommand = resolveTsxCommand();

    demoProcess = spawn(tsxCommand, [demoScript], {
      env: {
        ...process.env,
        TOKENWATCH_API_URL: apiUrl,
        TOKENWATCH_PROJECT_ID: "demo-app"
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      shell: true,
      detached: false
    });

    demoProcess.stdout?.on("data", (chunk) => process.stdout.write(`[demo] ${chunk.toString()}`));
    demoProcess.stderr?.on("data", (chunk) => {
      // Silently ignore demo errors - don't let them crash the server
      // process.stderr.write(`[demo] ${chunk.toString()}`);
    });

    demoProcess.on("exit", (code) => {
      demoProcess = null;
      // Try to restart demo after a delay
      if (code !== 0) {
        setTimeout(() => {
          startSdkDemo(apiUrl);
        }, 5000);
      }
    });

    demoProcess.on("error", (err) => {
      console.error("[demo] Failed to start demo process:", err);
      demoProcess = null;
    });

    return demoProcess;
  } catch (err) {
    console.error("[demo] Error starting SDK demo:", err);
    return null;
  }
}

export function stopSdkDemo(): void {
  if (!demoProcess) {
    return;
  }

  demoProcess.kill();
  demoProcess = null;
}

function resolveTsxCommand(): string {
  const binName = process.platform === "win32" ? "tsx.cmd" : "tsx";
  return path.resolve(process.cwd(), "node_modules", ".bin", binName);
}
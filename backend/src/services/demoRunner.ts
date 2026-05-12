import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";

let demoProcess: ChildProcess | null = null;

export function startSdkDemo(apiUrl: string): ChildProcess | null {
  if (demoProcess) {
    return demoProcess;
  }

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
    shell: true
  });

  demoProcess.stdout?.on("data", (chunk) => process.stdout.write(`[demo] ${chunk.toString()}`));
  demoProcess.stderr?.on("data", (chunk) => process.stderr.write(`[demo] ${chunk.toString()}`));

  demoProcess.on("exit", () => {
    demoProcess = null;
  });

  return demoProcess;
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
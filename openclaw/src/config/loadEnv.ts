import fs from "node:fs";
import path from "node:path";

function parseLine(line: string): { key: string; value: string } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const separatorIndex = trimmed.indexOf("=");
  if (separatorIndex <= 0) {
    return null;
  }

  const key = trimmed.slice(0, separatorIndex).trim();
  let value = trimmed.slice(separatorIndex + 1).trim();
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return key ? { key, value } : null;
}

export function loadEnvFiles(openClawRoot: string): void {
  const repoRoot = path.resolve(openClawRoot, "..");
  const candidates = [
    path.join(repoRoot, ".env"),
    path.join(openClawRoot, ".env")
  ];

  const merged = new Map<string, string>();
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) {
      continue;
    }

    const contents = fs.readFileSync(candidate, "utf8");
    for (const line of contents.split(/\r?\n/u)) {
      const parsed = parseLine(line);
      if (parsed) {
        merged.set(parsed.key, parsed.value);
      }
    }
  }

  for (const [key, value] of merged) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

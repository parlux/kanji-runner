import { execSync } from "node:child_process";
import { defineConfig } from "vitest/config";

/** Short commit hash plus UTC build time, shown on the pause screen. */
function buildLabel(): string {
  let hash = "dev";
  try {
    hash = execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    // no git: keep "dev"
  }
  const time = new Date().toISOString().slice(0, 16).replace("T", " ");
  return `${hash} · ${time} UTC`;
}

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/kanji-runner/" : "/",
  define: { __BUILD__: JSON.stringify(buildLabel()) },
  test: {
    include: ["tests/**/*.test.ts"],
  },
}));

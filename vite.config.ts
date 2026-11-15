import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { defineConfig } from "vitest/config";

/** Version, short commit hash and UTC build time, shown on the pause screen. */
function buildLabel(): string {
  let hash = "dev";
  try {
    hash = execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    // no git: keep "dev"
  }
  const time = new Date().toISOString().slice(0, 16).replace("T", " ");
  const { version } = JSON.parse(readFileSync("package.json", "utf8")) as {
    version: string;
  };
  return `v${version} · ${hash} · ${time} UTC`;
}

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/kanji-runner/" : "/",
  define: { __BUILD__: JSON.stringify(buildLabel()) },
  test: {
    pool: "threads",
    isolate: false,
    maxWorkers: 3,
    include: ["tests/**/*.test.ts"],
  },
}));

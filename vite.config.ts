import { defineConfig } from "vitest/config";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/number-runner/" : "/",
  test: {
    include: ["tests/**/*.test.ts"],
  },
}));

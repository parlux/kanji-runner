import { defineConfig } from "vitest/config";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/kanji-runner/" : "/",
  test: {
    include: ["tests/**/*.test.ts"],
  },
}));

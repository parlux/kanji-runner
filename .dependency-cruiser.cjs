/** Layer rules, see AGENTS.md. Type-only imports count too. */
module.exports = {
  forbidden: [
    { name: "no-cycles", severity: "error", from: {}, to: { circular: true } },
    {
      name: "core-only-core-and-data",
      severity: "error",
      from: { path: "^src/core/" },
      to: { path: "^src/", pathNot: "^src/(core|data)/" },
    },
    {
      name: "persistence-not-game",
      severity: "error",
      from: { path: "^src/(storage|sync|wanikani)/" },
      to: { path: "^src/game/" },
    },
    {
      name: "three-only-from-game",
      severity: "error",
      from: { path: "^src/", pathNot: "^src/game/" },
      to: { path: "^src/game/three/" },
    },
  ],
  options: {
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
    doNotFollow: { path: "node_modules" },
  },
};

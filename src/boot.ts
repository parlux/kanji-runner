import { sandboxParam } from "./game/sandbox/param";

// `?sandbox=horde` plays the horde gauntlet (dev tool) instead of the game
if (sandboxParam(window.location.search) === "horde")
  void import("./game/sandbox/main");
else void import("./main");

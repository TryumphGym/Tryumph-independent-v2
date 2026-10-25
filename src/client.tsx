import { StartClient } from "@tanstack/react-start/client";
import { hydrateRoot } from "react-dom/client";

console.log("[Tryumph] Starting React hydration");

hydrateRoot(document, <StartClient />, {
  onRecoverableError(error) {
    console.error("[Tryumph] Hydration recovery:", error);
  },
  onUncaughtError(error) {
    console.error("[Tryumph] Hydration error:", error);
  },
});

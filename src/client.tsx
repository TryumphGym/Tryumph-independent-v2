import { hydrateStart } from "@tanstack/react-start/client";

console.log("[Tryumph] Browser client entry started");

Promise.resolve()
  .then(() => hydrateStart())
  .then(() => {
    console.log("[Tryumph] Hydration completed");
  })
  .catch((error) => {
    console.error("[Tryumph] Hydration failed:", error);
  });

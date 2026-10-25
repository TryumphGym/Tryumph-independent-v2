import { StartClient } from "@tanstack/react-start/client";
import { createRoot, hydrateRoot } from "react-dom/client";

// The server-rendered HTML must be hydrated for buttons, filters and forms to work.
// On some deployments the hydration entry runs without attaching React to the
// document. Detect that state and recover by rendering the client app afresh.
const app = <StartClient />;
const root = hydrateRoot(document, app, {
  onRecoverableError(error) {
    console.error("[Tryumph] React hydration recovery:", error);
  },
  onUncaughtError(error) {
    console.error("[Tryumph] React hydration error:", error);
  },
});

function hasReactHandlers(): boolean {
  const node = document.querySelector("button.chip, button.auth-tab, button[aria-label='Menu']");
  return !!node && Object.keys(node).some((key) => key.startsWith("__reactFiber$"));
}

// Give React time to hydrate before deciding that the SSR tree is inert.
window.setTimeout(() => {
  if (hasReactHandlers()) return;
  console.warn("[Tryumph] Hydration did not attach event handlers; attempting client render.");
  root.unmount();
  createRoot(document, {
    onUncaughtError(error) {
      console.error("[Tryumph] Client render error:", error);
    },
  }).render(app);
}, 1800);

import posthog from "posthog-js";

// Browser-only: called from a useEffect so it never runs during SSR.
export function initAnalytics() {
  if (typeof window === "undefined") return;
  const projectToken = import.meta.env["VITE_LOVABLE_CONNECTOR_POSTHOG_API_KEY"];
  if (!projectToken) return;
  if (posthog.__loaded) return;
  const region = import.meta.env["VITE_LOVABLE_CONNECTOR_POSTHOG_REGION"] || "us";
  const apiHost = region === "us" ? "https://us.i.posthog.com" : "https://eu.i.posthog.com";
  posthog.init(projectToken, {
    api_host: apiHost,
    capture_pageview: true,
    persistence: "localStorage+cookie",
  });
}

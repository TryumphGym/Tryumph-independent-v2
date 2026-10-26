import { getRequest } from "@tanstack/react-start/server";
import { runtimeEnv } from "./runtime-env.server";
/** Public deployments must explicitly configure their independent application origin. */
export function appOrigin(): string {
  const configured = runtimeEnv("APP_ORIGIN");
  if (configured) {
    const url = new URL(configured);
    if (
      url.protocol !== "https:" &&
      !["localhost", "127.0.0.1"].includes(url.hostname)
    )
      throw new Error("APP_ORIGIN must use HTTPS");
    return url.origin;
  }
  const request = new URL(getRequest().url);
  if (["localhost", "127.0.0.1"].includes(request.hostname))
    return request.origin;
  throw new Error("Configure APP_ORIGIN for this Cloudflare deployment");
}

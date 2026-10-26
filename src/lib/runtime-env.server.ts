/** Runtime secrets on Cloudflare Workers; process.env fallback for local Node tooling.
 * Never import this module into browser components.
 */
import { env } from "cloudflare:workers";

export function runtimeEnv(name: string): string | undefined {
  const bindings = env as unknown as Record<string, unknown>;
  const value = bindings?.[name];
  if (typeof value === "string" && value.length > 0) return value;
  return typeof process !== "undefined" ? process.env?.[name] : undefined;
}

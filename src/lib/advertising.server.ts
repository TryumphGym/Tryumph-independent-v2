/** Compatibility entrypoint: only signed network settlements may create trainer earnings. */
export { settleVerifiedAd } from "./ad-settlement.server";
export type { VerifiedAdEvent as AdSettlement } from "./ad-settlement.server";

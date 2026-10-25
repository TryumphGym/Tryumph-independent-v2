import { isPrivateTrybe } from "./data";

export function inTrybeFeed(trybeId: string, selected: string, joined: readonly string[]) {
  if (isPrivateTrybe(trybeId) && !joined.includes(trybeId)) return false;
  return selected === "all" ? joined.includes(trybeId) : trybeId === selected;
}
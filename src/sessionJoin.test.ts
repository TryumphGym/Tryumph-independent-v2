import { describe, expect, it } from "vitest";
import { sessionWindow } from "@/components/SessionJoin";

const at = (s: string) => new Date(s);
describe("1-on-1 join window", () => {
  it("is closed more than 10 min before", () =>
    expect(
      sessionWindow("2026-10-13", "09:00", at("2026-10-13T08:49:00-05:00")),
    ).toBe("early"));
  it("opens 10 min before", () =>
    expect(
      sessionWindow("2026-10-13", "09:00", at("2026-10-13T08:50:00-05:00")),
    ).toBe("open"));
  it("ends 60 min after start", () =>
    expect(
      sessionWindow("2026-10-13", "09:00", at("2026-10-13T10:01:00-05:00")),
    ).toBe("ended"));
});

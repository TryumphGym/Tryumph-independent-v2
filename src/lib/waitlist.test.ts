import { describe, expect, it } from "vitest";
import { waitlistCsv, type WaitlistEntry } from "./waitlist";

const entry: WaitlistEntry = { email: "test@example.com", role: "parent", created_at: "2026-10-22", heard_from: "facebook_group", live_class_interest: "maybe", notify_new_coaches: false };

describe("waitlist answers", () => {
  it("exports the referral source", () => {
    expect(waitlistCsv([entry])).toContain('"Facebook group post"');
  });
  it("preserves the answer to the $5 live-class question", () => {
    expect(waitlistCsv([entry]).split("\r\n")[1]?.split(",")[4]).toBe('"Maybe"');
  });
  it("does not opt people into new-coach notifications by default", () => {
    expect(waitlistCsv([entry]).split("\r\n")[1]?.split(",")[5]).toBe('"No"');
    expect(waitlistCsv([{ ...entry, notify_new_coaches: true }]).split("\r\n")[1]?.split(",")[5]).toBe('"Yes"');
  });
  it("keeps unanswered questions distinct from no", () => {
    expect(waitlistCsv([{ ...entry, heard_from: null, live_class_interest: null }])).toContain('"Not answered","Not answered"');
  });
});
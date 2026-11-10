import { it, expect } from "vitest";
import { mayPublishFitnessCopy } from "./professional-claims";
const credential = {
  name: "Registered dietitian",
  status: "verified",
  expires: "2099-12-31",
  verified_by: "admin",
  verified_at: "2026-11-02",
  document_path: "trainer/proof.pdf",
};
it("does not turn self-described accessibility focus or a different clinical credential into protected-title qualification", () => {
  expect(
    mayPublishFitnessCopy(
      "Rehabilitation-oriented, seated and arthritis-friendly fitness",
      "trainer",
      [],
    ),
  ).toBe(true);
  expect(
    mayPublishFitnessCopy("Physical therapist", "trainer", [credential]),
  ).toBe(false);
  expect(
    mayPublishFitnessCopy("Registered dietitian", "trainer", [credential]),
  ).toBe(true);
  expect(
    mayPublishFitnessCopy("Registered dietitian", "trainer", [
      { ...credential, verified_by: "trainer" },
    ]),
  ).toBe(false);
  expect(
    mayPublishFitnessCopy("Registered dietitian", "trainer", [
      { ...credential, document_path: null },
    ]),
  ).toBe(false);
});
it("does not permit fitness claims to cure even when a professional title is verified", () => {
  expect(
    mayPublishFitnessCopy("This cures arthritis", "trainer", [credential]),
  ).toBe(false);
  expect(
    mayPublishFitnessCopy(
      "Fitness does not diagnose, treat or cure conditions",
      "trainer",
      [],
    ),
  ).toBe(true);
  expect(
    mayPublishFitnessCopy(
      "Ask your physician about appropriate activity",
      "trainer",
      [],
    ),
  ).toBe(true);
  expect(
    mayPublishFitnessCopy("I am not a physical therapist", "trainer", []),
  ).toBe(true);
});

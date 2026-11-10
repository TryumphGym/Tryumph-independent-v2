import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, it, expect } from "vitest";
import { useState } from "react";
import { DiscoveryFilters } from "./DiscoveryFilters";
import { EverydayTryumphs } from "./EverydayTryumphs";
afterEach(cleanup);
function Filters() {
  const [value, onChange] = useState<string[]>([]);
  return (
    <>
      <DiscoveryFilters value={value} onChange={onChange} />
      <output>{value.join(",")}</output>
    </>
  );
}
it("supports accessible simultaneous goals, life-stage and seated filters without a diagnosis field", () => {
  render(<Filters />);
  fireEvent.click(screen.getByText("Goals, life stages & accessibility"));
  for (const label of [
    "Core strength",
    "Postpartum recovery",
    "Seated / chair workouts",
  ])
    fireEvent.click(screen.getByLabelText(label));
  expect(screen.getByRole("status").textContent).toBe("core,postpartum,seated");
  expect(
    screen.getByText(/no diagnosis or paid membership required/i),
  ).toBeInTheDocument();
  expect(screen.queryByLabelText(/diagnosis/i)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Clear focus filters" }));
  expect(screen.getByRole("status").textContent).toBe("");
});
it("shows public curated everyday suggestions, accessible controls, modifications and safe-task guidance", () => {
  render(<EverydayTryumphs />);
  fireEvent.click(screen.getByText("Browse small movement ideas"));
  fireEvent.change(screen.getByLabelText("Movement position"), {
    target: { value: "seated" },
  });
  expect(
    screen.getByRole("heading", { name: "Comfortable seated leg extensions" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("heading", { name: "Supported calf raises" }),
  ).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Approximate time"), {
    target: { value: "1" },
  });
  expect(
    screen.queryByRole("heading", {
      name: "Comfortable seated leg extensions",
    }),
  ).not.toBeInTheDocument();
  expect(screen.getByText(/carrying a baby/)).toBeInTheDocument();
});

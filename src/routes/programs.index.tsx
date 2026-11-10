import { createFileRoute } from "@tanstack/react-router";
import { ProgramCatalog } from "@/components/ProgramCatalog";
export const Route = createFileRoute("/programs/")({
  head: () => ({ meta: [{ title: "Workout Programs — Tryumph Gym" }] }),
  component: ProgramCatalog,
});

import { createFileRoute } from "@tanstack/react-router";
import { TryumphSchool } from "@/components/CreatorBusiness";
export const Route = createFileRoute("/school")({
  head: () => ({ meta: [{ title: "Tryumph School — Tryumph Gym" }] }),
  component: TryumphSchool,
});

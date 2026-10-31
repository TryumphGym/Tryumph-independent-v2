import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { ProgramDetail } from "@/components/ProgramDetail";
export const Route = createFileRoute("/programs/$id")({
  validateSearch: z.object({ payment: z.string().optional() }),
  head: () => ({ meta: [{ title: "Workout Program — Tryumph Gym" }] }),
  component: Page,
});
function Page() {
  const { id } = Route.useParams();
  const { payment } = Route.useSearch();
  return (
    <div className="space-y-5">
      <Link className="text-primary underline" to="/programs">
        ← Workout programs
      </Link>
      {payment === "received" && (
        <p className="card p-4" role="status">
          Thank you. Access appears only after server payment verification.
          Refresh below if your payment is still processing.
        </p>
      )}
      <ProgramDetail id={id} />
    </div>
  );
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SessionJoinButton } from "./SessionJoin";
import { cancelPrivateSession } from "@/lib/session-management.functions";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
export function MemberSessions({ trainer = false }: { trainer?: boolean }) {
  const [rows, setRows] = useState<Tables<"private_session_access">[]>([]);
  const load = async () => {
    const auth = await supabase.auth.getUser();
    if (!auth.data.user) return;
    const result = await supabase
      .from("private_session_access")
      .select("*")
      .eq(trainer ? "trainer_id" : "member_id", auth.data.user.id)
      .order("starts_at", { ascending: false });
    if (!result.error) setRows(result.data);
  };
  useEffect(() => {
    void load();
  }, [trainer]);
  return (
    <section className="card space-y-3 p-5">
      <h2 className="text-xl font-bold">
        {trainer ? "Booked private sessions" : "Your private sessions"}
      </h2>
      <p className="text-xs text-muted-foreground">
        Times are Central. Only verified paid sessions have room access.
      </p>
      {!rows.length && (
        <p className="text-sm text-muted-foreground">
          No confirmed sessions yet.
        </p>
      )}
      {rows.map((row) => (
        <div
          className="flex flex-wrap items-center gap-3 rounded border p-3 text-sm"
          key={row.checkout_id}
        >
          <span className="flex-1">
            {row.day} at {row.time} · {row.status}
          </span>
          {row.status === "paid" && (
            <>
              <SessionJoinButton
                trainerId={row.trainer_id}
                date={row.day}
                time={row.time}
                title="Private training"
                hostName="Your trainer"
                isTrainer={trainer}
              />
              {new Date(row.starts_at).getTime() > Date.now() && (
                <button
                  className="btn btn-ghost"
                  onClick={() =>
                    void cancelPrivateSession({
                      data: { checkoutId: row.checkout_id },
                    })
                      .then(() => {
                        toast.success(
                          "Cancellation recorded; refund processing",
                        );
                        return load();
                      })
                      .catch((error) =>
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "Could not cancel",
                        ),
                      )
                  }
                >
                  Cancel and refund
                </button>
              )}
            </>
          )}
        </div>
      ))}
    </section>
  );
}

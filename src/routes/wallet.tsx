import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Coins } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { TOKEN_PRICE } from "@/lib/data";
import { useStore } from "@/lib/store";
import { createTokenCheckout } from "@/lib/stripe.functions";
import { PageHeader } from "@/components/Avatar";

export const Route = createFileRoute("/wallet")({
  head: () => ({
    meta: [
      { title: "Wallet — Tryumph Gym" },
      { name: "description", content: "Buy tokens for live class drop-ins. No subscriptions." },
      { property: "og:title", content: "Wallet — Tryumph Gym" },
      { property: "og:description", content: "Pay as you go with tokens." },
    ],
  }),
  component: Wallet,
});

function Wallet() {
  const { s } = useStore();
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("paid")) {
      toast.success("Payment received — your tokens will appear in a moment.");
      const t = setTimeout(() => window.location.replace("/wallet"), 4000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, []);

  const buy = async (n: number) => {
    if (!s.signedIn) { toast("Sign in to buy tokens.", { action: { label: "Sign in", onClick: () => navigate({ to: "/account" }) } }); return; }
    setBusy(true);
    const tab = window.self !== window.top ? window.open("", "_blank") : null;
    try {
      const { url } = await createTokenCheckout({ data: { tokens: n } });
      if (!url) throw new Error("no url");
      if (tab) tab.location.href = url; else window.location.href = url;
    } catch (e) {
      tab?.close();
      const msg = e instanceof Error ? e.message : "";
      if (/auth|unauthor|401|sign/i.test(msg)) toast.error("Your session expired — please sign in again.", { action: { label: "Sign in", onClick: () => navigate({ to: "/account" }) } });
      else toast.error("Couldn't start checkout. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <PageHeader eyebrow="Pay as you go" title="Wallet" sub="Tokens are only for live class drop-ins (1 token = 1 class). 1-on-1s are paid by card. Tokens never expire." />
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="card bg-brand p-6 text-primary-foreground">
          <Coins className="h-6 w-6" />
          <p className="mt-4 font-display text-5xl font-extrabold">{s.tokens}</p>
          <p>tokens · ${s.tokens * TOKEN_PRICE} value</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 5, 10].map((n) => (
            <div key={n} className="card p-6 text-center">
              <p className="font-display text-3xl font-bold">{n}</p>
              <p className="text-muted-foreground">token{n > 1 ? "s" : ""}</p>
              <button className="btn btn-primary mt-4 w-full" disabled={busy} onClick={() => buy(n)}>${n * TOKEN_PRICE}</button>
            </div>
          ))}
          {!s.signedIn && <p className="text-sm text-muted-foreground sm:col-span-3">Create a free account to buy tokens.</p>}
          <p className="text-xs text-muted-foreground sm:col-span-3">Secure checkout by Stripe. Tokens are added to your wallet as soon as payment completes.</p>
        </div>
      </div>
      <h2 className="mb-3 mt-10 text-xl font-bold">History</h2>
      <div className="card divide-y">
        {s.ledger.length === 0 && <p className="p-6 text-muted-foreground">No transactions yet.</p>}
        {s.ledger.map((l) => (
          <div key={l.id} className="flex justify-between p-4 text-sm">
            <span>{l.label}<span className="ml-2 text-muted-foreground">{l.date}</span></span>
            <span className={l.tokens > 0 ? "text-success" : "text-muted-foreground"}>{l.tokens > 0 ? "+" : ""}{l.tokens}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

import { Link, useLocation } from "@tanstack/react-router";
import { Coins, Menu, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useStore } from "@/lib/store";
import { ReminderWatcher } from "@/components/ReminderWatcher";
import { Avatar } from "@/components/Avatar";
import { GetAppButton } from "@/components/GetAppButton";
import { useUserId } from "@/lib/community";
import { supabase } from "@/integrations/supabase/client";

const nav = [
  { to: "/", label: "Home" },
  { to: "/on-demand", label: "On-Demand" },
  { to: "/live", label: "Live Classes" },
  { to: "/trainers", label: "Trainers" },
  { to: "/trybes", label: "Trybes" },
  { to: "/wallet", label: "Wallet" },
  { to: "/account", label: "Account" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { s } = useStore();
  const [open, setOpen] = useState(false);
  const userId = useUserId();
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    let active = true;
    setIsAdmin(false);
    if (s.signedIn)
      void supabase.auth.getUser().then(async ({ data }) => {
        if (!data.user) return;
        const result = await supabase.rpc("has_role", {
          _user_id: data.user.id,
          _role: "admin",
        });
        if (active) setIsAdmin(!result.error && !!result.data);
      });
    return () => {
      active = false;
    };
  }, [s.signedIn, userId]);
  const loc = useLocation();
  const [hideNudge, setHideNudge] = useState(false);
  useEffect(() => {
    if (localStorage.getItem("tryumph-nudge-later")) setHideNudge(true);
  }, []);
  const profileDone =
    s.extra.onboarded ||
    (s.role === "member"
      ? Boolean(
          s.profile.height &&
          s.profile.weight &&
          (s.extra.goals.length || s.profile.goal),
        ) && s.extra.goals.length > 0
      : s.extra.trainer.certs.length > 0 &&
        s.extra.trainer.specialties.length > 0);
  const showNudge =
    s.signedIn && !profileDone && !hideNudge && loc.pathname !== "/welcome";
  return (
    <div className="min-h-screen">
      <ReminderWatcher />
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4">
          <Link
            to="/"
            className="font-display text-xl font-extrabold tracking-tight"
          >
            TRY<span className="text-gradient">UMPH</span>
          </Link>
          <nav className="hidden flex-1 items-center gap-1 lg:flex">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                activeOptions={{ exact: n.to === "/" }}
                className="rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
                activeProps={{ className: "bg-secondary text-foreground" }}
              >
                {n.label}
              </Link>
            ))}
            <Link
              to="/for-trainers"
              className="ml-1 rounded-full border border-primary/40 px-3 py-1.5 text-sm font-semibold text-primary transition hover:bg-primary/10"
              activeProps={{ className: "bg-primary/10" }}
            >
              Teach on Tryumph
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <GetAppButton className="btn btn-ghost hidden md:inline-flex" />
            {isAdmin && (
              <Link
                to="/admin"
                className="btn btn-outline hidden sm:inline-flex"
              >
                Admin
              </Link>
            )}
            {s.role === "trainer" && s.signedIn && (
              <Link
                to="/studio"
                className="btn btn-outline hidden sm:inline-flex"
              >
                Trainer Studio
              </Link>
            )}
            {s.signedIn && (
              <Link to="/wallet" className="btn btn-ghost">
                <Coins className="h-4 w-4 text-primary" />
                {s.tokens}
              </Link>
            )}
            {s.signedIn && (
              <Link
                to="/account"
                aria-label="Your profile"
                className="hidden sm:block"
              >
                <Avatar
                  size="sm"
                  initials={s.name.slice(0, 2).toUpperCase()}
                  src={s.profile.avatar || undefined}
                />
              </Link>
            )}
            <button
              className="btn btn-ghost lg:hidden"
              onClick={() => setOpen(!open)}
              aria-label="Menu"
            >
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>
        {open && (
          <nav className="grid gap-1 border-t px-4 py-3 lg:hidden">
            <Link
              to="/for-trainers"
              onClick={() => setOpen(false)}
              className="rounded-lg bg-primary/10 px-3 py-2 text-sm font-semibold text-primary"
            >
              Teach on Tryumph →
            </Link>
            {[
              ...nav,
              { to: "/studio", label: "Trainer Studio" },
            ].map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-sm"
                activeProps={{ className: "bg-secondary" }}
              >
                {n.label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                to="/admin"
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-sm"
              >
                Admin dashboard
              </Link>
            )}
            <GetAppButton className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm" />
          </nav>
        )}
      </header>
      {showNudge && (
        <div className="border-b bg-secondary">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-2 text-sm">
            <span className="flex-1">
              {s.role === "trainer"
                ? "Finish your coaching profile to get verified."
                : "Finish your profile for workouts that fit you."}
            </span>
            <Link to="/welcome" className="btn btn-primary">
              Finish profile
            </Link>
            <button
              className="text-muted-foreground"
              onClick={() => {
                localStorage.setItem("tryumph-nudge-later", "1");
                setHideNudge(true);
              }}
            >
              Later
            </button>
          </div>
        </div>
      )}
      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
      <footer className="border-t">
        <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-4 px-4 py-8 text-sm text-muted-foreground">
          <p>© 2026 Tryumph Gym — bring the gym home.</p>
          <div className="flex gap-4">
            <Link to="/terms">Terms & waiver</Link>
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/contact">Contact Us</Link>
            <Link to="/for-trainers">For trainers</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export type CreatorOffer = {
  trainerId: string;
  title: string;
  description: string;
  priceCents: number;
  currency: "usd";
  enabled: boolean;
  subscribed: boolean;
};
export type CreatorDashboard = {
  offer: {
    title: string;
    description: string;
    price_cents: number;
    enabled: boolean;
    blocked: boolean;
  } | null;
  subscribers: number;
  grossCents: number;
  refundedCents: number;
  feesCents: number;
  earnedCents: number;
  subscriptions: {
    id: string;
    trainerId: string;
    priceCents: number;
    billingStatus: string;
    cancelAtPeriodEnd: boolean;
    accessUntil: string | null;
    hasAccess: boolean;
  }[];
};
export type CreatorWorkout = {
  id: string;
  title: string;
  minutes: number;
  category: string;
  level: string;
  equipment: string;
  audience: "public" | "subscribers" | "early";
  publicAt: string | null;
  isPublic: boolean;
};
export const MEMBERSHIP_POLICY =
  "Optional monthly membership to this trainer only. Renews automatically until cancelled. Cancel future renewal at any time; an already paid period remains available until its end unless refunded, disputed or moderated. Includes this trainer’s scheduled and subscriber lives, subscriber workouts and posts, and members-only programs. Separately sold programs are included only when explicitly configured. No live-entry token is deducted for included attendance.";

import { Link } from "@tanstack/react-router";

type WelcomeGuide = {
  title: string;
  summary: string;
  steps: readonly string[];
  section: string;
  view?: string;
  action: string;
};

const intro =
  "Welcome to Tryumph Gym. Tryumph is a fitness community where certified trainers can share free workouts, teach live classes, offer personal coaching, sell video or PDF programs, and build a community called a Trybe. You do not need to offer everything. Start with what fits you and grow at your own pace.";

export const trainerWelcomeGuides: readonly WelcomeGuide[] = [
  {
    title: "1. Set up your trainer profile",
    summary: "Help members get to know you, and complete verification before publishing or selling.",
    steps: [
      "Open Settings to add your bio, specialties, profile details and the people you love coaching.",
      "Under Certifications, upload your current training certification and CPR/AED evidence. Tryumph reviews credentials before awarding verified trainer status.",
      "Keep your documents current. Expired required credentials can pause new uploads and live hosting; previously approved content can remain available.",
      "When you are ready to receive paid bookings or sales, complete the separate Stripe payout onboarding process."
    ],
    section: "settings",
    view: "credentials",
    action: "Go to certifications"
  },
  {
    title: "2. Share your first free workout",
    summary: "Introduce your coaching style through on-demand fitness videos members can discover for free.",
    steps: [
      "Open Content Library, upload your workout and add a clear title, description, duration, intensity, equipment and relevant focus tags.",
      "Submit it for review. Only approved videos appear to members.",
      "If you want eligible video ads, mark real water-break moments. Ads are never inserted mid-set; workouts without eligible breaks are ad-free.",
      "You can include a Spotify playlist link instead of recording copyrighted music into the video.",
      "Five approved on-demand videos are needed before you can host live classes. You do not need five videos just to create a PDF program."
    ],
    section: "content-library",
    view: "workouts",
    action: "Open Content Library"
  },
  {
    title: "3. Make your Trybe feel like home",
    summary: "Your Trybe is your community space—not just another place to post workout links.",
    steps: [
      "Open Trybe & Community to visit your trainer Trybe.",
      "Share updates, encouragement, questions, photos and announcements with your community.",
      "Use your trainer profile, workouts and Trybe to help new members understand what you offer.",
      "Followers and Trybe members are not automatically paying subscribers. Keep free community participation welcoming."
    ],
    section: "trybe-community",
    view: "posts",
    action: "Visit your Trybe"
  },
  {
    title: "4. Teach live or work one-on-one",
    summary: "Choose the coaching format that works for you. You do not have to do both.",
    steps: [
      "For group classes, open Live Studio to set up a scheduled session. Standard non-subscriber drop-ins are $5 when paid-class checkout is available.",
      "Live hosting requires current verified credentials, five approved videos and the necessary payout eligibility.",
      "For private coaching, open Bookings & Clients to manage your availability and individual sessions. You set your own coaching rate.",
      "Live attendance and private-session billing use platform attendance and payment safeguards. Subscriber-only lives depend on an active membership and feature activation."
    ],
    section: "live-studio",
    view: "schedule",
    action: "Explore Live Studio"
  },
  {
    title: "5. Build a PDF or video program",
    summary: "Programs can be downloadable guides, video courses, structured workout plans or a combination.",
    steps: [
      "Go to Programs and choose a product type such as Workout program, Video course, Fitness challenge or Downloadable guide.",
      "Add a description, who it is for, the schedule or steps, and any workout videos. For a PDF guide, upload a plain PDF up to 10 MB.",
      "Select free, one-time paid, an external offer, or Members Only access as appropriate. You can attach approved PDF downloads to a video program.",
      "Submit the finished program for independent review. Protected PDF delivery and native payments require verified setup before those offers can go live."
    ],
    section: "programs",
    view: "builder",
    action: "Open Program Builder"
  },
  {
    title: "6. Understand your earning options",
    summary: "Your business can have several income streams, with no required monthly trainer subscription.",
    steps: [
      "Hosted programs, optional trainer memberships and one-on-one coaching use a 90% trainer / 10% Tryumph split.",
      "Standard $5 live drop-ins and eligible on-demand water-break advertising use a 50% / 50% split.",
      "These platform revenue splits are calculated after applicable payment-processing fees and before hosting or infrastructure costs. Independent affiliate links and external stores are yours.",
      "Memberships are optional. Subscribers can receive benefits you choose, such as selected programs, subscriber content or included live classes, when enabled.",
      "Review Earnings & Payouts for actual recorded earnings, and remember that features requiring provider activation may not yet be available."
    ],
    section: "earnings-payouts",
    action: "View Earnings & Payouts"
  },
  {
    title: "7. Grow with your audience",
    summary: "You can learn what members respond to without becoming a full-time marketer.",
    steps: [
      "Look at Analytics for views, followers, Trybe growth, program progress and eligible business performance.",
      "Use Messages & Partnerships for conversations and professional collaboration requests.",
      "Keep your profile current, respond to your Trybe and experiment with the kind of classes or guides your audience asks for.",
      "Creator Perks and Tryumph School are here to support you. Paid Spotlight placements are still being prepared; do not treat draft promotions as active advertising."
    ],
    section: "analytics",
    view: "business",
    action: "Explore Analytics"
  }
];

export function trainerWelcomeMatch(search: string) {
  const query = search.trim().toLowerCase();
  const introMatches =
    !query ||
    `${intro} welcome start here what is tryumph twitch meets fitness you don't have to win you just gotta try(umph)`
      .toLowerCase()
      .includes(query);
  const guides = trainerWelcomeGuides.filter((guide) =>
    !query ||
    [guide.title, guide.summary, ...guide.steps, guide.action]
      .join(" ")
      .toLowerCase()
      .includes(query),
  );
  return { introMatches, guides };
}

export function TrainerWelcomeGuides({ search }: { search: string }) {
  const { introMatches, guides } = trainerWelcomeMatch(search);
  if (!introMatches && !guides.length) return null;

  return (
    <section className="space-y-3" aria-labelledby="trainer-welcome-title">
      <h3 id="trainer-welcome-title" className="text-xl font-bold">
        Start Here · Welcome & Getting Started
      </h3>
      {introMatches && (
        <div className="card space-y-3 border-primary/30 p-6">
          <p className="text-sm font-semibold text-primary">Welcome to Tryumph Gym</p>
          <p className="text-lg font-semibold">
            You don&apos;t have to win, You just gotta Try(Umph).
          </p>
          <p>{intro}</p>
          <p className="text-sm text-muted-foreground">
            Think Twitch meets fitness: real trainers, real community, and
            flexible ways to work out and coach. Members can enjoy free
            on-demand workouts, while you choose which additional services
            to offer.
          </p>
          <Link
            to="/studio"
            search={{ section: "settings", view: "profile" }}
            className="btn btn-outline inline-flex"
          >
            Start with your profile
          </Link>
        </div>
      )}
      <div className="space-y-3">
        {guides.map((guide) => (
          <details key={guide.title} className="card p-5">
            <summary className="cursor-pointer font-semibold">
              {guide.title}
              <span className="mt-1 block text-sm font-normal text-muted-foreground">
                {guide.summary}
              </span>
            </summary>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm">
              {guide.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <Link
              to="/studio"
              search={{ section: guide.section, ...(guide.view ? { view: guide.view } : {}) }}
              className="mt-4 inline-block text-sm font-semibold text-primary underline"
            >
              {guide.action}
            </Link>
          </details>
        ))}
      </div>
      {!search.trim() && (
        <p className="text-xs text-muted-foreground">
          This is a starting guide. Availability of paid programs, memberships,
          protected downloads and other provider-backed tools depends on final
          verification and activation. More detailed lessons will appear in
          Tryumph School as they are reviewed and published.
        </p>
      )}
    </section>
  );
}
